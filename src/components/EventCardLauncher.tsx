import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileUp,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarEventSuggestions,
  getCalendarStatus,
  type CalendarConnectionState,
  type CalendarEventSuggestion,
} from '../lib/calendarService';
import type { MyProfile } from '../types';
import { EventImportPanel } from './EventImportPanel';

interface EventCardLauncherProps {
  profile: MyProfile;
  onChange: (profile: MyProfile) => void;
  onOpenCards: () => void;
}

type CalendarRangeDays = 1 | 7 | 30;

const relevanceLabels: Record<CalendarEventSuggestion['relevance'], string> = {
  happening_now: 'Happening now',
  starting_soon: 'Starting soon',
  recently_ended: 'Just ended',
  today: 'Today',
};

const calendarRanges: Array<{ days: CalendarRangeDays; label: string }> = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

const oauthResultMessages: Record<string, string> = {
  cancelled: 'Google connection was cancelled.',
  invalid_state: 'The Google connection expired before it finished. Start it again.',
  authorization_incomplete: 'Google did not finish the authorization. Start it again.',
  client_credentials: 'Google Calendar is temporarily unavailable because the app connection needs attention.',
  redirect_mismatch: 'Google Calendar is temporarily unavailable because the return address was rejected.',
  authorization_expired: 'The Google authorization expired before it finished. Start it again.',
  token_exchange: 'Google approved access, but the connection could not be completed. Retry once.',
  identity_token: 'Google approved access, but the account could not be verified. Retry once.',
  identity_email: 'Google did not return a verified account email.',
  session_error: 'Google approved access, but the secure Calendar session could not be created.',
  google_error: 'Google returned an authorization error. Start the connection again.',
  unconfigured: 'Google Calendar is temporarily unavailable.',
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.55l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.34 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

function dateFromDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToDateOnly(value: string, days: number) {
  const date = dateFromDateOnly(value);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventTimeLabel(event: CalendarEventSuggestion) {
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (event.allDay) return `${day.format(dateFromDateOnly(event.start))} · All day`;

  const start = new Date(event.start);
  const end = new Date(event.end);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day.format(start)} · ${time.format(start)}–${time.format(end)}`;
}

function localDateValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calendarBadgeLabel(event: CalendarEventSuggestion, rangeDays: CalendarRangeDays) {
  const eventDate = localDateValue(event.start);
  const today = localDateValue(new Date().toISOString());
  if (rangeDays > 1 && eventDate !== today) return 'Upcoming';
  return relevanceLabels[event.relevance];
}

function eventBoundaries(event: CalendarEventSuggestion) {
  if (!event.allDay) {
    return {
      startAt: event.start,
      endAt: event.end,
      endsOn: localDateValue(event.end),
    };
  }

  const localStart = dateFromDateOnly(event.start);
  const localEndExclusive = dateFromDateOnly(event.end);
  const localEnd = new Date(localEndExclusive.getTime() - 1);
  return {
    startAt: localStart.toISOString(),
    endAt: localEnd.toISOString(),
    endsOn: addDaysToDateOnly(event.end, -1),
  };
}

export function EventCardLauncher({ profile, onChange, onOpenCards }: EventCardLauncherProps) {
  const [state, setState] = useState<CalendarConnectionState>('checking');
  const [events, setEvents] = useState<CalendarEventSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState<CalendarRangeDays>(1);
  const [showCalendarIntegration, setShowCalendarIntegration] = useState(() =>
    new URLSearchParams(window.location.search).has('calendar'),
  );
  const calendarPanelRef = useRef<HTMLElement>(null);

  const loadEvents = useCallback(async (nextRange: CalendarRangeDays) => {
    setLoading(true);
    setError('');
    try {
      const response = await getCalendarEventSuggestions(profile.eventName || '', nextRange);
      if (!response.configured) {
        setState('unconfigured');
        setEvents([]);
        return;
      }
      if (!response.connected) {
        setState('disconnected');
        setEvents([]);
        if (response.error) setError(response.error);
        return;
      }
      setState('connected');
      setShowCalendarIntegration(true);
      setEvents(response.events || []);
    } catch (loadError) {
      setState('connected');
      setError(loadError instanceof Error ? loadError.message : 'Calendar events could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [profile.eventName]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const oauthResult = new URLSearchParams(window.location.search).get('calendar') || '';
      const callbackMessage = oauthResultMessages[oauthResult] || (
        oauthResult && oauthResult !== 'connected'
          ? 'Google returned an unexpected connection result. Retry once.'
          : ''
      );

      try {
        const status = await getCalendarStatus();
        if (cancelled) return;
        if (!status.configured) {
          setState('unconfigured');
          setError(callbackMessage);
          return;
        }
        if (!status.connected) {
          setState('disconnected');
          if (callbackMessage) {
            setShowCalendarIntegration(true);
            setError(callbackMessage);
          }
          return;
        }
        setShowCalendarIntegration(true);
        await loadEvents(1);
      } catch {
        if (!cancelled) {
          setState('disconnected');
          if (callbackMessage) setError(callbackMessage);
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [loadEvents]);

  function connectWithGoogle() {
    setState('connecting');
    setError('');
    connectGoogleCalendar('event');
  }

  function revealGoogleCalendar() {
    if (state === 'disconnected') {
      connectWithGoogle();
      return;
    }
    setShowCalendarIntegration(true);
    window.requestAnimationFrame(() => {
      calendarPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openAppleInvitePicker() {
    const input = document.querySelector<HTMLInputElement>('.event-import-panel input[type="file"]');
    input?.click();
  }

  function focusEventLink() {
    const input = document.querySelector<HTMLInputElement>('.event-link-input input');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.requestAnimationFrame(() => input?.focus());
  }

  function changeCalendarRange(nextRange: CalendarRangeDays) {
    if (nextRange === rangeDays && events.length > 0) return;
    setRangeDays(nextRange);
    void loadEvents(nextRange);
  }

  async function disconnect() {
    await disconnectGoogleCalendar();
    setState('disconnected');
    setEvents([]);
    setError('');
  }

  function launchEventCard(event: CalendarEventSuggestion) {
    const currentEventSelection = profile.cardSelections?.event ?? [];
    const nextEventSelection = currentEventSelection.includes('eventName')
      ? currentEventSelection
      : [...currentEventSelection, 'eventName' as const];
    const boundaries = eventBoundaries(event);

    onChange({
      ...profile,
      eventName: event.title,
      eventStartAt: boundaries.startAt,
      eventEndAt: boundaries.endAt,
      eventEndsAt: boundaries.endsOn,
      eventLocation: event.location,
      eventUrl: event.htmlLink || '',
      eventDescription: event.allDay ? 'All-day event' : event.description,
      cardSelections: {
        ...profile.cardSelections,
        event: nextEventSelection,
      },
    });
    onOpenCards();
  }

  const googleStatus = state === 'connected'
    ? 'Connected'
    : state === 'checking'
      ? 'Checking'
      : state === 'connecting'
        ? 'Connecting'
        : state === 'unconfigured'
          ? 'Unavailable'
          : 'Not connected';
  const googleAction = state === 'connected'
    ? 'View upcoming events'
    : state === 'checking'
      ? 'Checking connection'
      : state === 'connecting'
        ? 'Opening Google'
        : state === 'unconfigured'
          ? 'Use another source'
          : 'Connect Google';
  const activeRangeLabel = calendarRanges.find((range) => range.days === rangeDays)?.label || 'Today';

  return (
    <div className="page-stack live-event-page">
      <section className="live-event-hero event-launcher-hero">
        <div>
          <span className="hero-kicker">Events & Calendar</span>
          <h2>Choose where the event comes from.</h2>
          <p>
            Use Google Calendar, import an Apple Calendar invitation, or paste any public event page.
            Every route ends in the same editable Event QR.
          </p>
        </div>
        <span className="live-event-orbit"><Sparkles size={32} /></span>
      </section>

      <section className="event-source-hub" aria-labelledby="event-source-heading">
        <div className="event-source-heading">
          <span className="step-badge">1</span>
          <div>
            <h3 id="event-source-heading">Choose an event source</h3>
            <p>Pick the fastest route. You can review and correct every detail before creating the QR.</p>
          </div>
        </div>

        <div className="event-source-grid">
          <button
            className={`event-source-card google-source state-${state}`}
            type="button"
            disabled={state === 'checking' || state === 'connecting'}
            onClick={revealGoogleCalendar}
          >
            <span className="event-source-icon google-source-icon"><GoogleMark /></span>
            <span className="event-source-copy">
              <small>GOOGLE CALENDAR</small>
              <strong>{state === 'connected' ? 'Calendar linked' : 'Link Google Calendar'}</strong>
              <p>Browse today’s events or look ahead up to 30 days with read-only access.</p>
            </span>
            <span className={`event-source-status state-${state}`}>{googleStatus}</span>
            <span className="event-source-action">{googleAction} <ArrowRight size={14} /></span>
          </button>

          <button className="event-source-card apple-source" type="button" onClick={openAppleInvitePicker}>
            <span className="event-source-icon apple-source-icon"><FileUp size={23} /></span>
            <span className="event-source-copy">
              <small>APPLE CALENDAR</small>
              <strong>Import an invitation</strong>
              <p>Choose an .ics file from Mail, Files, Apple Calendar, Outlook, or another calendar app.</p>
            </span>
            <span className="event-source-status">On-device</span>
            <span className="event-source-action">Choose .ics file <ArrowRight size={14} /></span>
          </button>

          <button className="event-source-card luma-source" type="button" onClick={focusEventLink}>
            <span className="event-source-icon luma-source-icon"><Link2 size={23} /></span>
            <span className="event-source-copy">
              <small>EVENT LINK</small>
              <strong>Paste any event page</strong>
              <p>Import public details from Luma, Eventbrite, Meetup, Yelp, or another event website.</p>
            </span>
            <span className="event-source-action">Paste event link <ArrowRight size={14} /></span>
          </button>
        </div>
      </section>

      <section ref={calendarPanelRef} className={`panel calendar-integration-panel${showCalendarIntegration ? ' open' : ''}`}>
        <button
          className="calendar-beta-toggle calendar-integration-toggle"
          type="button"
          onClick={() => setShowCalendarIntegration((current) => !current)}
          aria-expanded={showCalendarIntegration}
        >
          <span className="calendar-detection-icon"><CalendarDays size={20} /></span>
          <span><strong>Google Calendar events</strong><small>Upcoming events from the linked Google account</small></span>
          <span className={`calendar-integration-pill state-${state}`}>{state === 'connected' ? 'CONNECTED' : 'GOOGLE'}</span>
          <ChevronDown size={18} />
        </button>

        {showCalendarIntegration && (
          <div className="calendar-beta-body calendar-integration-body">
            {(state === 'checking' || state === 'connecting') && (
              <div className="live-event-loading"><Loader2 className="spin" size={19} />
                {state === 'connecting' ? 'Taking you to Google…' : 'Checking your calendar…'}
              </div>
            )}

            {state === 'unconfigured' && !loading && (
              <div className="live-event-connect muted-calendar-state">
                <span className="calendar-detection-icon"><CalendarDays size={22} /></span>
                <div><h3>Google Calendar is temporarily unavailable</h3><p>Apple invitations, public event links, and manual event creation still work normally.</p></div>
              </div>
            )}

            {state === 'disconnected' && !loading && (
              <div className="live-event-connect compact-google-connect calendar-clean-connect">
                <span className="calendar-detection-icon"><CalendarCheck size={22} /></span>
                <div>
                  <h3>Connect Google Calendar</h3>
                  <p>Approve read-only access to event titles, times and locations. TagOnce cannot edit your calendar.</p>
                  <button className="google-oauth-button" type="button" onClick={connectWithGoogle}>
                    <GoogleMark /><span>Continue with Google</span>
                  </button>
                  <details className="calendar-safari-help">
                    <summary>Google screen not continuing in Safari?</summary>
                    <p>Safari can block the return between Google and TagOnce when cross-site traffic is restricted. Allow the Google-to-TagOnce handoff in Safari’s website privacy settings, then retry.</p>
                  </details>
                </div>
              </div>
            )}

            {state === 'connected' && (
              <div className="calendar-connected-area">
                <div className="calendar-connected-heading">
                  <span><CalendarCheck size={17} /><strong>Upcoming events</strong><small>{activeRangeLabel}</small></span>
                  <div className="calendar-connected-actions">
                    <a className="button secondary small-button calendar-open-link" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">
                      <ExternalLink size={15} /> Open Google Calendar
                    </a>
                    <button className="button secondary small-button" disabled={loading} onClick={() => void loadEvents(rangeDays)}><RefreshCw className={loading ? 'spin' : ''} size={15} /> Refresh</button>
                  </div>
                </div>

                <div className="calendar-range-toolbar" aria-label="Calendar lookahead range">
                  <span>Look ahead</span>
                  <div className="calendar-range-switch">
                    {calendarRanges.map((range) => (
                      <button
                        className={rangeDays === range.days ? 'active' : ''}
                        type="button"
                        disabled={loading}
                        key={range.days}
                        onClick={() => changeCalendarRange(range.days)}
                        aria-pressed={rangeDays === range.days}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loading && <div className="live-event-loading calendar-range-loading"><Loader2 className="spin" size={19} /> Loading {activeRangeLabel.toLowerCase()}…</div>}
                {!loading && events.length === 0 && <div className="live-event-empty"><CalendarDays size={24} /><strong>No upcoming events in this range</strong><span>Try a longer range, import an Apple invitation, paste a public event link, or enter the event manually.</span></div>}
                {!loading && events.length > 0 && (
                  <div className="live-event-list">
                    {events.map((event) => (
                      <article className={event.matchesCard ? 'live-event-card matches-card' : 'live-event-card'} key={event.id}>
                        <div className="live-event-card-topline">
                          <span className="calendar-relevance-pill">{event.matchesCard ? 'Matches current card' : calendarBadgeLabel(event, rangeDays)}</span>
                          {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
                        </div>
                        <h3>{event.title}</h3>
                        <div className="live-event-meta">
                          <span><CalendarDays size={15} /> {eventTimeLabel(event)}</span>
                          <span><MapPin size={15} /> {event.location || 'No venue listed'}</span>
                        </div>
                        <button className="button primary full-button" onClick={() => launchEventCard(event)}><Sparkles size={17} /> Make this my Event QR</button>
                      </article>
                    ))}
                  </div>
                )}
                <button className="text-button live-event-disconnect" onClick={disconnect}><Unplug size={13} /> Disconnect Google</button>
              </div>
            )}

            {error && <div className="inline-error">{error}</div>}
          </div>
        )}
      </section>

      <EventImportPanel profile={profile} onChange={onChange} onOpenCards={onOpenCards} />

      <section className="live-event-explainer">
        <strong>What happens after you create the event?</strong>
        <span>TagOnce opens My QR Cards in Event mode, adds the event context, and expires the temporary card at the event end time.</span>
      </section>
    </div>
  );
}

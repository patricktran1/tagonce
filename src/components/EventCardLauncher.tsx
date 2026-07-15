import {
  CalendarCheck,
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarEventSuggestions,
  getCalendarStatus,
  type CalendarConnectionState,
  type CalendarEventSuggestion,
} from '../lib/calendarService';
import type { MyProfile } from '../types';

interface EventCardLauncherProps {
  profile: MyProfile;
  onChange: (profile: MyProfile) => void;
  onOpenCards: () => void;
}

const relevanceLabels: Record<CalendarEventSuggestion['relevance'], string> = {
  happening_now: 'Happening now',
  starting_soon: 'Starting soon',
  recently_ended: 'Just ended',
  today: 'Today',
};

function eventTimeLabel(event: CalendarEventSuggestion) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day.format(start)} · ${time.format(start)}–${time.format(end)}`;
}

function localDateValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function EventCardLauncher({ profile, onChange, onOpenCards }: EventCardLauncherProps) {
  const [state, setState] = useState<CalendarConnectionState>('checking');
  const [events, setEvents] = useState<CalendarEventSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleEmail, setGoogleEmail] = useState(profile.email || '');

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      const response = await getCalendarEventSuggestions(profile.eventName || '');
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
      setEvents(response.events || []);
    } catch (loadError) {
      setState('connected');
      setError(loadError instanceof Error ? loadError.message : 'Calendar events could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const oauthResult = new URLSearchParams(window.location.search).get('calendar');
      if (oauthResult === 'cancelled') setError('Google Calendar connection was cancelled.');
      if (oauthResult && !['connected', 'cancelled'].includes(oauthResult)) {
        setError('Google Calendar could not be connected. Check the OAuth redirect setup and try again.');
      }

      try {
        const status = await getCalendarStatus();
        if (cancelled) return;
        if (!status.configured) {
          setState('unconfigured');
          return;
        }
        if (!status.connected) {
          setState('disconnected');
          return;
        }
        await loadEvents();
      } catch (statusError) {
        if (!cancelled) {
          setState('disconnected');
          setError(statusError instanceof Error ? statusError.message : 'Calendar connection could not be checked.');
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  function connect(useEmailHint: boolean) {
    setState('connecting');
    setError('');
    connectGoogleCalendar('event', useEmailHint ? googleEmail : '');
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

    onChange({
      ...profile,
      eventName: event.title,
      eventEndsAt: localDateValue(event.end),
      cardSelections: {
        ...profile.cardSelections,
        event: nextEventSelection,
      },
    });
    onOpenCards();
  }

  return (
    <div className="page-stack live-event-page">
      <section className="live-event-hero">
        <div>
          <span className="hero-kicker">Calendar-powered identity</span>
          <h2>Walk into an event with the right card already loaded.</h2>
          <p>
            TagOnce finds the event happening around you, then turns it into an Event QR preset with
            the correct name and expiration. Luma registrations work when they appear in Google Calendar.
          </p>
        </div>
        <span className="live-event-orbit"><CalendarDays size={32} /></span>
      </section>

      <section className="panel live-event-panel">
        <div className="panel-heading live-event-panel-heading">
          <div>
            <span className="step-badge">LIVE</span>
            <div><h3>Nearby calendar events</h3><p>Current, recently ended and soon-starting events are ranked first.</p></div>
          </div>
          {state === 'connected' && (
            <button className="button secondary small-button" disabled={loading} onClick={loadEvents}>
              <RefreshCw className={loading ? 'spin' : ''} size={15} /> Refresh
            </button>
          )}
        </div>

        {(state === 'checking' || state === 'connecting' || loading) && (
          <div className="live-event-loading"><Loader2 className="spin" size={19} />
            {state === 'connecting' ? 'Taking you to Google Calendar…' : 'Checking your calendar…'}
          </div>
        )}

        {state === 'unconfigured' && !loading && (
          <div className="live-event-connect muted-calendar-state">
            <span className="calendar-detection-icon"><CalendarDays size={22} /></span>
            <div>
              <h3>Calendar connection is temporarily unavailable</h3>
              <p>The TagOnce deployment needs its Google OAuth client secret and callback configuration. No user setup is required.</p>
            </div>
          </div>
        )}

        {state === 'disconnected' && !loading && (
          <div className="live-event-connect">
            <span className="calendar-detection-icon"><CalendarCheck size={22} /></span>
            <div>
              <h3>Connect Google Calendar</h3>
              <p>Read-only access. Entering your Google email skips the account chooser when Safari gets stuck there.</p>
              <div className="calendar-account-connect">
                <label htmlFor="calendar-google-email">Google account email</label>
                <div className="calendar-account-row">
                  <input
                    id="calendar-google-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@gmail.com"
                    value={googleEmail}
                    onChange={(event) => setGoogleEmail(event.target.value)}
                  />
                  <button
                    className="button primary"
                    disabled={!validEmail(googleEmail)}
                    onClick={() => connect(true)}
                  >
                    <CalendarCheck size={17} /> Continue
                  </button>
                </div>
                <span className="calendar-account-help">Used only to tell Google which signed-in account to open. TagOnce does not store it separately.</span>
                <button className="text-button calendar-choose-account" onClick={() => connect(false)}>
                  Choose from signed-in accounts instead
                </button>
              </div>
            </div>
          </div>
        )}

        {state === 'connected' && !loading && events.length === 0 && (
          <div className="live-event-empty">
            <CalendarDays size={24} />
            <strong>No nearby event found</strong>
            <span>Create a timed event happening now or within the next three hours, then refresh.</span>
          </div>
        )}

        {state === 'connected' && !loading && events.length > 0 && (
          <div className="live-event-list">
            {events.map((event) => (
              <article className={event.matchesCard ? 'live-event-card matches-card' : 'live-event-card'} key={event.id}>
                <div className="live-event-card-topline">
                  <span className="calendar-relevance-pill">{event.matchesCard ? 'Matches current card' : relevanceLabels[event.relevance]}</span>
                  {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
                </div>
                <h3>{event.title}</h3>
                <div className="live-event-meta">
                  <span><CalendarDays size={15} /> {eventTimeLabel(event)}</span>
                  <span><MapPin size={15} /> {event.location || 'No venue listed'}</span>
                </div>
                <button className="button primary full-button" onClick={() => launchEventCard(event)}>
                  <Sparkles size={17} /> Make this my Event QR
                </button>
              </article>
            ))}
          </div>
        )}

        {state === 'connected' && (
          <button className="text-button live-event-disconnect" onClick={disconnect}><Unplug size={13} /> Disconnect calendar</button>
        )}
        {error && <div className="inline-error">{error}</div>}
      </section>

      <section className="live-event-explainer">
        <strong>What happens after you choose an event?</strong>
        <span>TagOnce opens My QR Cards in Event mode, selects event context, and expires the card after the event date.</span>
      </section>
    </div>
  );
}

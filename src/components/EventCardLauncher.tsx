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
  getRememberedGoogleCalendarAccount,
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

const oauthResultMessages: Record<string, string> = {
  cancelled: 'Google connection was cancelled.',
  invalid_state: 'Google returned to TagOnce, but the secure authorization state was invalid or expired. Start the connection again.',
  authorization_incomplete: 'Google returned without a complete authorization code. Start the connection again.',
  client_credentials: 'The Google client secret in Vercel does not match the OAuth client ID.',
  redirect_mismatch: 'Google rejected the callback address. Confirm the OAuth client contains https://tagonce.vercel.app/api/google-calendar/callback.',
  authorization_expired: 'The Google authorization code expired before it could be exchanged. Start the connection again.',
  token_exchange: 'Google approved access, but TagOnce could not exchange the authorization code. Retry once.',
  identity_token: 'Google approved access, but TagOnce could not verify the Google identity. Retry once.',
  identity_email: 'Google did not return a verified email address for this account.',
  session_error: 'Google approved access, but TagOnce could not create the encrypted Calendar session.',
  google_error: 'Google returned an authorization error. Start the connection again.',
  unconfigured: 'The TagOnce deployment is missing one or more Google Calendar environment variables.',
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
  const initialRememberedAccount = getRememberedGoogleCalendarAccount();
  const [state, setState] = useState<CalendarConnectionState>('checking');
  const [events, setEvents] = useState<CalendarEventSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberedGoogleEmail, setRememberedGoogleEmail] = useState(initialRememberedAccount);
  const [googleEmail, setGoogleEmail] = useState(initialRememberedAccount || profile.email || '');
  const [showEmailFallback, setShowEmailFallback] = useState(false);

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
      const oauthResult = new URLSearchParams(window.location.search).get('calendar') || '';
      const verifiedAccount = getRememberedGoogleCalendarAccount();
      if (validEmail(verifiedAccount)) {
        setRememberedGoogleEmail(verifiedAccount);
        setGoogleEmail(verifiedAccount);
      }

      const callbackMessage = oauthResultMessages[oauthResult] || (
        oauthResult && oauthResult !== 'connected'
          ? `Google returned an unexpected result: ${oauthResult}.`
          : ''
      );

      try {
        const status = await getCalendarStatus();
        if (cancelled) return;
        if (!status.configured) {
          setState('unconfigured');
          setError(callbackMessage || oauthResultMessages.unconfigured);
          return;
        }
        if (!status.connected) {
          setState('disconnected');
          if (oauthResult === 'connected') {
            setError('Google approved access, but TagOnce could not read the secure session. Reload once and reconnect.');
          } else if (callbackMessage) {
            setError(callbackMessage);
          }
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

  function connectWithGoogle() {
    if (!validEmail(rememberedGoogleEmail)) {
      setShowEmailFallback(true);
      setError('Confirm your Google account once. After Google verifies it, TagOnce will remember that account for one-click reconnects.');
      return;
    }
    setState('connecting');
    setError('');
    connectGoogleCalendar('event', rememberedGoogleEmail);
  }

  function connectWithEmail() {
    setState('connecting');
    setError('');
    connectGoogleCalendar('event', googleEmail);
  }

  async function disconnect() {
    await disconnectGoogleCalendar();
    const verifiedAccount = getRememberedGoogleCalendarAccount();
    setRememberedGoogleEmail(verifiedAccount);
    if (verifiedAccount) setGoogleEmail(verifiedAccount);
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
            {state === 'connecting' ? 'Taking you to Google…' : 'Checking your calendar…'}
          </div>
        )}

        {state === 'unconfigured' && !loading && (
          <div className="live-event-connect muted-calendar-state">
            <span className="calendar-detection-icon"><CalendarDays size={22} /></span>
            <div>
              <h3>Google connection is temporarily unavailable</h3>
              <p>The TagOnce deployment needs its Google OAuth client secret and session configuration.</p>
            </div>
          </div>
        )}

        {state === 'disconnected' && !loading && (
          <div className="live-event-connect">
            <span className="calendar-detection-icon"><CalendarCheck size={22} /></span>
            <div>
              <h3>Connect with Google</h3>
              <p>Approve read-only access to event titles, times and locations.</p>
              <div className="google-calendar-primary-connect">
                <button className="google-oauth-button" type="button" onClick={connectWithGoogle}>
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
                {validEmail(rememberedGoogleEmail) ? (
                  <span>Continue as {rememberedGoogleEmail}</span>
                ) : (
                  <span>First connection: confirm the Google account once below.</span>
                )}
                <small>TagOnce can read your Calendar. It cannot edit it.</small>
              </div>

              <button
                className="text-button calendar-fallback-toggle"
                type="button"
                onClick={() => {
                  setShowEmailFallback((current) => !current);
                  setError('');
                }}
              >
                {showEmailFallback ? 'Hide account options' : validEmail(rememberedGoogleEmail) ? 'Use another Google account' : 'Choose Google account'}
              </button>

              {showEmailFallback && (
                <div className="calendar-account-connect calendar-email-fallback">
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
                      onClick={connectWithEmail}
                    >
                      <CalendarCheck size={17} /> Continue
                    </button>
                  </div>
                  <span className="calendar-account-help">Google verifies this account during authorization. TagOnce remembers only the verified account for future reconnects.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {state === 'connected' && !loading && events.length === 0 && (
          <div className="live-event-empty">
            <CalendarDays size={24} />
            <strong>Google Calendar connected</strong>
            <span>No nearby event was found. Create a timed event happening now or within the next three hours, then refresh.</span>
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
          <button className="text-button live-event-disconnect" onClick={disconnect}><Unplug size={13} /> Disconnect Google</button>
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

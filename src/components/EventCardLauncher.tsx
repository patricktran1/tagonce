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
  authorizeGoogleCalendar,
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

export function EventCardLauncher({ profile, onChange, onOpenCards }: EventCardLauncherProps) {
  const [state, setState] = useState<CalendarConnectionState>('checking');
  const [events, setEvents] = useState<CalendarEventSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      const response = await getCalendarEventSuggestions(profile.eventName || '');
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
      const status = await getCalendarStatus();
      if (cancelled) return;
      if (!status.connected) {
        setState('disconnected');
        return;
      }
      await loadEvents();
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  async function connect() {
    setState('connecting');
    setError('');
    try {
      await authorizeGoogleCalendar();
      setState('connected');
      await loadEvents();
    } catch (connectError) {
      setState('disconnected');
      setError(connectError instanceof Error ? connectError.message : 'Google Calendar could not be connected.');
    }
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
            {state === 'connecting' ? 'Opening Google Calendar permission…' : 'Checking your calendar…'}
          </div>
        )}

        {state === 'disconnected' && !loading && (
          <div className="live-event-connect">
            <span className="calendar-detection-icon"><CalendarCheck size={22} /></span>
            <div>
              <h3>Connect Google Calendar</h3>
              <p>Read-only access. TagOnce sees event titles, times and locations but cannot change your calendar.</p>
              <button className="button primary" onClick={connect}><CalendarCheck size={17} /> Connect calendar</button>
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

        {state === 'connected' && events.length > 0 && (
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

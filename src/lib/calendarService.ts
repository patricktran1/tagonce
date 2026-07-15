export type CalendarConnectionState = 'checking' | 'connected' | 'disconnected' | 'unconfigured';

export interface CalendarStatusResponse {
  configured: boolean;
  connected: boolean;
  scope?: string;
}

export interface CalendarEventSuggestion {
  id: string;
  title: string;
  location: string;
  description: string;
  start: string;
  end: string;
  htmlLink?: string;
  relevance: 'happening_now' | 'starting_soon' | 'recently_ended' | 'today';
  matchesCard: boolean;
}

interface CalendarEventResponse extends CalendarStatusResponse {
  checkedAt?: string;
  events: CalendarEventSuggestion[];
  reconnect?: boolean;
  error?: string;
}

async function readJson<T>(response: Response) {
  const payload = await response.json().catch(() => ({})) as T;
  return { response, payload };
}

export async function getCalendarStatus() {
  const { response, payload } = await readJson<CalendarStatusResponse>(
    await fetch('/api/google-calendar/status', { credentials: 'include', cache: 'no-store' }),
  );
  if (!response.ok) throw new Error('Calendar connection status could not be checked.');
  return payload;
}

export async function getCalendarEventSuggestions(eventName = '') {
  const params = new URLSearchParams();
  if (eventName.trim()) params.set('eventName', eventName.trim());
  const suffix = params.size ? `?${params.toString()}` : '';
  const { response, payload } = await readJson<CalendarEventResponse>(
    await fetch(`/api/google-calendar/active-event${suffix}`, {
      credentials: 'include',
      cache: 'no-store',
    }),
  );

  if (!response.ok && response.status !== 401) {
    throw new Error(payload.error || 'Calendar events could not be loaded.');
  }
  return payload;
}

export function connectGoogleCalendar() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/api/google-calendar/connect?returnTo=${encodeURIComponent(returnTo)}`);
}

export async function disconnectGoogleCalendar() {
  const { response } = await readJson<{ connected: boolean }>(
    await fetch('/api/google-calendar/disconnect', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    }),
  );
  if (!response.ok) throw new Error('Google Calendar could not be disconnected.');
}

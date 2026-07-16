export type CalendarConnectionState = 'checking' | 'connecting' | 'connected' | 'disconnected' | 'unconfigured';

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
  allDay?: boolean;
  relevance: 'happening_now' | 'starting_soon' | 'recently_ended' | 'today';
  matchesCard: boolean;
}

interface CalendarEventResponse extends CalendarStatusResponse {
  checkedAt?: string;
  events: CalendarEventSuggestion[];
  reconnect?: boolean;
  error?: string;
}

const CALENDAR_RETURN_KEY = 'tagonce.calendar.return.v2';
const GOOGLE_ACCOUNT_KEY = 'tagonce.google.calendar.account.v1';

function validEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readJson<T>(response: Response) {
  const payload = await response.json().catch(() => ({})) as T;
  return { response, payload };
}

export function getRememberedGoogleCalendarAccount() {
  if (typeof window === 'undefined') return '';
  try {
    const value = window.localStorage.getItem(GOOGLE_ACCOUNT_KEY) || '';
    return validEmail(value) ? value : '';
  } catch {
    return '';
  }
}

export function rememberGoogleCalendarAccount(email: string) {
  if (typeof window === 'undefined' || !validEmail(email)) return;
  try {
    window.localStorage.setItem(GOOGLE_ACCOUNT_KEY, email.trim().toLowerCase());
  } catch {
    // Calendar OAuth still works when local storage is unavailable.
  }
}

export function clearRememberedGoogleCalendarAccount() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
  } catch {
    // The secure Calendar session can still be disconnected independently.
  }
}

export function restoreGoogleCalendarReturn() {
  if (typeof window === 'undefined') return;
  const current = new URL(window.location.href);
  const result = current.searchParams.get('calendar');
  const verifiedGoogleAccount = current.searchParams.get('google_account') || '';
  if (verifiedGoogleAccount) rememberGoogleCalendarAccount(verifiedGoogleAccount);
  if (!result) return;

  let saved = '';
  try {
    saved = window.sessionStorage.getItem(CALENDAR_RETURN_KEY) || '';
    window.sessionStorage.removeItem(CALENDAR_RETURN_KEY);
  } catch {
    // The callback can still open the Event Launcher without session storage.
  }

  if (!saved) {
    current.searchParams.delete('google_account');
    window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    return;
  }

  try {
    const target = new URL(saved, window.location.origin);
    if (target.origin !== window.location.origin) return;
    target.searchParams.set('calendar', result);
    window.history.replaceState({}, '', `${target.pathname}${target.search}${target.hash}`);
  } catch {
    // Ignore an invalid saved target and keep the callback URL.
  }
}

export function rememberGoogleCalendarReturn(returnView?: unknown) {
  const returnTo = returnView === 'event'
    ? '/?view=event'
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  try {
    window.sessionStorage.setItem(CALENDAR_RETURN_KEY, returnTo);
  } catch {
    // OAuth still works; only the exact SPA return target may be unavailable.
  }
}

export async function getCalendarStatus() {
  const { response, payload } = await readJson<CalendarStatusResponse>(
    await fetch('/api/google-calendar/status', {
      credentials: 'include',
      cache: 'no-store',
    }),
  );
  if (!response.ok) throw new Error('Calendar connection status could not be checked.');
  return payload;
}

export async function getCalendarEventSuggestions(eventName = '') {
  const params = new URLSearchParams({ localDate: localDateKey() });
  if (eventName.trim()) params.set('eventName', eventName.trim());
  const { response, payload } = await readJson<CalendarEventResponse>(
    await fetch(`/api/google-calendar/active-event?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    }),
  );

  if (!response.ok && response.status !== 401 && response.status !== 503) {
    throw new Error(payload.error || 'Calendar events could not be loaded.');
  }
  return payload;
}

export function connectGoogleCalendar(
  returnView?: unknown,
  loginHint = '',
  selectAccount = false,
  enableSync = false,
) {
  rememberGoogleCalendarReturn(returnView);

  const target = new URL('/api/google-calendar/connect', window.location.origin);
  const normalizedHint = loginHint.trim();
  if (normalizedHint) target.searchParams.set('login_hint', normalizedHint);
  if (selectAccount) target.searchParams.set('select_account', '1');
  if (enableSync) target.searchParams.set('enable_sync', '1');
  window.location.assign(`${target.pathname}${target.search}`);
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

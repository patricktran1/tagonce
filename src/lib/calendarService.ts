import type { GoogleAccountIdentity } from '../types';

export type CalendarConnectionState = 'checking' | 'connecting' | 'connected' | 'disconnected' | 'unconfigured';
export type CalendarRangeDays = 1 | 7 | 30;

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
  relevance: 'happening_now' | 'starting_soon' | 'recently_ended' | 'today' | 'upcoming';
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
const GOOGLE_IDENTITY_KEY = 'tagonce.google.identity.v1';

function validEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safePicture(value = '') {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
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
  return getRememberedGoogleIdentity()?.email || '';
}

export function getRememberedGoogleIdentity(): GoogleAccountIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(GOOGLE_IDENTITY_KEY) || 'null') as GoogleAccountIdentity | null;
    if (!value || !validEmail(value.email)) return null;
    return {
      email: value.email.trim().toLowerCase(),
      displayName: value.displayName?.trim() || undefined,
      picture: safePicture(value.picture) || undefined,
    };
  } catch {
    const legacy = window.localStorage.getItem(GOOGLE_ACCOUNT_KEY) || '';
    return validEmail(legacy) ? { email: legacy.trim().toLowerCase() } : null;
  }
}

export function rememberGoogleIdentity(identity: GoogleAccountIdentity) {
  if (typeof window === 'undefined' || !validEmail(identity.email)) return;
  const normalized: GoogleAccountIdentity = {
    email: identity.email.trim().toLowerCase(),
    displayName: identity.displayName?.trim() || undefined,
    picture: safePicture(identity.picture) || undefined,
  };
  try {
    window.localStorage.setItem(GOOGLE_ACCOUNT_KEY, normalized.email);
    window.localStorage.setItem(GOOGLE_IDENTITY_KEY, JSON.stringify(normalized));
  } catch {
    // The secure Google session remains active when local storage is unavailable.
  }
}

export function clearRememberedGoogleCalendarAccount() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
    window.localStorage.removeItem(GOOGLE_IDENTITY_KEY);
  } catch {
    // The secure Google session can still be disconnected independently.
  }
}

export function restoreGoogleCalendarReturn() {
  if (typeof window === 'undefined') return;
  const current = new URL(window.location.href);
  const result = current.searchParams.get('calendar');
  const email = current.searchParams.get('google_account') || '';
  const displayName = current.searchParams.get('google_name') || '';
  const picture = current.searchParams.get('google_picture') || '';
  if (validEmail(email)) rememberGoogleIdentity({ email, displayName, picture });
  if (!result) return;

  let saved = '';
  try {
    saved = window.sessionStorage.getItem(CALENDAR_RETURN_KEY) || '';
    window.sessionStorage.removeItem(CALENDAR_RETURN_KEY);
  } catch {
    // The callback can still open the dashboard without session storage.
  }

  const cleanup = (url: URL) => {
    url.searchParams.delete('google_account');
    url.searchParams.delete('google_name');
    url.searchParams.delete('google_picture');
    return `${url.pathname}${url.search}${url.hash}`;
  };

  if (!saved) {
    window.history.replaceState({}, '', cleanup(current));
    return;
  }

  try {
    const target = new URL(saved, window.location.origin);
    if (target.origin !== window.location.origin) return;
    target.searchParams.set('calendar', result);
    window.history.replaceState({}, '', cleanup(target));
  } catch {
    window.history.replaceState({}, '', cleanup(current));
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
  if (!response.ok) throw new Error('Google connection status could not be checked.');
  return payload;
}

export async function getCalendarEventSuggestions(
  eventName = '',
  rangeDays: CalendarRangeDays = 1,
) {
  const params = new URLSearchParams({
    localDate: localDateKey(),
    days: String(rangeDays),
  });
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

export function connectGoogleCalendar(returnView?: unknown, loginHint = '', selectAccount = false) {
  rememberGoogleCalendarReturn(returnView);

  const target = new URL('/api/google-calendar/connect', window.location.origin);
  const normalizedHint = loginHint.trim();
  if (normalizedHint) target.searchParams.set('login_hint', normalizedHint);
  if (selectAccount) target.searchParams.set('select_account', '1');
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
  if (!response.ok) throw new Error('Google could not be disconnected.');
}

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
  relevance: 'happening_now' | 'starting_soon' | 'recently_ended' | 'today';
  matchesCard: boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface StoredCalendarToken {
  accessToken: string;
  expiresAt: number;
  clientId: string;
  scope?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  eventType?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: unknown) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleOauth2Api {
  initTokenClient: (options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: unknown) => void;
  }) => GoogleTokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOauth2Api } };
  }
}

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const GOOGLE_SCRIPT_ID = 'tagonce-google-identity';
const TOKEN_KEY = 'tagonce.google.calendar.token.v3';
const LEGACY_TOKEN_KEY = 'tagonce.google.calendar.token.v2';
const LEGACY_CLIENT_ID_KEY = 'tagonce.google.calendar.client-id.v1';
let scriptPromise: Promise<void> | null = null;

function configuredClientId() {
  const environment = import.meta.env as Record<string, string | undefined>;
  return environment.VITE_GOOGLE_CALENDAR_CLIENT_ID?.trim() || '';
}

function clearLegacyDeveloperConfig() {
  try {
    window.localStorage.removeItem(LEGACY_CLIENT_ID_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function readToken(): StoredCalendarToken | null {
  const clientId = configuredClientId();
  if (!clientId) return null;

  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as StoredCalendarToken;
    if (
      !token.accessToken
      || token.clientId !== clientId
      || !Number.isFinite(token.expiresAt)
      || token.expiresAt <= Date.now() + 30_000
    ) {
      window.localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function saveToken(response: GoogleTokenResponse, clientId: string) {
  if (!response.access_token) {
    throw new Error(response.error_description || response.error || 'Google returned no access token.');
  }
  const token: StoredCalendarToken = {
    accessToken: response.access_token,
    expiresAt: Date.now() + Math.max(60, response.expires_in || 3600) * 1000,
    clientId,
    scope: response.scope,
  };
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google authorization could not be loaded.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google authorization could not be loaded.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function authorizationFailure(error: unknown) {
  if (error && typeof error === 'object' && 'type' in error) {
    const type = String((error as { type?: unknown }).type || '');
    if (type === 'popup_failed_to_open') return new Error('Google sign-in was blocked by the browser. Allow pop-ups for TagOnce and try again.');
    if (type === 'popup_closed') return new Error('Google Calendar connection was cancelled.');
  }
  return new Error('Google Calendar authorization was cancelled or blocked.');
}

export async function getCalendarStatus(): Promise<CalendarStatusResponse> {
  clearLegacyDeveloperConfig();
  const clientId = configuredClientId();
  if (!clientId) return { configured: false, connected: false };
  const token = readToken();
  return { configured: true, connected: Boolean(token), scope: token?.scope };
}

export async function authorizeGoogleCalendar() {
  clearLegacyDeveloperConfig();
  const clientId = configuredClientId();
  if (!clientId) {
    throw new Error('Google Calendar is not configured for this TagOnce deployment. The app owner must add VITE_GOOGLE_CALENDAR_CLIENT_ID in Vercel and redeploy.');
  }
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('The deployed Google OAuth client ID is invalid. The app owner must correct VITE_GOOGLE_CALENDAR_CLIENT_ID in Vercel.');
  }

  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google authorization is unavailable in this browser.');

  return new Promise<CalendarStatusResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response) => {
        try {
          const token = saveToken(response, clientId);
          resolve({ configured: true, connected: true, scope: token.scope });
        } catch (error) {
          reject(error);
        }
      },
      error_callback: (error) => reject(authorizationFailure(error)),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export function connectGoogleCalendar() {
  void authorizeGoogleCalendar()
    .then(() => window.location.reload())
    .catch((error) => {
      window.alert(error instanceof Error ? error.message : 'Google Calendar could not be connected.');
    });
}

export async function disconnectGoogleCalendar() {
  const token = readToken();
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The in-memory connection is still considered disconnected.
  }

  if (!token) return;
  await loadGoogleIdentityScript().catch(() => undefined);
  await new Promise<void>((resolve) => {
    const revoke = window.google?.accounts?.oauth2?.revoke;
    if (!revoke) {
      resolve();
      return;
    }
    revoke(token.accessToken, resolve);
  });
}

function eventTime(value: { dateTime?: string; date?: string } | undefined, end = false) {
  if (value?.dateTime) return Date.parse(value.dateTime);
  if (value?.date) {
    const date = new Date(`${value.date}T00:00:00`);
    if (end) date.setMilliseconds(date.getMilliseconds() - 1);
    return date.getTime();
  }
  return Number.NaN;
}

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function eventNameMatch(summary: string, requested: string) {
  const left = normalize(summary);
  const right = normalize(requested);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function sameLocalDay(left: number, right: number) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function declined(event: GoogleCalendarEvent) {
  return event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === 'declined') ?? false;
}

function rankEvent(event: GoogleCalendarEvent, now: number, requestedEventName: string) {
  const start = eventTime(event.start);
  const end = eventTime(event.end, true);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  const startsIn = (start - now) / 60_000;
  const endedAgo = (now - end) / 60_000;
  let relevance: CalendarEventSuggestion['relevance'];
  let score: number;

  if (start <= now && end >= now) {
    relevance = 'happening_now';
    score = 140;
  } else if (startsIn > 0 && startsIn <= 180) {
    relevance = 'starting_soon';
    score = 105 - startsIn / 6;
  } else if (endedAgo > 0 && endedAgo <= 120) {
    relevance = 'recently_ended';
    score = 80 - endedAgo / 6;
  } else if (sameLocalDay(start, now)) {
    relevance = 'today';
    score = 40;
  } else {
    return null;
  }

  const title = event.summary?.trim() || 'Calendar event';
  if (event.location?.trim()) score += 18;
  if (requestedEventName && eventNameMatch(title, requestedEventName)) score += 55;
  if (event.eventType === 'fromGmail') score += 6;
  if (event.transparency === 'transparent') score -= 15;
  if (event.start?.date) score -= 12;

  return {
    id: event.id || `${title}-${start}`,
    title,
    location: event.location?.trim() || '',
    description: event.description?.trim() || '',
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    htmlLink: event.htmlLink,
    relevance,
    matchesCard: Boolean(requestedEventName && eventNameMatch(title, requestedEventName)),
    score,
  };
}

export async function getCalendarEventSuggestions(eventName = '') {
  const clientId = configuredClientId();
  if (!clientId) {
    return { configured: false, connected: false, events: [] as CalendarEventSuggestion[] };
  }

  const token = readToken();
  if (!token) {
    return { configured: true, connected: false, events: [] as CalendarEventSuggestion[] };
  }

  const now = Date.now();
  const params = new URLSearchParams({
    timeMin: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
    showDeleted: 'false',
  });

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as GoogleCalendarListResponse;

  if (response.status === 401 || response.status === 403) {
    window.localStorage.removeItem(TOKEN_KEY);
    return {
      configured: true,
      connected: false,
      events: [] as CalendarEventSuggestion[],
      reconnect: true,
      error: payload.error?.message || 'Google Calendar needs to be reconnected.',
    };
  }
  if (!response.ok) throw new Error(payload.error?.message || 'Calendar events could not be loaded.');

  const events = (payload.items || [])
    .filter((event) => event.status !== 'cancelled' && !declined(event))
    .map((event) => rankEvent(event, now, eventName.trim()))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score: _score, ...event }) => event);

  return {
    configured: true,
    connected: true,
    checkedAt: new Date(now).toISOString(),
    events,
  };
}

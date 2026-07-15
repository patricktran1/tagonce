type CalendarSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEvent = {
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
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
};

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const SESSION_COOKIE = 'tagonce_calendar_session';
const STATE_COOKIE = 'tagonce_calendar_state';

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function config(request: Request) {
  const clientId = (
    process.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
    || process.env.GOOGLE_CALENDAR_CLIENT_ID
    || ''
  ).trim();
  const clientSecret = (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  const sessionSecret = (process.env.CALENDAR_SESSION_SECRET || clientSecret).trim();
  const redirectUri = (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
    || `${new URL(request.url).origin}/api/google-calendar/callback`
  ).trim();
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, sessionSecret, redirectUri };
}

function parseCookies(request: Request) {
  const values = new Map<string, string>();
  const header = request.headers.get('cookie') || '';
  header.split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) return;
    try {
      values.set(name, decodeURIComponent(value));
    } catch {
      values.set(name, value);
    }
  });
  return values;
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name: string) {
  return cookie(name, '', 0);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSession(session: CalendarSession, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(secret),
    plaintext,
  ));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return base64UrlEncode(packed);
}

async function decryptSession(value: string | undefined, secret: string): Promise<CalendarSession | null> {
  if (!value) return null;
  try {
    const packed = base64UrlDecode(value);
    if (packed.length < 29) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, 12) },
      await encryptionKey(secret),
      packed.slice(12),
    );
    const session = JSON.parse(new TextDecoder().decode(plaintext)) as CalendarSession;
    return session.accessToken && Number.isFinite(session.expiresAt) ? session : null;
  } catch {
    return null;
  }
}

function randomState() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
}

async function refreshSession(session: CalendarSession, appConfig: NonNullable<ReturnType<typeof config>>) {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) throw new Error('Google Calendar needs to be reconnected.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appConfig.clientId,
      client_secret: appConfig.clientSecret,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google Calendar needs to be reconnected.');
  }
  return {
    ...session,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in || 3600) * 1000,
    scope: payload.scope || session.scope,
  };
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
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
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
  let relevance: 'happening_now' | 'starting_soon' | 'recently_ended' | 'today';
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

async function handleEvents(request: Request, appConfig: NonNullable<ReturnType<typeof config>>) {
  const cookies = parseCookies(request);
  const stored = await decryptSession(cookies.get(SESSION_COOKIE), appConfig.sessionSecret);
  if (!stored) return json({ configured: true, connected: false, events: [] }, 401);

  try {
    const session = await refreshSession(stored, appConfig);
    const now = Date.now();
    const url = new URL(request.url);
    const params = new URLSearchParams({
      timeMin: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
      showDeleted: 'false',
    });
    const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const payload = await googleResponse.json().catch(() => ({})) as GoogleCalendarListResponse;
    if (!googleResponse.ok) throw new Error(payload.error?.message || 'Calendar events could not be loaded.');

    const requested = url.searchParams.get('eventName')?.trim() || '';
    const events = (payload.items || [])
      .filter((event) => event.status !== 'cancelled' && !declined(event))
      .map((event) => rankEvent(event, now, requested))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ score: _score, ...event }) => event);

    const headers = new Headers();
    if (session.accessToken !== stored.accessToken || session.expiresAt !== stored.expiresAt) {
      headers.append('Set-Cookie', cookie(
        SESSION_COOKIE,
        await encryptSession(session, appConfig.sessionSecret),
        60 * 60 * 24 * 180,
      ));
    }
    return json({ configured: true, connected: true, checkedAt: new Date(now).toISOString(), events }, 200, headers);
  } catch (error) {
    return json({
      configured: true,
      connected: false,
      reconnect: true,
      events: [],
      error: error instanceof Error ? error.message : 'Google Calendar needs to be reconnected.',
    }, 401, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
  }
}

export default {
  async fetch(request: Request) {
    const appConfig = config(request);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'connect';

    if (action === 'status') {
      if (!appConfig) return json({ configured: false, connected: false });
      const session = await decryptSession(parseCookies(request).get(SESSION_COOKIE), appConfig.sessionSecret);
      return json({ configured: true, connected: Boolean(session), scope: session?.scope });
    }

    if (action === 'disconnect') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return json({ connected: false }, 200, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
    }

    if (action === 'events') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!appConfig) return json({ configured: false, connected: false, events: [] }, 503);
      return handleEvents(request, appConfig);
    }

    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (!appConfig) return json({ error: 'Google Calendar server authorization is not configured.' }, 503);

    const state = randomState();
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: appConfig.clientId,
      redirect_uri: appConfig.redirectUri,
      response_type: 'code',
      scope: CALENDAR_SCOPE,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizationUrl.toString(),
        'Cache-Control': 'no-store',
        'Set-Cookie': cookie(STATE_COOKIE, state, 600),
      },
    });
  },
};
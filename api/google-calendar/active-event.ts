import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SESSION_COOKIE,
  clearCookie,
  decryptSession,
  getCalendarConfig,
  parseCookies,
  queryValue,
  refreshCalendarSession,
  sendJson,
  sessionCookie,
} from './_shared';

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

interface CalendarListResponse {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
}

type Relevance = 'happening_now' | 'starting_soon' | 'recently_ended' | 'today';

function eventTime(value: { dateTime?: string; date?: string } | undefined, end = false) {
  if (value?.dateTime) return Date.parse(value.dateTime);
  if (value?.date) {
    const suffix = end ? 'T23:59:59Z' : 'T00:00:00Z';
    return Date.parse(`${value.date}${suffix}`);
  }
  return Number.NaN;
}

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function eventNameMatch(summary: string, requested: string) {
  const left = normalize(summary);
  const right = normalize(requested);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
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
  let relevance: Relevance;
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
  } else {
    const today = new Date(now).toISOString().slice(0, 10);
    const eventDay = event.start?.date || (event.start?.dateTime ? event.start.dateTime.slice(0, 10) : '');
    if (today !== eventDay) return null;
    relevance = 'today';
    score = 40;
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

async function fetchEvents(accessToken: string) {
  const now = Date.now();
  const params = new URLSearchParams({
    timeMin: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
    showDeleted: 'false',
  });
  params.append('eventTypes', 'default');
  params.append('eventTypes', 'fromGmail');

  return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed' }, 405);
  }

  const config = getCalendarConfig(request);
  if (!config) {
    return sendJson(response, { configured: false, connected: false, events: [] }, 503);
  }

  const cookies = parseCookies(request);
  const encrypted = cookies.get(SESSION_COOKIE);
  const storedSession = decryptSession(encrypted, config.sessionSecret);
  if (!storedSession) {
    return sendJson(response, { configured: true, connected: false, events: [] }, 401);
  }

  try {
    const session = await refreshCalendarSession(storedSession, config);
    const googleResponse = await fetchEvents(session.accessToken);
    const payload = await googleResponse.json().catch(() => ({})) as CalendarListResponse;

    if (googleResponse.status === 401 || googleResponse.status === 403) {
      return sendJson(
        response,
        {
          configured: true,
          connected: false,
          reconnect: true,
          events: [],
          error: payload.error?.message || 'Calendar reconnect required.',
        },
        401,
        { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
      );
    }
    if (!googleResponse.ok) {
      return sendJson(
        response,
        {
          configured: true,
          connected: true,
          events: [],
          error: payload.error?.message || 'Calendar events could not be loaded.',
        },
        googleResponse.status,
      );
    }

    const now = Date.now();
    const requestedEventName = queryValue(request, 'eventName')?.trim() || '';
    const events = (payload.items || [])
      .filter((event) => event.status !== 'cancelled' && !declined(event))
      .map((event) => rankEvent(event, now, requestedEventName))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ score: _score, ...event }) => event);

    const headers: Record<string, string> = {};
    if (session.accessToken !== storedSession.accessToken || session.expiresAt !== storedSession.expiresAt) {
      headers['Set-Cookie'] = sessionCookie(session, config.sessionSecret);
    }

    return sendJson(
      response,
      {
        configured: true,
        connected: true,
        checkedAt: new Date(now).toISOString(),
        events,
      },
      200,
      headers,
    );
  } catch (error) {
    console.error('Google Calendar event lookup failed', error);
    return sendJson(
      response,
      {
        configured: true,
        connected: false,
        reconnect: true,
        events: [],
        error: error instanceof Error ? error.message : 'Calendar reconnect required.',
      },
      401,
      { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
    );
  }
}

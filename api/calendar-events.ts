type CalendarEventSuggestion = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  relevance?: string;
  allDay?: boolean;
  [key: string]: unknown;
};

type CalendarEventResponse = {
  configured?: boolean;
  connected?: boolean;
  events?: CalendarEventSuggestion[];
  error?: string;
  [key: string]: unknown;
};

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

function isCalendarApiDisabled(message = '') {
  const normalized = message.toLowerCase();
  return normalized.includes('calendar api has not been used')
    || normalized.includes('calendar api') && normalized.includes('disabled')
    || normalized.includes('calendar-json.googleapis.com');
}

function validDateOnly(value = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validRangeDays(value = '') {
  return value === '1' || value === '7' || value === '30';
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function looksLikeLegacyAllDayEvent(event: CalendarEventSuggestion) {
  return typeof event.start === 'string'
    && typeof event.end === 'string'
    && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(event.start)
    && /^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/.test(event.end);
}

function normalizeAllDayEvents(
  events: CalendarEventSuggestion[],
  localDate: string,
  rangeDays: number,
) {
  return events.flatMap((event) => {
    if (!looksLikeLegacyAllDayEvent(event)) return [event];

    const startDate = event.start!.slice(0, 10);
    const endExclusive = addDays(event.end!.slice(0, 10), 1);
    const rangeEnd = validDateOnly(localDate) ? addDays(localDate, rangeDays) : '';

    if (
      validDateOnly(localDate)
      && !(startDate < rangeEnd && localDate < endExclusive)
    ) {
      return [];
    }

    return [{
      ...event,
      start: startDate,
      end: endExclusive,
      allDay: true,
      relevance: 'today',
    }];
  });
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const requestUrl = new URL(request.url);
    const upstreamUrl = new URL('/api/calendar-connect', request.url);
    upstreamUrl.searchParams.set('action', 'events');
    const requestedEventName = requestUrl.searchParams.get('eventName');
    if (requestedEventName) upstreamUrl.searchParams.set('eventName', requestedEventName);
    const localDate = requestUrl.searchParams.get('localDate') || '';
    if (validDateOnly(localDate)) upstreamUrl.searchParams.set('localDate', localDate);
    const requestedDays = requestUrl.searchParams.get('days') || '';
    const days = validRangeDays(requestedDays) ? requestedDays : '1';
    upstreamUrl.searchParams.set('days', days);

    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({})) as CalendarEventResponse;

    if (isCalendarApiDisabled(payload.error)) {
      return json({
        configured: true,
        connected: true,
        apiEnabled: false,
        events: [],
        error: 'Google Calendar is connected, but the Calendar API still needs to be enabled in the Google Cloud project. Enable it, wait a few minutes, then press Refresh.',
      }, 503);
    }

    const normalizedPayload = {
      ...payload,
      events: normalizeAllDayEvents(payload.events || [], localDate, Number(days)),
    };

    const headers = new Headers();
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) headers.set('Set-Cookie', setCookie);
    return json(normalizedPayload, upstream.status, headers);
  },
};

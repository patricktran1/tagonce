type CalendarEventResponse = {
  configured?: boolean;
  connected?: boolean;
  events?: unknown[];
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

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const upstreamUrl = new URL('/api/calendar-connect', request.url);
    upstreamUrl.searchParams.set('action', 'events');
    const requestedEventName = new URL(request.url).searchParams.get('eventName');
    if (requestedEventName) upstreamUrl.searchParams.set('eventName', requestedEventName);

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

    const headers = new Headers();
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) headers.set('Set-Cookie', setCookie);
    return json(payload, upstream.status, headers);
  },
};

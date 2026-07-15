const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const STATE_COOKIE = 'tagonce_calendar_state';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

function clientId() {
  return (
    process.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
    || process.env.GOOGLE_CALENDAR_CLIENT_ID
    || ''
  ).trim();
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const id = clientId();
    if (!id) return json({ error: 'Google Calendar OAuth client ID is not configured.' }, 503);

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: id,
      redirect_uri: redirectUri,
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
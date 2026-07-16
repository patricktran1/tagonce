const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events.readonly',
].join(' ');

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

function clientId() {
  return (
    process.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
    || process.env.GOOGLE_CALENDAR_CLIENT_ID
    || ''
  ).trim();
}

function signingSecret() {
  return (
    process.env.CALENDAR_SESSION_SECRET
    || process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    || ''
  ).trim();
}

function validLoginHint(value: string | null) {
  const normalized = value?.trim() || '';
  if (!normalized || normalized.length > 254 || /\s/.test(normalized)) return '';
  return /^[^@]+@[^@]+\.[^@]+$/.test(normalized) ? normalized : '';
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signedState(secret: string) {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    issuedAt: Date.now(),
    nonce: base64UrlEncode(crypto.getRandomValues(new Uint8Array(18))),
  })));
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(payload),
  ));
  return `${payload}.${base64UrlEncode(signature)}`;
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const id = clientId();
    const secret = signingSecret();
    if (!id || !secret) {
      return json({ error: 'Google Calendar OAuth is not fully configured.' }, 503);
    }

    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const loginHint = validLoginHint(requestUrl.searchParams.get('login_hint'));
    const state = await signedState(secret);
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    const authorizationParams: Record<string, string> = {
      client_id: id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      include_granted_scopes: 'true',
      state,
    };
    if (loginHint) authorizationParams.login_hint = loginHint;
    authorizationUrl.search = new URLSearchParams(authorizationParams).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizationUrl.toString(),
        'Cache-Control': 'no-store',
      },
    });
  },
};
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

const SESSION_COOKIE = 'tagonce_calendar_session';
const STATE_COOKIE = 'tagonce_calendar_state';

function config(request: Request) {
  const clientId = (
    process.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
    || process.env.GOOGLE_CALENDAR_CLIENT_ID
    || ''
  ).trim();
  const clientSecret = (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  const sessionSecret = (process.env.CALENDAR_SESSION_SECRET || clientSecret).trim();
  const redirectUri = `${new URL(request.url).origin}/api/google-calendar/callback`;
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

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
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

function redirect(request: Request, result: string, cookies: string[] = []) {
  const destination = new URL('/', request.url);
  destination.searchParams.set('calendar', result);
  const headers = new Headers({
    Location: destination.toString(),
    'Cache-Control': 'no-store',
  });
  cookies.forEach((value) => headers.append('Set-Cookie', value));
  return new Response(null, { status: 302, headers });
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const appConfig = config(request);
    const cookies = parseCookies(request);
    const cleanup = [clearCookie(STATE_COOKIE)];
    if (!appConfig) return redirect(request, 'unconfigured', cleanup);

    const url = new URL(request.url);
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const expectedState = cookies.get(STATE_COOKIE);

    if (error) {
      return redirect(request, error === 'access_denied' ? 'cancelled' : 'error', cleanup);
    }
    if (!state || !expectedState || state !== expectedState || !code) {
      return redirect(request, 'invalid_state', cleanup);
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: appConfig.clientId,
          client_secret: appConfig.clientSecret,
          redirect_uri: appConfig.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const token = await tokenResponse.json().catch(() => ({})) as GoogleTokenResponse;
      if (!tokenResponse.ok || !token.access_token) {
        throw new Error(token.error_description || token.error || 'Google token exchange failed.');
      }

      const session: CalendarSession = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
        scope: token.scope,
      };
      const sessionValue = await encryptSession(session, appConfig.sessionSecret);
      return redirect(request, 'connected', [
        cookie(SESSION_COOKIE, sessionValue, 60 * 60 * 24 * 180),
        ...cleanup,
      ]);
    } catch (tokenError) {
      console.error('Google Calendar callback failed', tokenError);
      return redirect(request, 'error', cleanup);
    }
  },
};
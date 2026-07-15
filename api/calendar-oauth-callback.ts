import { createRemoteJWKSet, jwtVerify } from 'jose';

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

type SignedStatePayload = {
  issuedAt?: number;
  nonce?: string;
};

const SESSION_COOKIE = 'tagonce_calendar_session';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

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

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function verifySignedState(value: string | null, secret: string) {
  if (!value) return false;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;

  try {
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlDecode(signature),
      new TextEncoder().encode(payload),
    );
    if (!validSignature) return false;

    const decoded = new TextDecoder().decode(base64UrlDecode(payload));
    const parsed = JSON.parse(decoded) as SignedStatePayload;
    const age = Date.now() - Number(parsed.issuedAt || 0);
    return Boolean(parsed.nonce && age >= 0 && age <= 15 * 60 * 1000);
  } catch {
    return false;
  }
}

function redirect(request: Request, result: string, cookies: string[] = [], status = 302) {
  const destination = new URL('/', request.url);
  destination.searchParams.set('calendar', result);
  const headers = new Headers({
    Location: destination.toString(),
    'Cache-Control': 'no-store',
  });
  cookies.forEach((value) => headers.append('Set-Cookie', value));
  return new Response(null, { status, headers });
}

function tokenFailureCode(token: GoogleTokenResponse) {
  if (token.error === 'invalid_client') return 'client_credentials';
  if (token.error === 'redirect_uri_mismatch') return 'redirect_mismatch';
  if (token.error === 'invalid_grant') return 'authorization_expired';
  if (token.error === 'access_denied') return 'cancelled';
  return 'token_exchange';
}

async function handleGoogleSso(request: Request, clientId: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(request, 'sso_response', [], 303);
  }

  const bodyCsrf = String(form.get('g_csrf_token') || '');
  const cookieCsrf = parseCookies(request).get('g_csrf_token') || '';
  if (!bodyCsrf || !cookieCsrf || bodyCsrf !== cookieCsrf) {
    return redirect(request, 'sso_csrf', [], 303);
  }

  const credential = String(form.get('credential') || '');
  if (!credential) return redirect(request, 'sso_response', [], 303);

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
    const email = typeof payload.email === 'string' && payload.email_verified === true
      ? payload.email.trim()
      : '';
    if (!email) return redirect(request, 'sso_email', [], 303);

    const calendarAuthorization = new URL('/api/google-calendar/connect', request.url);
    calendarAuthorization.searchParams.set('login_hint', email);
    return new Response(null, {
      status: 303,
      headers: {
        Location: calendarAuthorization.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (verificationError) {
    console.error('Google Sign-In token verification failed', verificationError);
    return redirect(request, 'sso_token', [], 303);
  }
}

export default {
  async fetch(request: Request) {
    const appConfig = config(request);
    if (!appConfig) return redirect(request, 'unconfigured', [], request.method === 'POST' ? 303 : 302);

    if (request.method === 'POST') {
      return handleGoogleSso(request, appConfig.clientId);
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');

    if (error) {
      return redirect(request, error === 'access_denied' ? 'cancelled' : 'google_error');
    }
    if (!code) return redirect(request, 'authorization_incomplete');
    if (!(await verifySignedState(state, appConfig.sessionSecret))) {
      return redirect(request, 'invalid_state');
    }

    let token: GoogleTokenResponse;
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
      token = await tokenResponse.json().catch(() => ({})) as GoogleTokenResponse;
      if (!tokenResponse.ok || !token.access_token) {
        console.error('Google Calendar token exchange failed', {
          status: tokenResponse.status,
          error: token.error,
          description: token.error_description,
        });
        return redirect(request, tokenFailureCode(token));
      }
    } catch (tokenError) {
      console.error('Google Calendar token request failed', tokenError);
      return redirect(request, 'token_exchange');
    }

    try {
      const session: CalendarSession = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
        scope: token.scope,
      };
      const sessionValue = await encryptSession(session, appConfig.sessionSecret);
      return redirect(request, 'connected', [
        cookie(SESSION_COOKIE, sessionValue, 60 * 60 * 24 * 180),
      ]);
    } catch (sessionError) {
      console.error('Google Calendar session creation failed', sessionError);
      return redirect(request, 'session_error');
    }
  },
};

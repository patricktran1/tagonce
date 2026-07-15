export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
export const SESSION_COOKIE = 'tagonce_calendar_session';
export const STATE_COOKIE = 'tagonce_calendar_state';

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
}

export interface CalendarSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function getCalendarConfig(request: Request): CalendarConfig | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.CALENDAR_SESSION_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim()
    || new URL('/api/google-calendar/callback', request.url).toString();

  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, redirectUri, sessionSecret };
}

export function parseCookies(request: Request) {
  const values = new Map<string, string>();
  const header = request.headers.get('cookie') || '';
  header.split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) values.set(name, decodeURIComponent(value));
  });
  return values;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict'; secure?: boolean } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure !== false) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name: string) {
  return serializeCookie(name, '', { maxAge: 0 });
}

function getWebCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Secure crypto is unavailable in this runtime.');
  return cryptoApi;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(secret: string) {
  const cryptoApi = getWebCrypto();
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return cryptoApi.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSession(session: CalendarSession, secret: string) {
  const cryptoApi = getWebCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = new Uint8Array(await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(secret),
    plaintext,
  ));
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  return encodeBase64Url(packed);
}

export async function decryptSession(value: string | undefined, secret: string): Promise<CalendarSession | null> {
  if (!value) return null;
  try {
    const packed = decodeBase64Url(value);
    if (packed.length < 29) return null;
    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);
    const plaintext = await getWebCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv },
      await encryptionKey(secret),
      ciphertext,
    );
    const session = JSON.parse(new TextDecoder().decode(plaintext)) as CalendarSession;
    return session.accessToken && Number.isFinite(session.expiresAt) ? session : null;
  } catch {
    return null;
  }
}

export function randomState() {
  return encodeBase64Url(getWebCrypto().getRandomValues(new Uint8Array(24)));
}

export function withCalendarResult(result: string) {
  const url = new URL('/', 'https://tagonce.local');
  url.searchParams.set('calendar', result);
  return `${url.pathname}${url.search}`;
}

export async function exchangeAuthorizationCode(
  code: string,
  config: CalendarConfig,
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed.');
  }
  return payload;
}

export async function refreshCalendarSession(
  session: CalendarSession,
  config: CalendarConfig,
): Promise<CalendarSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) throw new Error('Google Calendar needs to be reconnected.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google Calendar reconnect required.');
  }

  return {
    ...session,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in || 3600) * 1000,
    scope: payload.scope || session.scope,
  };
}

export async function sessionCookie(session: CalendarSession, secret: string) {
  return serializeCookie(SESSION_COOKIE, await encryptSession(session, secret), {
    maxAge: 60 * 60 * 24 * 180,
  });
}

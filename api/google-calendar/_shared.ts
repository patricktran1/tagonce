import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export function sendJson(
  response: VercelResponse,
  data: unknown,
  status = 200,
  headers: Record<string, string | string[]> = {},
) {
  response.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
  return response.status(status).json(data);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function requestOrigin(request: VercelRequest) {
  const protocol = headerValue(request.headers['x-forwarded-proto']) || 'https';
  const host = headerValue(request.headers['x-forwarded-host'])
    || headerValue(request.headers.host)
    || 'tagonce.vercel.app';
  return `${protocol}://${host}`;
}

export function getCalendarConfig(request: VercelRequest): CalendarConfig | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.CALENDAR_SESSION_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim()
    || `${requestOrigin(request)}/api/google-calendar/callback`;

  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, redirectUri, sessionSecret };
}

export function parseCookies(request: VercelRequest) {
  const values = new Map<string, string>();
  const header = request.headers.cookie || '';
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

export function queryValue(request: VercelRequest, name: string) {
  const value = request.query[name];
  return Array.isArray(value) ? value[0] : value;
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

export function redirect(
  response: VercelResponse,
  location: string,
  cookies: string[] = [],
) {
  response.setHeader('Cache-Control', 'no-store');
  if (cookies.length) response.setHeader('Set-Cookie', cookies);
  response.setHeader('Location', location);
  return response.status(302).end();
}

function encryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptSession(session: CalendarSession, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function decryptSession(value: string | undefined, secret: string): CalendarSession | null {
  if (!value) return null;
  try {
    const packed = Buffer.from(value, 'base64url');
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const session = JSON.parse(plaintext) as CalendarSession;
    return session.accessToken && Number.isFinite(session.expiresAt) ? session : null;
  } catch {
    return null;
  }
}

export function randomState() {
  return randomBytes(24).toString('base64url');
}

export function withCalendarResult(result: string) {
  const params = new URLSearchParams({ calendar: result });
  return `/?${params.toString()}`;
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

export function sessionCookie(session: CalendarSession, secret: string) {
  return serializeCookie(SESSION_COOKIE, encryptSession(session, secret), {
    maxAge: 60 * 60 * 24 * 180,
  });
}

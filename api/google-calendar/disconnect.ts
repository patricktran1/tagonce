import { SESSION_COOKIE, clearCookie, json } from './_shared';

export function POST() {
  return json(
    { connected: false },
    200,
    { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
  );
}

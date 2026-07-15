import { SESSION_COOKIE, clearCookie, json } from './_shared';

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    return json(
      { connected: false },
      200,
      { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
    );
  },
};

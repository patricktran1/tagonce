import {
  SESSION_COOKIE,
  decryptSession,
  getCalendarConfig,
  json,
  parseCookies,
} from './_shared';

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const config = getCalendarConfig(request);
    if (!config) return json({ configured: false, connected: false });

    const session = decryptSession(parseCookies(request).get(SESSION_COOKIE), config.sessionSecret);
    return json({
      configured: true,
      connected: Boolean(session),
      scope: session?.scope,
    });
  },
};

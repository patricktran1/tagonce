import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SESSION_COOKIE,
  decryptSession,
  getCalendarConfig,
  parseCookies,
  sendJson,
} from './_shared';

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed' }, 405);
  }

  try {
    const config = getCalendarConfig(request);
    if (!config) return sendJson(response, { configured: false, connected: false });

    const session = decryptSession(
      parseCookies(request).get(SESSION_COOKIE),
      config.sessionSecret,
    );
    return sendJson(response, {
      configured: true,
      connected: Boolean(session),
      scope: session?.scope,
    });
  } catch (error) {
    console.error('Google Calendar status failed', error);
    return sendJson(response, { configured: true, connected: false }, 200);
  }
}

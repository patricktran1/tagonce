import {
  SESSION_COOKIE,
  decryptSession,
  getCalendarConfig,
  json,
  parseCookies,
} from './_shared';

export async function GET(request: Request) {
  try {
    const config = getCalendarConfig(request);
    if (!config) return json({ configured: false, connected: false });

    const session = await decryptSession(
      parseCookies(request).get(SESSION_COOKIE),
      config.sessionSecret,
    );
    return json({
      configured: true,
      connected: Boolean(session),
      scope: session?.scope,
    });
  } catch (error) {
    console.error('Google Calendar status failed', error);
    return json({ configured: true, connected: false }, 200);
  }
}

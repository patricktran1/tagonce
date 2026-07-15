import {
  CALENDAR_SCOPE,
  STATE_COOKIE,
  getCalendarConfig,
  json,
  randomState,
  serializeCookie,
} from './_shared';

export function GET(request: Request) {
  try {
    const config = getCalendarConfig(request);
    if (!config) {
      return json({ error: 'Google Calendar OAuth is not configured.' }, 503);
    }

    const state = randomState();
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: CALENDAR_SCOPE,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizationUrl.toString(),
        'Set-Cookie': serializeCookie(STATE_COOKIE, state, { maxAge: 600 }),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'Google Calendar authorization could not start.',
    }, 500);
  }
}

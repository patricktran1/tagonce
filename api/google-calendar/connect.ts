import {
  CALENDAR_SCOPE,
  RETURN_COOKIE,
  STATE_COOKIE,
  getCalendarConfig,
  json,
  randomState,
  safeReturnTo,
  serializeCookie,
} from './_shared';

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const config = getCalendarConfig(request);
    if (!config) {
      return json({ error: 'Google Calendar OAuth is not configured.' }, 503);
    }

    const requestUrl = new URL(request.url);
    const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
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

    const headers = new Headers({ Location: authorizationUrl.toString() });
    headers.append('Set-Cookie', serializeCookie(STATE_COOKIE, state, { maxAge: 600 }));
    headers.append('Set-Cookie', serializeCookie(RETURN_COOKIE, returnTo, { maxAge: 600 }));
    return new Response(null, { status: 302, headers });
  },
};

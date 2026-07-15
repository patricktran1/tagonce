import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  CALENDAR_SCOPE,
  STATE_COOKIE,
  getCalendarConfig,
  randomState,
  redirect,
  sendJson,
  serializeCookie,
} from './_shared';

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed' }, 405);
  }

  try {
    const config = getCalendarConfig(request);
    if (!config) {
      return sendJson(response, { error: 'Google Calendar OAuth is not configured.' }, 503);
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

    return redirect(
      response,
      authorizationUrl.toString(),
      [serializeCookie(STATE_COOKIE, state, { maxAge: 600 })],
    );
  } catch (error) {
    console.error('Google Calendar authorization start failed', error);
    return sendJson(response, {
      error: error instanceof Error ? error.message : 'Google Calendar authorization could not start.',
    }, 500);
  }
}

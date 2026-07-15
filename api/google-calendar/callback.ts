import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  decryptSession,
  exchangeAuthorizationCode,
  getCalendarConfig,
  parseCookies,
  queryValue,
  redirect,
  sendJson,
  sessionCookie,
  withCalendarResult,
} from './_shared';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed' }, 405);
  }

  const cleanup = [clearCookie(STATE_COOKIE)];

  try {
    const config = getCalendarConfig(request);
    const cookies = parseCookies(request);
    if (!config) return redirect(response, withCalendarResult('unconfigured'), cleanup);

    const state = queryValue(request, 'state');
    const expectedState = cookies.get(STATE_COOKIE);
    const oauthError = queryValue(request, 'error');
    const code = queryValue(request, 'code');

    if (oauthError) {
      return redirect(
        response,
        withCalendarResult(oauthError === 'access_denied' ? 'cancelled' : 'error'),
        cleanup,
      );
    }
    if (!state || !expectedState || state !== expectedState || !code) {
      return redirect(response, withCalendarResult('invalid_state'), cleanup);
    }

    const token = await exchangeAuthorizationCode(code, config);
    if (!token.access_token) throw new Error('Google returned no access token.');

    const previous = decryptSession(cookies.get(SESSION_COOKIE), config.sessionSecret);
    const session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || previous?.refreshToken,
      expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
      scope: token.scope,
    };

    return redirect(
      response,
      withCalendarResult('connected'),
      [sessionCookie(session, config.sessionSecret), ...cleanup],
    );
  } catch (error) {
    console.error('Google Calendar OAuth callback failed', error);
    return redirect(response, withCalendarResult('error'), cleanup);
  }
}

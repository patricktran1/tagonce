import {
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  decryptSession,
  exchangeAuthorizationCode,
  getCalendarConfig,
  parseCookies,
  safeReturnTo,
  sessionCookie,
  withCalendarResult,
} from './_shared';

function redirect(request: Request, returnTo: string, result: string, cookies: string[] = []) {
  const destination = new URL(withCalendarResult(returnTo, result), request.url);
  const headers = new Headers({ Location: destination.toString() });
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(null, { status: 302, headers });
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const config = getCalendarConfig(request);
    const cookies = parseCookies(request);
    const returnTo = safeReturnTo(cookies.get(RETURN_COOKIE) || null);
    const cleanup = [clearCookie(STATE_COOKIE), clearCookie(RETURN_COOKIE)];

    if (!config) return redirect(request, returnTo, 'unconfigured', cleanup);

    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const expectedState = cookies.get(STATE_COOKIE);
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');

    if (error) return redirect(request, returnTo, error === 'access_denied' ? 'cancelled' : 'error', cleanup);
    if (!state || !expectedState || state !== expectedState || !code) {
      return redirect(request, returnTo, 'invalid_state', cleanup);
    }

    try {
      const token = await exchangeAuthorizationCode(code, config);
      if (!token.access_token) throw new Error('Google returned no access token.');

      const previous = decryptSession(cookies.get(SESSION_COOKIE), config.sessionSecret);
      const session = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || previous?.refreshToken,
        expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
        scope: token.scope,
      };

      return redirect(request, returnTo, 'connected', [sessionCookie(session, config.sessionSecret), ...cleanup]);
    } catch {
      return redirect(request, returnTo, 'error', cleanup);
    }
  },
};

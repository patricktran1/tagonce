import {
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  decryptSession,
  exchangeAuthorizationCode,
  getCalendarConfig,
  parseCookies,
  sessionCookie,
  withCalendarResult,
} from './_shared';

function redirect(request: Request, result: string, cookies: string[] = []) {
  const destination = new URL(withCalendarResult(result), request.url);
  const headers = new Headers({
    Location: destination.toString(),
    'Cache-Control': 'no-store',
  });
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const cleanup = [clearCookie(STATE_COOKIE)];

  try {
    const config = getCalendarConfig(request);
    const cookies = parseCookies(request);
    if (!config) return redirect(request, 'unconfigured', cleanup);

    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const expectedState = cookies.get(STATE_COOKIE);
    const oauthError = url.searchParams.get('error');
    const code = url.searchParams.get('code');

    if (oauthError) {
      return redirect(request, oauthError === 'access_denied' ? 'cancelled' : 'error', cleanup);
    }
    if (!state || !expectedState || state !== expectedState || !code) {
      return redirect(request, 'invalid_state', cleanup);
    }

    const token = await exchangeAuthorizationCode(code, config);
    if (!token.access_token) throw new Error('Google returned no access token.');

    const previous = await decryptSession(cookies.get(SESSION_COOKIE), config.sessionSecret);
    const session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || previous?.refreshToken,
      expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
      scope: token.scope,
    };

    const encryptedSessionCookie = await sessionCookie(session, config.sessionSecret);
    return redirect(request, 'connected', [encryptedSessionCookie, ...cleanup]);
  } catch (error) {
    console.error('Google Calendar OAuth callback failed', error);
    return redirect(request, 'error', cleanup);
  }
}

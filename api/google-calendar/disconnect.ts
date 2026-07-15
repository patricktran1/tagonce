import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SESSION_COOKIE,
  clearCookie,
  sendJson,
} from './_shared';

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, { error: 'Method not allowed' }, 405);
  }

  return sendJson(
    response,
    { connected: false },
    200,
    { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
  );
}

type GoogleSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  email?: string;
  displayName?: string;
  picture?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type DriveFile = {
  id: string;
  name?: string;
  modifiedTime?: string;
  size?: string;
};

type DriveListResponse = {
  files?: DriveFile[];
  error?: { message?: string; status?: string };
};

type CloudWorkspace = {
  version: 1;
  updatedAt: string;
  profile: unknown;
  entities: unknown[];
  campaigns: unknown[];
  brand: unknown;
  connections: unknown[];
  exchangeReceipts?: Record<string, unknown>;
};

const SESSION_COOKIE = 'tagonce_calendar_session';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const WORKSPACE_FILE = 'tagonce-workspace-v1.json';
const MAX_WORKSPACE_BYTES = 2_000_000;

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function config() {
  const clientId = (
    process.env.VITE_GOOGLE_CALENDAR_CLIENT_ID
    || process.env.GOOGLE_CALENDAR_CLIENT_ID
    || ''
  ).trim();
  const clientSecret = (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  const sessionSecret = (process.env.CALENDAR_SESSION_SECRET || clientSecret).trim();
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, sessionSecret };
}

function parseCookies(request: Request) {
  const values = new Map<string, string>();
  const header = request.headers.get('cookie') || '';
  header.split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) return;
    try {
      values.set(name, decodeURIComponent(value));
    } catch {
      values.set(name, value);
    }
  });
  return values;
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name: string) {
  return cookie(name, '', 0);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSession(session: GoogleSession, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(secret),
    plaintext,
  ));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return base64UrlEncode(packed);
}

async function decryptSession(value: string | undefined, secret: string): Promise<GoogleSession | null> {
  if (!value) return null;
  try {
    const packed = base64UrlDecode(value);
    if (packed.length < 29) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, 12) },
      await encryptionKey(secret),
      packed.slice(12),
    );
    const session = JSON.parse(new TextDecoder().decode(plaintext)) as GoogleSession;
    return session.accessToken && Number.isFinite(session.expiresAt) ? session : null;
  } catch {
    return null;
  }
}

async function refreshSession(session: GoogleSession, appConfig: NonNullable<ReturnType<typeof config>>) {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) throw new Error('Google needs to be reconnected.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appConfig.clientId,
      client_secret: appConfig.clientSecret,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google needs to be reconnected.');
  }
  return {
    ...session,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in || 3600) * 1000,
    scope: payload.scope || session.scope,
  };
}

function hasDriveScope(session: GoogleSession) {
  return (session.scope || '').split(/\s+/).includes(DRIVE_SCOPE);
}

function account(session: GoogleSession) {
  return session.email
    ? { email: session.email, displayName: session.displayName, picture: session.picture }
    : undefined;
}

function driveError(payload: DriveListResponse | Record<string, unknown>, fallback: string) {
  const nested = 'error' in payload && payload.error && typeof payload.error === 'object'
    ? payload.error as { message?: string; status?: string }
    : undefined;
  return nested?.message || fallback;
}

function driveApiDisabled(message: string) {
  return /drive api.*(disabled|not been used)|access not configured/i.test(message);
}

async function listWorkspaceFiles(accessToken: string) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${WORKSPACE_FILE}' and trashed=false`,
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '10',
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({})) as DriveListResponse;
  if (!response.ok) throw new Error(driveError(payload, 'Google Drive could not be checked.'));
  return payload.files || [];
}

async function readWorkspace(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(driveError(payload, 'The cloud workspace could not be downloaded.'));
  }
  return response.json() as Promise<CloudWorkspace>;
}

async function createWorkspaceFile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: WORKSPACE_FILE,
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    }),
  });
  const payload = await response.json().catch(() => ({})) as DriveFile & { error?: { message?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.error?.message || 'The cloud workspace file could not be created.');
  return payload.id;
}

async function writeWorkspace(accessToken: string, fileId: string, workspace: CloudWorkspace) {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workspace),
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(driveError(payload, 'The cloud workspace could not be saved.'));
  }
}

function validWorkspace(value: unknown): value is CloudWorkspace {
  if (!value || typeof value !== 'object') return false;
  const workspace = value as Partial<CloudWorkspace>;
  return workspace.version === 1
    && typeof workspace.updatedAt === 'string'
    && Boolean(workspace.profile && typeof workspace.profile === 'object')
    && Array.isArray(workspace.entities)
    && Array.isArray(workspace.campaigns)
    && Boolean(workspace.brand && typeof workspace.brand === 'object')
    && Array.isArray(workspace.connections);
}

export default {
  async fetch(request: Request) {
    const appConfig = config();
    if (!appConfig) return json({ connected: false, syncEnabled: false, error: 'Google authorization is not configured.' }, 503);

    const stored = await decryptSession(
      parseCookies(request).get(SESSION_COOKIE),
      appConfig.sessionSecret,
    );
    if (!stored) return json({ connected: false, syncEnabled: false }, 401);

    let session: GoogleSession;
    try {
      session = await refreshSession(stored, appConfig);
    } catch (error) {
      return json({
        connected: false,
        syncEnabled: false,
        error: error instanceof Error ? error.message : 'Google needs to be reconnected.',
      }, 401, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
    }

    const headers = new Headers();
    if (session.accessToken !== stored.accessToken || session.expiresAt !== stored.expiresAt) {
      headers.append('Set-Cookie', cookie(
        SESSION_COOKIE,
        await encryptSession(session, appConfig.sessionSecret),
        60 * 60 * 24 * 180,
      ));
    }

    if (!hasDriveScope(session)) {
      return json({
        connected: true,
        syncEnabled: false,
        requiresAuthorization: true,
        account: account(session),
      }, 403, headers);
    }

    try {
      if (request.method === 'GET') {
        const files = await listWorkspaceFiles(session.accessToken);
        if (!files.length) {
          return json({
            connected: true,
            syncEnabled: true,
            found: false,
            account: account(session),
          }, 200, headers);
        }
        const file = files[0];
        const workspace = await readWorkspace(session.accessToken, file.id);
        return json({
          connected: true,
          syncEnabled: true,
          found: true,
          account: account(session),
          file: { id: file.id, modifiedTime: file.modifiedTime },
          workspace,
        }, 200, headers);
      }

      if (request.method === 'PUT') {
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_WORKSPACE_BYTES) {
          return json({ error: 'The TagOnce workspace is too large to sync.' }, 413, headers);
        }
        const workspace = JSON.parse(text) as unknown;
        if (!validWorkspace(workspace)) return json({ error: 'The TagOnce workspace is invalid.' }, 400, headers);

        const files = await listWorkspaceFiles(session.accessToken);
        const fileId = files[0]?.id || await createWorkspaceFile(session.accessToken);
        await writeWorkspace(session.accessToken, fileId, workspace);
        return json({
          connected: true,
          syncEnabled: true,
          saved: true,
          updatedAt: workspace.updatedAt,
          account: account(session),
        }, 200, headers);
      }

      return json({ error: 'Method not allowed' }, 405, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Drive sync failed.';
      return json({
        connected: true,
        syncEnabled: true,
        account: account(session),
        code: driveApiDisabled(message) ? 'drive_api_disabled' : 'drive_error',
        error: message,
      }, 502, headers);
    }
  },
};
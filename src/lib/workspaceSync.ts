import type { CloudWorkspace, GoogleAccountIdentity } from '../types';

export type WorkspaceSyncState =
  | 'checking'
  | 'local'
  | 'authorization_required'
  | 'syncing'
  | 'synced'
  | 'error';

export interface WorkspaceSyncResponse {
  connected: boolean;
  syncEnabled: boolean;
  requiresAuthorization?: boolean;
  found?: boolean;
  saved?: boolean;
  updatedAt?: string;
  account?: GoogleAccountIdentity;
  workspace?: CloudWorkspace;
  code?: 'drive_api_disabled' | 'drive_error';
  error?: string;
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as WorkspaceSyncResponse;
  return { response, payload };
}

export async function loadCloudWorkspace() {
  const { response, payload } = await parseResponse(await fetch('/api/google-workspace-sync', {
    credentials: 'include',
    cache: 'no-store',
  }));

  if ([401, 403].includes(response.status)) return payload;
  if (!response.ok) throw new Error(payload.error || 'TagOnce cloud sync could not be checked.');
  return payload;
}

export async function saveCloudWorkspace(workspace: CloudWorkspace) {
  const { response, payload } = await parseResponse(await fetch('/api/google-workspace-sync', {
    method: 'PUT',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workspace),
  }));

  if ([401, 403].includes(response.status)) return payload;
  if (!response.ok) throw new Error(payload.error || 'TagOnce cloud sync could not save this workspace.');
  return payload;
}

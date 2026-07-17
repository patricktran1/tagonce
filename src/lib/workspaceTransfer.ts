import type {
  BrandSettings,
  Campaign,
  MentionEntity,
  MyProfile,
  SocialConnection,
} from '../types';

const PROFILE_KEY = 'tagonce.profile.v1';
const ENTITY_KEY = 'tagonce.entities.v1';
const CAMPAIGN_KEY = 'tagonce.campaigns.v1';
const BRAND_KEY = 'tagonce.brand.v1';
const CONNECTION_KEY = 'tagonce.connections.v1';
const EXCHANGE_RECEIPT_KEY = 'tagonce.exchange.receipts.v1';

export interface TagOnceWorkspaceBackup {
  format: 'tagonce-workspace';
  version: 1;
  exportedAt: string;
  data: {
    profile: MyProfile | null;
    entities: MentionEntity[];
    campaigns: Campaign[];
    brand: BrandSettings | null;
    connections: SocialConnection[];
    exchangeReceipts: Record<string, unknown>;
  };
}

export interface WorkspaceBackupSummary {
  contacts: number;
  encounters: number;
  campaigns: number;
  profileName: string;
  exportedAt: string;
}

type RestoreMode = 'merge' | 'replace';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isWorkspaceBackup(value: unknown): value is TagOnceWorkspaceBackup {
  if (!isRecord(value) || value.format !== 'tagonce-workspace' || value.version !== 1) return false;
  if (typeof value.exportedAt !== 'string' || !isRecord(value.data)) return false;
  const data = value.data;
  return Array.isArray(data.entities)
    && Array.isArray(data.campaigns)
    && Array.isArray(data.connections)
    && isRecord(data.exchangeReceipts)
    && (data.profile === null || isRecord(data.profile))
    && (data.brand === null || isRecord(data.brand));
}

function mergeByKey<T>(current: T[], incoming: T[], keyFor: (item: T) => string) {
  const merged = new Map<string, T>();
  current.forEach((item) => merged.set(keyFor(item), item));
  incoming.forEach((item) => merged.set(keyFor(item), item));
  return Array.from(merged.values());
}

function safeDateStamp(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function workspaceBlob(backup: TagOnceWorkspaceBackup) {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function workspaceBackupFilename(backup?: TagOnceWorkspaceBackup) {
  const stamp = backup?.exportedAt ? safeDateStamp(new Date(backup.exportedAt)) : safeDateStamp();
  return `tagonce-backup-${stamp}.json`;
}

export function createWorkspaceBackup(): TagOnceWorkspaceBackup {
  return {
    format: 'tagonce-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      profile: readJson<MyProfile | null>(PROFILE_KEY, null),
      entities: readJson<MentionEntity[]>(ENTITY_KEY, []),
      campaigns: readJson<Campaign[]>(CAMPAIGN_KEY, []),
      brand: readJson<BrandSettings | null>(BRAND_KEY, null),
      connections: readJson<SocialConnection[]>(CONNECTION_KEY, []),
      exchangeReceipts: readJson<Record<string, unknown>>(EXCHANGE_RECEIPT_KEY, {}),
    },
  };
}

export function summarizeWorkspaceBackup(backup: TagOnceWorkspaceBackup): WorkspaceBackupSummary {
  const encounters = backup.data.entities.reduce(
    (total, entity) => total + (entity.encounters?.length || (entity.metAt || entity.metOn || entity.notes || entity.memoryPhotoDataUrl ? 1 : 0)),
    0,
  );
  return {
    contacts: backup.data.entities.length,
    encounters,
    campaigns: backup.data.campaigns.length,
    profileName: backup.data.profile?.displayName || 'TagOnce profile',
    exportedAt: backup.exportedAt,
  };
}

export function downloadWorkspaceBackup() {
  const backup = createWorkspaceBackup();
  triggerDownload(workspaceBlob(backup), workspaceBackupFilename(backup));
  return backup;
}

export async function shareWorkspaceBackup() {
  const backup = createWorkspaceBackup();
  const file = new File([workspaceBlob(backup)], workspaceBackupFilename(backup), { type: 'application/json' });
  const shareData: ShareData = {
    title: 'TagOnce device backup',
    text: 'Import this file in TagOnce to move your profile, QR presets, contacts, and encounter history.',
    files: [file],
  };
  const sharingNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (navigator.share && sharingNavigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return 'shared' as const;
  }
  triggerDownload(file, file.name);
  return 'downloaded' as const;
}

export function parseWorkspaceBackupText(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isWorkspaceBackup(parsed)) {
    throw new Error('That file is not a supported TagOnce backup.');
  }
  return parsed;
}

export async function readWorkspaceBackupFile(file: File) {
  return parseWorkspaceBackupText(await file.text());
}

export function applyWorkspaceBackup(backup: TagOnceWorkspaceBackup, mode: RestoreMode) {
  if (mode === 'replace') {
    if (backup.data.profile) writeJson(PROFILE_KEY, backup.data.profile);
    else window.localStorage.removeItem(PROFILE_KEY);
    writeJson(ENTITY_KEY, backup.data.entities);
    writeJson(CAMPAIGN_KEY, backup.data.campaigns);
    if (backup.data.brand) writeJson(BRAND_KEY, backup.data.brand);
    else window.localStorage.removeItem(BRAND_KEY);
    writeJson(CONNECTION_KEY, backup.data.connections);
    writeJson(EXCHANGE_RECEIPT_KEY, backup.data.exchangeReceipts);
    return;
  }

  const current = createWorkspaceBackup();
  const entities = mergeByKey(current.data.entities, backup.data.entities, (entity) => entity.id);
  const campaigns = mergeByKey(current.data.campaigns, backup.data.campaigns, (campaign) => campaign.id);
  const connections = mergeByKey(
    current.data.connections,
    backup.data.connections,
    (connection) => connection.platform,
  );

  if (backup.data.profile) writeJson(PROFILE_KEY, backup.data.profile);
  else if (current.data.profile) writeJson(PROFILE_KEY, current.data.profile);
  writeJson(ENTITY_KEY, entities);
  writeJson(CAMPAIGN_KEY, campaigns);
  if (backup.data.brand) writeJson(BRAND_KEY, backup.data.brand);
  else if (current.data.brand) writeJson(BRAND_KEY, current.data.brand);
  writeJson(CONNECTION_KEY, connections);
  writeJson(EXCHANGE_RECEIPT_KEY, {
    ...current.data.exchangeReceipts,
    ...backup.data.exchangeReceipts,
  });
}

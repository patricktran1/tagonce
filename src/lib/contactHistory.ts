import type { ContactEncounter, MentionEntity, SharedSocialIdentity } from '../types';

function normalizeText(value?: string) {
  return value?.trim().toLowerCase() || '';
}

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, '') || '';
}

function normalizeUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return normalizeText(value).replace(/\/+$/, '');
  }
}

function identityKeys(entity: MentionEntity) {
  const keys = new Set<string>();
  const email = normalizeText(entity.email);
  const phone = normalizePhone(entity.phone);
  const whatsapp = normalizePhone(entity.whatsapp);
  const website = normalizeUrl(entity.website);

  if (email) keys.add(`email:${email}`);
  if (phone) keys.add(`phone:${phone}`);
  if (whatsapp) keys.add(`phone:${whatsapp}`);
  if (website) keys.add(`web:${website}`);

  Object.entries(entity.socialProfiles || {}).forEach(([platform, identity]) => {
    const social = identity as SharedSocialIdentity | undefined;
    const profileUrl = normalizeUrl(social?.profileUrl);
    const handle = normalizeText(social?.handle).replace(/^@/, '');
    if (profileUrl) keys.add(`social:${profileUrl}`);
    if (handle) keys.add(`handle:${platform}:${handle}`);
  });

  Object.values(entity.mappings || {}).forEach((mapping) => {
    const profileUrl = normalizeUrl(mapping?.profileUrl);
    const handle = normalizeText(mapping?.handle).replace(/^@/, '');
    if (profileUrl) keys.add(`social:${profileUrl}`);
    if (mapping?.platform && handle) keys.add(`handle:${mapping.platform}:${handle}`);
  });

  return keys;
}

export function contactsMatch(left: MentionEntity, right: MentionEntity) {
  const leftKeys = identityKeys(left);
  const rightKeys = identityKeys(right);
  if ([...leftKeys].some((key) => rightKeys.has(key))) return true;

  const sameName = normalizeText(left.displayName) === normalizeText(right.displayName);
  if (!sameName) return false;

  // When both records contain stable identifiers and none match, do not merge people merely because
  // they share a name.
  if (leftKeys.size > 0 && rightKeys.size > 0) return false;

  const leftCompany = normalizeText(left.company);
  const rightCompany = normalizeText(right.company);
  if (leftCompany && rightCompany && leftCompany !== rightCompany) return false;
  return true;
}

function encounterFingerprint(encounter: ContactEncounter) {
  return [
    encounter.metOn,
    normalizeText(encounter.metAt),
    normalizeText(encounter.notes),
    encounter.memoryPhotoDataUrl ? 'photo' : '',
    encounter.sourceCardMode || '',
  ].join('|');
}

function legacyEncounter(entity: MentionEntity): ContactEncounter | null {
  const hasContext = Boolean(
    entity.metAt
      || entity.metOn
      || entity.notes
      || entity.memoryPhotoDataUrl
      || entity.sourceCardMode,
  );
  if (!hasContext) return null;

  const metOn = entity.metOn || entity.createdAt || new Date(0).toISOString();
  return {
    id: `encounter_${entity.id}_${metOn.replace(/[^a-z0-9]/gi, '')}`,
    metAt: entity.metAt,
    metOn,
    notes: entity.notes,
    memoryPhotoDataUrl: entity.memoryPhotoDataUrl,
    sourceCardMode: entity.sourceCardMode,
  };
}

export function contactEncounters(entity: MentionEntity) {
  const source = entity.encounters?.length
    ? entity.encounters
    : [legacyEncounter(entity)].filter((encounter): encounter is ContactEncounter => Boolean(encounter));
  const seen = new Set<string>();

  return source
    .filter((encounter) => {
      const fingerprint = encounterFingerprint(encounter);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.metOn).getTime() || 0;
      const rightTime = new Date(right.metOn).getTime() || 0;
      return rightTime - leftTime;
    });
}

function syncLatestEncounter(entity: MentionEntity, encounters: ContactEncounter[]): MentionEntity {
  const latest = encounters[0];
  const latestPhoto = encounters.find((encounter) => encounter.memoryPhotoDataUrl)?.memoryPhotoDataUrl;
  return {
    ...entity,
    encounters,
    metAt: latest?.metAt || entity.metAt,
    metOn: latest?.metOn || entity.metOn,
    notes: latest?.notes || entity.notes,
    memoryPhotoDataUrl: latestPhoto || entity.memoryPhotoDataUrl,
    sourceCardMode: latest?.sourceCardMode || entity.sourceCardMode,
  };
}

export function prepareContactRecord(entity: MentionEntity) {
  return syncLatestEncounter(entity, contactEncounters(entity));
}

export function mergeContactRecords(existing: MentionEntity, incoming: MentionEntity) {
  const combined = [...contactEncounters(incoming), ...contactEncounters(existing)];
  const seen = new Set<string>();
  const encounters = combined
    .filter((encounter) => {
      const fingerprint = encounterFingerprint(encounter);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .sort((left, right) => (new Date(right.metOn).getTime() || 0) - (new Date(left.metOn).getTime() || 0));

  return syncLatestEncounter({
    ...existing,
    ...incoming,
    id: existing.id,
    createdAt: existing.createdAt,
    usageCount: existing.usageCount,
    description: incoming.description || existing.description,
    title: incoming.title || existing.title,
    company: incoming.company || existing.company,
    email: incoming.email || existing.email,
    phone: incoming.phone || existing.phone,
    whatsapp: incoming.whatsapp || existing.whatsapp,
    website: incoming.website || existing.website,
    avatarUrl: incoming.avatarUrl || existing.avatarUrl,
    socialProfiles: { ...existing.socialProfiles, ...incoming.socialProfiles },
    mappings: { ...existing.mappings, ...incoming.mappings },
  }, encounters);
}

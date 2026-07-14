import { platformMeta } from '../data/demo';
import type {
  BrandSettings,
  MentionEntity,
  MentionResolution,
  Platform,
  PlatformVariant,
} from '../types';

const genericStopWords = new Set([
  'this',
  'that',
  'with',
  'from',
  'your',
  'have',
  'will',
  'into',
  'about',
  'more',
  'than',
  'just',
  'what',
  'when',
  'where',
  'they',
  'them',
  'their',
  'been',
  'were',
  'we’re',
  'weve',
  'ours',
  'launching',
]);

export function resolveMention(
  entity: MentionEntity,
  platform: Platform,
): MentionResolution {
  const mapping = entity.mappings[platform];

  if (!mapping) {
    return {
      entityId: entity.id,
      entityName: entity.displayName,
      platform,
      renderedText: entity.displayName,
      status: 'missing',
      nativeTagSupported: false,
      detail: 'No platform account mapped',
    };
  }

  const renderedText = mapping.handle || mapping.displayName;

  if (!mapping.nativeTagSupported) {
    return {
      entityId: entity.id,
      entityName: entity.displayName,
      platform,
      renderedText,
      status: 'plain_text',
      nativeTagSupported: false,
      detail: 'Will publish as visible text, not a native tag',
    };
  }

  return {
    entityId: entity.id,
    entityName: entity.displayName,
    platform,
    renderedText,
    status: mapping.verified ? 'resolved' : 'plain_text',
    nativeTagSupported: true,
    detail: mapping.verified
      ? 'Verified native mention mapping'
      : 'Mapping needs confirmation before native publishing',
  };
}

function titleCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function generateHashtags(
  masterText: string,
  brand: BrandSettings,
  platform: Platform,
): string[] {
  const words = masterText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4 && !genericStopWords.has(word));

  const preferred = brand.preferredHashtags
    .split(',')
    .map((item) => titleCase(item.trim()))
    .filter(Boolean);

  const discovered = [...new Set(words)].slice(0, 4).map(titleCase);
  const pool = [...new Set([...preferred, ...discovered])];

  const targetCount: Record<Platform, number> = {
    facebook: 2,
    linkedin: 3,
    instagram: 7,
    x: 2,
    threads: 2,
    tiktok: 5,
    youtube: 4,
  };

  return pool.slice(0, targetCount[platform]).map((tag) => `#${tag}`);
}

function replaceEntityNames(
  text: string,
  entities: MentionEntity[],
  resolutions: MentionResolution[],
): string {
  let output = text;

  entities.forEach((entity) => {
    const resolution = resolutions.find((item) => item.entityId === entity.id);
    if (!resolution) return;

    const escaped = entity.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    output = output.replace(pattern, resolution.renderedText);
  });

  const missingFromBody = resolutions.filter(
    (resolution) =>
      !output.toLowerCase().includes(resolution.renderedText.toLowerCase()),
  );

  if (missingFromBody.length > 0) {
    output += `\n\nWith ${missingFromBody.map((item) => item.renderedText).join(', ')}.`;
  }

  return output;
}

function trimToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0] || text;
}

export function generateVariant(
  platform: Platform,
  masterText: string,
  entities: MentionEntity[],
  brand: BrandSettings,
): PlatformVariant {
  const mentionResolutions = entities.map((entity) =>
    resolveMention(entity, platform),
  );
  const resolvedText = replaceEntityNames(masterText.trim(), entities, mentionResolutions);
  const hashtags = generateHashtags(masterText, brand, platform);
  const hashtagLine = hashtags.join(' ');
  const cta = brand.defaultCta.trim();

  let body = resolvedText;
  let title: string | undefined;
  let format = 'Native post';

  switch (platform) {
    case 'facebook':
      body = `${resolvedText}\n\n${cta ? `${cta}.` : ''}\n\n${hashtagLine}`.trim();
      format = 'Long-form Page post';
      break;
    case 'linkedin':
      body = `${firstSentence(resolvedText)}\n\n${resolvedText}\n\n${cta ? `${cta}.` : ''}\n\n${hashtagLine}`.trim();
      format = 'Professional authority post';
      break;
    case 'instagram':
      body = `${resolvedText}\n\n${cta ? `${cta}.` : ''}\n\n${hashtagLine}`.trim();
      format = '4:5 static image caption';
      break;
    case 'x': {
      const suffix = hashtagLine ? `\n\n${hashtagLine}` : '';
      body = trimToLimit(`${resolvedText}${suffix}`, platformMeta.x.limit ?? 280);
      format = body.length > 260 ? 'Thread-ready post' : 'Single post';
      break;
    }
    case 'threads':
      body = trimToLimit(`${resolvedText}\n\n${hashtagLine}`, platformMeta.threads.limit ?? 500);
      format = 'Conversational post';
      break;
    case 'tiktok':
      title = trimToLimit(firstSentence(resolvedText), 80);
      body = `HOOK\n${firstSentence(resolvedText)}\n\nSCRIPT\n${resolvedText}\n\nCAPTION\n${cta ? `${cta}. ` : ''}${hashtagLine}`.trim();
      format = 'Short-form video script';
      break;
    case 'youtube':
      title = trimToLimit(firstSentence(resolvedText), 90);
      body = `${resolvedText}\n\n${cta ? `${cta}.` : ''}\n\n${hashtagLine}`.trim();
      format = 'Shorts title + description';
      break;
  }

  return {
    platform,
    title,
    body,
    hashtags,
    characterCount: body.length,
    limit: platformMeta[platform].limit,
    mentionResolutions,
    format,
  };
}

export function generateAllVariants(
  platforms: Platform[],
  masterText: string,
  entities: MentionEntity[],
  brand: BrandSettings,
): PlatformVariant[] {
  return platforms.map((platform) =>
    generateVariant(platform, masterText, entities, brand),
  );
}

import { platformMeta } from './demo';
import type { Platform, SharedSocialIdentity, SocialPlatform } from '../types';

export const coreSocialPlatforms: SocialPlatform[] = [
  'linkedin',
  'github',
  'instagram',
  'facebook',
  'x',
];

export const optionalSocialPlatforms: SocialPlatform[] = [
  'threads',
  'tiktok',
  'youtube',
  'snapchat',
  'pinterest',
];

export const allSocialPlatforms: SocialPlatform[] = [
  ...coreSocialPlatforms,
  ...optionalSocialPlatforms,
];

export const socialPlatformMeta: Record<
  SocialPlatform,
  { label: string; short: string; description: string; action: string }
> = {
  facebook: { ...platformMeta.facebook, action: 'View profile' },
  linkedin: { ...platformMeta.linkedin, action: 'Connect' },
  instagram: { ...platformMeta.instagram, action: 'Follow' },
  x: { ...platformMeta.x, action: 'Follow' },
  threads: { ...platformMeta.threads, action: 'Follow' },
  tiktok: { ...platformMeta.tiktok, action: 'Follow' },
  youtube: { ...platformMeta.youtube, action: 'Subscribe' },
  snapchat: {
    label: 'Snapchat',
    short: '◉',
    description: 'Personal social profile',
    action: 'Add',
  },
  pinterest: {
    label: 'Pinterest',
    short: 'P',
    description: 'Boards and visual profile',
    action: 'Follow',
  },
  github: {
    label: 'GitHub',
    short: 'GH',
    description: 'Developer profile, projects and code',
    action: 'View projects',
  },
};

function promoteSavedGithubEventPreset() {
  if (typeof window === 'undefined') return;
  try {
    const key = 'tagonce.profile.v1';
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const profile = JSON.parse(raw) as {
      socialProfiles?: Record<string, SharedSocialIdentity | undefined>;
      cardSelections?: { event?: string[] };
    };
    const github = profile.socialProfiles?.github;
    const event = profile.cardSelections?.event;
    if (!event || event.includes('social:github') || (!github?.handle && !github?.profileUrl)) return;
    const next = [...event];
    const linkedInIndex = next.indexOf('social:linkedin');
    next.splice(linkedInIndex >= 0 ? linkedInIndex + 1 : next.length, 0, 'social:github');
    profile.cardSelections = { ...profile.cardSelections, event: next };
    window.localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // A malformed or unavailable local profile should never block the card editor.
  }
}

promoteSavedGithubEventPreset();

function cleanHandle(value = '') {
  return value.trim().replace(/^@/, '');
}

export function socialProfileUrl(
  platform: SocialPlatform,
  identity?: SharedSocialIdentity,
) {
  const enteredUrl = identity?.profileUrl?.trim();
  if (enteredUrl) {
    if (/^https?:\/\//i.test(enteredUrl)) return enteredUrl;
    return `https://${enteredUrl}`;
  }

  const handle = cleanHandle(identity?.handle);
  if (!handle) return '';

  switch (platform) {
    case 'linkedin': return `https://www.linkedin.com/in/${handle}`;
    case 'instagram': return `https://www.instagram.com/${handle}`;
    case 'facebook': return `https://www.facebook.com/${handle}`;
    case 'x': return `https://x.com/${handle}`;
    case 'threads': return `https://www.threads.net/@${handle}`;
    case 'tiktok': return `https://www.tiktok.com/@${handle}`;
    case 'youtube': return `https://www.youtube.com/@${handle}`;
    case 'snapchat': return `https://www.snapchat.com/add/${handle}`;
    case 'pinterest': return `https://www.pinterest.com/${handle}`;
    case 'github': return `https://github.com/${handle}`;
  }
}

const publishingPlatforms: Platform[] = [
  'facebook',
  'linkedin',
  'instagram',
  'x',
  'threads',
  'tiktok',
  'youtube',
];

export function isPublishingPlatform(platform: SocialPlatform): platform is Platform {
  return publishingPlatforms.includes(platform as Platform);
}

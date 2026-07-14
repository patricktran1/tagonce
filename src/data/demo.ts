import type { BrandSettings, MentionEntity, Platform } from '../types';

const now = new Date().toISOString();

export const platformMeta: Record<
  Platform,
  { label: string; short: string; description: string; limit?: number }
> = {
  facebook: {
    label: 'Facebook',
    short: 'f',
    description: 'Page-ready long-form copy',
  },
  linkedin: {
    label: 'LinkedIn',
    short: 'in',
    description: 'Professional native post',
    limit: 3000,
  },
  instagram: {
    label: 'Instagram',
    short: '◎',
    description: 'Caption, handles and hashtags',
    limit: 2200,
  },
  x: {
    label: 'X',
    short: '𝕏',
    description: 'Concise post or thread starter',
    limit: 280,
  },
  threads: {
    label: 'Threads',
    short: '@',
    description: 'Conversational short-form post',
    limit: 500,
  },
  tiktok: {
    label: 'TikTok',
    short: '♪',
    description: 'Hook, script and caption',
    limit: 2200,
  },
  youtube: {
    label: 'YouTube',
    short: '▶',
    description: 'Shorts title and description',
    limit: 5000,
  },
};

export const allPlatforms = Object.keys(platformMeta) as Platform[];

export const demoEntities: MentionEntity[] = [
  {
    id: 'aion-ehr',
    displayName: 'AION EHR',
    type: 'brand',
    description: 'AI-native healthcare software',
    website: 'https://aionehr.com',
    initials: 'AI',
    usageCount: 8,
    createdAt: now,
    mappings: {
      facebook: {
        platform: 'facebook',
        displayName: 'AION EHR',
        handle: '@AIONEHR',
        platformId: 'page_demo_1001',
        nativeTagSupported: true,
        verified: true,
      },
      linkedin: {
        platform: 'linkedin',
        displayName: 'AION EHR',
        handle: '@AIONEHR',
        platformId: 'urn:li:organization:demo1001',
        nativeTagSupported: true,
        verified: true,
      },
      instagram: {
        platform: 'instagram',
        displayName: 'AION EHR',
        handle: '@aionehr',
        nativeTagSupported: true,
        verified: true,
      },
      x: {
        platform: 'x',
        displayName: 'AION EHR',
        handle: '@aionehr',
        nativeTagSupported: true,
        verified: true,
      },
      threads: {
        platform: 'threads',
        displayName: 'AION EHR',
        handle: '@aionehr',
        nativeTagSupported: true,
        verified: true,
      },
    },
  },
  {
    id: 'northstar-labs',
    displayName: 'Northstar Labs',
    type: 'company',
    description: 'Fictional product studio used for demo data',
    initials: 'NL',
    usageCount: 14,
    createdAt: now,
    mappings: {
      facebook: {
        platform: 'facebook',
        displayName: 'Northstar Labs',
        handle: '@NorthstarLabs',
        platformId: 'page_demo_1002',
        nativeTagSupported: true,
        verified: true,
      },
      linkedin: {
        platform: 'linkedin',
        displayName: 'Northstar Labs',
        handle: '@northstar-labs',
        platformId: 'urn:li:organization:demo1002',
        nativeTagSupported: true,
        verified: true,
      },
      instagram: {
        platform: 'instagram',
        displayName: 'Northstar Labs',
        handle: '@northstarlabs',
        nativeTagSupported: true,
        verified: true,
      },
      x: {
        platform: 'x',
        displayName: 'Northstar Labs',
        handle: '@northstarlabs',
        nativeTagSupported: true,
        verified: true,
      },
      threads: {
        platform: 'threads',
        displayName: 'Northstar Labs',
        handle: '@northstarlabs',
        nativeTagSupported: true,
        verified: true,
      },
      tiktok: {
        platform: 'tiktok',
        displayName: 'Northstar Labs',
        handle: '@northstar.lab',
        nativeTagSupported: true,
        verified: false,
      },
      youtube: {
        platform: 'youtube',
        displayName: 'Northstar Labs',
        handle: '@NorthstarLabs',
        nativeTagSupported: true,
        verified: true,
      },
    },
  },
  {
    id: 'maya-chen',
    displayName: 'Maya Chen',
    type: 'person',
    description: 'Fictional collaborator used for demo data',
    initials: 'MC',
    usageCount: 5,
    createdAt: now,
    mappings: {
      linkedin: {
        platform: 'linkedin',
        displayName: 'Maya Chen',
        handle: '@maya-chen',
        platformId: 'urn:li:person:demo1003',
        nativeTagSupported: true,
        verified: true,
      },
      instagram: {
        platform: 'instagram',
        displayName: 'Maya Chen',
        handle: '@mayacreates',
        nativeTagSupported: true,
        verified: true,
      },
      x: {
        platform: 'x',
        displayName: 'Maya Chen',
        handle: '@mayacreates',
        nativeTagSupported: true,
        verified: false,
      },
      threads: {
        platform: 'threads',
        displayName: 'Maya Chen',
        handle: '@mayacreates',
        nativeTagSupported: true,
        verified: true,
      },
    },
  },
];

export const defaultBrandSettings: BrandSettings = {
  brandName: 'Your Brand',
  audience: 'Founders, creators and modern teams',
  voice: 'Clear, decisive, intelligent and human',
  defaultCta: 'Learn more',
  preferredHashtags: 'AI, SocialMedia, CreatorTools',
};

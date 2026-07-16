export type Platform =
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'x'
  | 'threads'
  | 'tiktok'
  | 'youtube';

export type SocialPlatform =
  | Platform
  | 'snapchat'
  | 'pinterest'
  | 'github';

export type EntityType = 'person' | 'company' | 'brand' | 'organization';
export type CardMode = 'event' | 'personal' | 'custom';
export type ShareFieldKey =
  | 'title'
  | 'company'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'website'
  | 'eventName'
  | `social:${SocialPlatform}`;

export type ResolutionStatus =
  | 'resolved'
  | 'plain_text'
  | 'missing'
  | 'unsupported';

export type GenerationSource = 'ai' | 'rules';
export type ConnectionMethod = 'manual' | 'oauth';

export interface SharedSocialIdentity {
  handle?: string;
  profileUrl?: string;
}

export interface PlatformMapping {
  platform: Platform;
  displayName: string;
  handle?: string;
  platformId?: string;
  profileUrl?: string;
  nativeTagSupported: boolean;
  verified: boolean;
}

export interface MentionEntity {
  id: string;
  displayName: string;
  type: EntityType;
  description?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  metAt?: string;
  metOn?: string;
  notes?: string;
  memoryPhotoDataUrl?: string;
  sourceCardMode?: CardMode;
  socialProfiles?: Partial<Record<SocialPlatform, SharedSocialIdentity>>;
  initials: string;
  mappings: Partial<Record<Platform, PlatformMapping>>;
  usageCount: number;
  createdAt: string;
}

export interface MentionResolution {
  entityId: string;
  entityName: string;
  platform: Platform;
  renderedText: string;
  status: ResolutionStatus;
  nativeTagSupported: boolean;
  detail: string;
}

export interface PlatformVariant {
  platform: Platform;
  body: string;
  title?: string;
  hashtags: string[];
  characterCount: number;
  limit?: number;
  mentionResolutions: MentionResolution[];
  format: string;
  generatedBy?: GenerationSource;
}

export interface Campaign {
  id: string;
  title: string;
  masterText: string;
  selectedEntityIds: string[];
  selectedPlatforms: Platform[];
  variants: PlatformVariant[];
  status:
    | 'draft'
    | 'ready'
    | 'scheduled'
    | 'publishing'
    | 'published'
    | 'partial';
  createdAt: string;
  scheduledFor?: string;
  mediaName?: string;
}

export interface BrandSettings {
  brandName: string;
  audience: string;
  voice: string;
  defaultCta: string;
  preferredHashtags: string;
}

export interface SocialConnection {
  platform: Platform;
  connected: boolean;
  accountName?: string;
  accountType?: string;
  handle?: string;
  profileUrl?: string;
  platformId?: string;
  connectionMethod?: ConnectionMethod;
  lastCheckedAt?: string;
}

export interface MyProfile {
  displayName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  eventName: string;
  eventEndsAt: string;
  eventStartAt?: string;
  eventEndAt?: string;
  eventLocation?: string;
  eventUrl?: string;
  eventDescription?: string;
  socialProfiles?: Partial<Record<SocialPlatform, SharedSocialIdentity>>;
  cardSelections?: Partial<Record<CardMode, ShareFieldKey[]>>;
}

export interface ShareCardPayload {
  version: 1;
  mode: CardMode;
  createdAt: string;
  expiresAt?: string;
  eventName?: string;
  eventStartAt?: string;
  eventEndAt?: string;
  eventLocation?: string;
  eventUrl?: string;
  profile: {
    displayName: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    website?: string;
  };
  socials: Partial<Record<SocialPlatform, SharedSocialIdentity>>;
}

import type { Platform, PlatformVariant } from '../types';

export interface PublishResult {
  platform: Platform;
  status: 'published' | 'failed';
  externalId?: string;
  url?: string;
  error?: string;
}

export interface PlatformAdapter {
  platform: Platform;
  validate(variant: PlatformVariant): string[];
  publish(variant: PlatformVariant): Promise<PublishResult>;
}

class MockPlatformAdapter implements PlatformAdapter {
  platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  validate(variant: PlatformVariant): string[] {
    const errors: string[] = [];
    if (!variant.body.trim()) errors.push('Post body is empty');
    if (variant.limit && variant.characterCount > variant.limit) {
      errors.push(`Post exceeds the ${variant.limit}-character platform limit`);
    }
    return errors;
  }

  async publish(): Promise<PublishResult> {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return {
      platform: this.platform,
      status: 'published',
      externalId: `demo_${this.platform}_${Date.now()}`,
      url: '#',
    };
  }
}

export function getAdapter(platform: Platform): PlatformAdapter {
  return new MockPlatformAdapter(platform);
}

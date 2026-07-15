import clsx from 'clsx';
import { socialPlatformMeta } from '../data/socials';
import type { SocialPlatform } from '../types';

interface PlatformMarkProps {
  platform: SocialPlatform;
  size?: 'sm' | 'md';
}

export function PlatformMark({ platform, size = 'md' }: PlatformMarkProps) {
  return (
    <span className={clsx('platform-mark', `platform-${platform}`, `platform-mark-${size}`)}>
      {socialPlatformMeta[platform].short}
    </span>
  );
}
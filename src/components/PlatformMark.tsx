import clsx from 'clsx';
import { platformMeta } from '../data/demo';
import type { Platform } from '../types';

interface PlatformMarkProps {
  platform: Platform;
  size?: 'sm' | 'md';
}

export function PlatformMark({ platform, size = 'md' }: PlatformMarkProps) {
  return (
    <span className={clsx('platform-mark', `platform-${platform}`, `platform-mark-${size}`)}>
      {platformMeta[platform].short}
    </span>
  );
}

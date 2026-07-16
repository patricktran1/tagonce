import { useEffect, useState } from 'react';

interface ProfileAvatarProps {
  name: string;
  src?: string;
  className?: string;
  alt?: string;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TO';
}

export function ProfileAvatar({ name, src, className = '', alt }: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`profile-avatar ${className}`.trim()} aria-label={alt || `${name || 'TagOnce user'} profile picture`}>
      {src && !failed
        ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span>{initialsFor(name)}</span>}
    </span>
  );
}

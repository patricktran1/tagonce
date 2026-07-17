import { useState } from 'react';
import { decodeCardPayload } from '../lib/cardExchange';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
import { ProfileAvatar } from './ProfileAvatar';
import { ReciprocalExchangePanel } from './ReciprocalExchangePanel';
import { ScanPage } from './ScanPage';

interface ScanExchangePageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  onChangeProfile: (profile: MyProfile) => void;
  onSaveContact: (entity: MentionEntity) => void;
  onOpenAddressBook: () => void;
  onOpenMyCards: () => void;
}

function incomingCardFromUrl() {
  const token = new URLSearchParams(window.location.search).get('card') || '';
  if (!token) return null;
  try {
    return decodeCardPayload(token);
  } catch {
    return null;
  }
}

export function ScanExchangePage({
  profile,
  connections,
  onChangeProfile,
  onSaveContact,
  onOpenAddressBook,
  onOpenMyCards,
}: ScanExchangePageProps) {
  const [incoming] = useState<ShareCardPayload | null>(incomingCardFromUrl);

  function saveContactWithAvatar(entity: MentionEntity) {
    onSaveContact({
      ...entity,
      avatarUrl: incoming?.profile.avatarUrl || entity.avatarUrl,
    });
  }

  return (
    <div className="scan-exchange-page">
      {incoming?.profile.avatarUrl && (
        <section className="incoming-avatar-banner" aria-label={`${incoming.profile.displayName} profile photo`}>
          <ProfileAvatar
            name={incoming.profile.displayName}
            src={incoming.profile.avatarUrl}
            className="incoming-card-avatar"
          />
          <span>
            <small>TAGONCE PROFILE</small>
            <strong>{incoming.profile.displayName}</strong>
            <p>{[incoming.profile.title, incoming.profile.company].filter(Boolean).join(' · ') || 'Shared a contact card with you'}</p>
          </span>
        </section>
      )}

      <ScanPage onSaveContact={saveContactWithAvatar} onOpenAddressBook={onOpenAddressBook} />
      {incoming && (
        <ReciprocalExchangePanel
          incoming={incoming}
          profile={profile}
          connections={connections}
          onChangeProfile={onChangeProfile}
          onOpenMyCards={onOpenMyCards}
        />
      )}
    </div>
  );
}

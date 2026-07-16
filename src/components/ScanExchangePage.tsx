import { useState } from 'react';
import { decodeCardPayload } from '../lib/cardExchange';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
import { ReciprocalExchangePanel } from './ReciprocalExchangePanel';
import { ScanPage } from './ScanPage';

interface ScanExchangePageProps {
  profile: MyProfile;
  connections: SocialConnection[];
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
  onSaveContact,
  onOpenAddressBook,
  onOpenMyCards,
}: ScanExchangePageProps) {
  const [incoming] = useState<ShareCardPayload | null>(incomingCardFromUrl);

  return (
    <div className="scan-exchange-page">
      <ScanPage onSaveContact={onSaveContact} onOpenAddressBook={onOpenAddressBook} />
      {incoming && (
        <ReciprocalExchangePanel
          incoming={incoming}
          profile={profile}
          connections={connections}
          onOpenMyCards={onOpenMyCards}
        />
      )}
    </div>
  );
}

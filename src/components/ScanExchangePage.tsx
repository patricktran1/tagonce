import { ContactRound, Repeat2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { decodeCardPayload } from '../lib/cardExchange';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
import { RecipientProfileCard } from './RecipientProfileCard';
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

  function scrollToExchangeStep(selector: string) {
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div className={`scan-exchange-page${incoming ? ' has-incoming-card' : ''}`}>
      {incoming && (
        <nav className="exchange-journey-nav" aria-label="Exchange steps">
          <button type="button" onClick={() => scrollToExchangeStep('#tagonce-recipient-card')}>
            <UserRound size={17} />
            <span>Their card</span>
          </button>
          <button type="button" onClick={() => scrollToExchangeStep('.memory-capture-panel')}>
            <ContactRound size={17} />
            <span>Save context</span>
          </button>
          <button type="button" onClick={() => scrollToExchangeStep('#tagonce-return-card')}>
            <Repeat2 size={17} />
            <span>Share back</span>
          </button>
        </nav>
      )}

      {incoming && <RecipientProfileCard payload={incoming} />}

      <ScanPage onSaveContact={saveContactWithAvatar} onOpenAddressBook={onOpenAddressBook} />

      {incoming && (
        <div id="tagonce-return-card" className="return-card-anchor">
          <ReciprocalExchangePanel
            incoming={incoming}
            profile={profile}
            connections={connections}
            onChangeProfile={onChangeProfile}
            onOpenMyCards={onOpenMyCards}
          />
        </div>
      )}
    </div>
  );
}

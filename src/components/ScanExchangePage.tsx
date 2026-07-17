import { ContactRound, Repeat2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { decodeCardPayload, extractCardToken } from '../lib/cardExchange';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
import { InAppQrScanner } from './InAppQrScanner';
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

type ExchangeStep = 'card' | 'context' | 'return';

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
  const [activeStep, setActiveStep] = useState<ExchangeStep>('card');
  const cardParameter = new URLSearchParams(window.location.search).get('card') || '';
  const initialScanError = cardParameter && !incoming
    ? 'That QR is not a valid TagOnce card. Ask the person to show their current TagOnce QR.'
    : '';

  function saveContactWithAvatar(entity: MentionEntity) {
    onSaveContact({
      ...entity,
      avatarUrl: incoming?.profile.avatarUrl || entity.avatarUrl,
    });
  }

  function openExchangeStep(step: ExchangeStep, selector: string) {
    setActiveStep(step);
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function openScannedCard(value: string) {
    const token = extractCardToken(value);
    if (!token) return 'No card code was found in that QR.';

    try {
      decodeCardPayload(token);
    } catch (scanError) {
      return scanError instanceof Error
        ? scanError.message
        : 'This QR is not a valid TagOnce card.';
    }

    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('card', token);
    window.location.assign(url.toString());
    return undefined;
  }

  const pageClasses = [
    'scan-exchange-page',
    incoming ? 'has-incoming-card' : 'has-in-app-scanner',
    incoming?.eventName ? 'has-event-context' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={pageClasses}>
      {!incoming && <InAppQrScanner initialError={initialScanError} onDetected={openScannedCard} />}

      {incoming && (
        <nav className="exchange-journey-nav" aria-label="Exchange steps">
          <button
            className={activeStep === 'card' ? 'active' : ''}
            type="button"
            aria-pressed={activeStep === 'card'}
            onClick={() => openExchangeStep('card', '#tagonce-recipient-card')}
          >
            <UserRound size={17} />
            <span>Their card</span>
          </button>
          <button
            className={activeStep === 'context' ? 'active' : ''}
            type="button"
            aria-pressed={activeStep === 'context'}
            onClick={() => openExchangeStep('context', '.memory-capture-panel')}
          >
            <ContactRound size={17} />
            <span>Save context</span>
          </button>
          <button
            className={activeStep === 'return' ? 'active' : ''}
            type="button"
            aria-pressed={activeStep === 'return'}
            onClick={() => openExchangeStep('return', '#tagonce-return-card')}
          >
            <Repeat2 size={17} />
            <span>Share back</span>
          </button>
        </nav>
      )}

      {incoming && <RecipientProfileCard payload={incoming} />}

      {incoming && <ScanPage onSaveContact={saveContactWithAvatar} onOpenAddressBook={onOpenAddressBook} />}

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

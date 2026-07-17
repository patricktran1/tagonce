import { Check, ContactRound, Repeat2, ScanLine, UserRound } from 'lucide-react';
import { useState } from 'react';
import { decodeCardPayload, extractCardToken } from '../lib/cardExchange';
import { sessionMeetingContext, type ActiveEventSession } from '../lib/eventSession';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
import { InAppQrScanner } from './InAppQrScanner';
import { RecipientProfileCard } from './RecipientProfileCard';
import { ReciprocalExchangePanel } from './ReciprocalExchangePanel';
import { ScanPage } from './ScanPage';

interface ScanExchangePageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  activeEventSession: ActiveEventSession | null;
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
  activeEventSession,
  onChangeProfile,
  onSaveContact,
  onOpenAddressBook,
  onOpenMyCards,
}: ScanExchangePageProps) {
  const [incoming, setIncoming] = useState<ShareCardPayload | null>(incomingCardFromUrl);
  const [activeStep, setActiveStep] = useState<ExchangeStep>('card');
  const [savedName, setSavedName] = useState('');
  const cardParameter = new URLSearchParams(window.location.search).get('card') || '';
  const initialScanError = cardParameter && !incoming
    ? 'That QR is not a valid TagOnce card. Ask the person to show their current TagOnce QR.'
    : '';

  const returnIncoming = incoming && activeEventSession && !incoming.eventName
    ? {
        ...incoming,
        eventName: activeEventSession.eventName,
        eventStartAt: activeEventSession.eventStartAt,
        eventEndAt: activeEventSession.eventEndAt,
        eventLocation: activeEventSession.eventLocation,
        eventUrl: activeEventSession.eventUrl,
      }
    : incoming;

  function saveContactWithAvatar(entity: MentionEntity) {
    onSaveContact({
      ...entity,
      avatarUrl: incoming?.profile.avatarUrl || entity.avatarUrl,
    });
    if (activeEventSession) setSavedName(entity.displayName);
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

  function scanNextPerson() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('view', 'scan');
    window.history.replaceState({}, '', url);
    setIncoming(null);
    setSavedName('');
    setActiveStep('card');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pageClasses = [
    'scan-exchange-page',
    incoming ? 'has-incoming-card' : 'has-in-app-scanner',
    incoming?.eventName || activeEventSession ? 'has-event-context' : '',
    activeEventSession ? 'has-live-event-session' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={pageClasses}>
      {activeEventSession && (
        <section className="live-scan-context" aria-label="Active event context">
          <span className="live-scan-pulse" aria-hidden="true" />
          <span>
            <small>SCANNING FOR</small>
            <strong>{activeEventSession.eventName}</strong>
            <span>{sessionMeetingContext(activeEventSession)}</span>
          </span>
        </section>
      )}

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

      {savedName && activeEventSession && (
        <section className="live-scan-next-card" aria-live="polite">
          <span className="live-scan-next-check"><Check size={20} /></span>
          <span>
            <small>SAVED TO {activeEventSession.eventName.toUpperCase()}</small>
            <strong>{savedName} is in this event session.</strong>
            <p>Keep the line moving. TagOnce will assemble the recap automatically.</p>
          </span>
          <button className="button primary" type="button" onClick={scanNextPerson}><ScanLine size={17} /> Scan next person</button>
          <button className="button secondary" type="button" onClick={onOpenAddressBook}>View contacts</button>
        </section>
      )}

      {returnIncoming && (
        <div id="tagonce-return-card" className="return-card-anchor">
          <ReciprocalExchangePanel
            incoming={returnIncoming}
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

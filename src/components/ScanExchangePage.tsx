import { CalendarCheck, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { decodeCardPayload } from '../lib/cardExchange';
import {
  connectGoogleCalendar,
  getCalendarStatus,
  type CalendarConnectionState,
} from '../lib/calendarService';
import type { MentionEntity, MyProfile, ShareCardPayload, SocialConnection } from '../types';
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
  const [calendarState, setCalendarState] = useState<CalendarConnectionState>('checking');

  useEffect(() => {
    let cancelled = false;
    async function checkDeviceCalendar() {
      try {
        const status = await getCalendarStatus();
        if (cancelled) return;
        if (!status.configured) setCalendarState('unconfigured');
        else setCalendarState(status.connected ? 'connected' : 'disconnected');
      } catch {
        if (!cancelled) setCalendarState('disconnected');
      }
    }
    void checkDeviceCalendar();
    return () => { cancelled = true; };
  }, []);

  function connectOnThisDevice() {
    setCalendarState('connecting');
    connectGoogleCalendar();
  }

  return (
    <div className="scan-exchange-page">
      <section className={`mobile-google-device-status state-${calendarState}`} aria-label="Google Calendar status on this device">
        <span className="mobile-google-device-icon">
          {calendarState === 'checking' || calendarState === 'connecting'
            ? <Loader2 className="spin" size={18} />
            : calendarState === 'connected'
              ? <CalendarCheck size={18} />
              : <ShieldCheck size={18} />}
        </span>
        <span>
          <strong>
            {calendarState === 'connected'
              ? 'Google Calendar connected on this phone'
              : calendarState === 'connecting'
                ? 'Opening Google…'
                : calendarState === 'checking'
                  ? 'Checking Google Calendar…'
                  : 'Google Calendar is not connected on this phone'}
          </strong>
          <small>
            {calendarState === 'connected'
              ? 'Nearby-event suggestions are available on this device.'
              : 'Calendar access is separate on every browser and device.'}
          </small>
        </span>
        {calendarState === 'disconnected' && (
          <button type="button" onClick={connectOnThisDevice}><LogIn size={15} /> Connect</button>
        )}
      </section>

      <ScanPage onSaveContact={onSaveContact} onOpenAddressBook={onOpenAddressBook} />
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

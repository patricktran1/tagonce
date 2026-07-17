import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ConnectionState = 'online' | 'offline' | 'restored';

export function NetworkStatus() {
  const [state, setState] = useState<ConnectionState>(() => navigator.onLine ? 'online' : 'offline');
  const restoredTimeout = useRef<number | null>(null);

  useEffect(() => {
    function clearRestoredTimeout() {
      if (restoredTimeout.current !== null) {
        window.clearTimeout(restoredTimeout.current);
        restoredTimeout.current = null;
      }
    }

    function markOffline() {
      clearRestoredTimeout();
      setState('offline');
    }

    function markOnline() {
      clearRestoredTimeout();
      setState('restored');
      restoredTimeout.current = window.setTimeout(() => setState('online'), 2600);
    }

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);
    return () => {
      clearRestoredTimeout();
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
    };
  }, []);

  if (state === 'online') return null;

  const offline = state === 'offline';
  return (
    <div className={`network-status ${state}`} role="status" aria-live="polite">
      {offline ? <WifiOff size={18} /> : <Wifi size={18} />}
      <span>
        <strong>{offline ? 'Offline mode' : 'Back online'}</strong>
        <small>{offline ? 'Your saved cards, QR display and contacts remain available.' : 'Live event and Calendar features are available again.'}</small>
      </span>
    </div>
  );
}

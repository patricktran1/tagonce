import { useEffect, useRef, useState } from 'react';
import { rememberGoogleCalendarReturn } from '../lib/calendarService';

type GoogleIdentityApi = {
  initialize: (options: {
    client_id: string;
    ux_mode: 'redirect';
    login_uri: string;
    context: 'use';
    auto_select: boolean;
    itp_support: boolean;
    use_fedcm_for_button: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: {
    type: 'standard';
    theme: 'outline';
    size: 'large';
    text: 'continue_with';
    shape: 'rectangular';
    logo_alignment: 'left';
    width: number;
    click_listener: () => void;
  }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  }
}

const SCRIPT_ID = 'tagonce-google-identity-services';
let scriptPromise: Promise<void> | null = null;

function googleClientId() {
  const environment = import.meta.env as Record<string, string | undefined>;
  return environment.VITE_GOOGLE_CALENDAR_CLIENT_ID?.trim() || '';
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoad = () => resolve();
    const handleError = () => reject(new Error('Google sign-in could not be loaded.'));

    if (existing) {
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface GoogleSsoButtonProps {
  onStart?: () => void;
}

export function GoogleSsoButton({ onStart }: GoogleSsoButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onStartRef = useRef(onStart);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  useEffect(() => {
    let cancelled = false;
    const clientId = googleClientId();

    if (!clientId) {
      setError('Google sign-in is not configured for this deployment.');
      return undefined;
    }

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const identity = window.google?.accounts?.id;
        if (!identity) throw new Error('Google sign-in is unavailable in this browser.');

        identity.initialize({
          client_id: clientId,
          ux_mode: 'redirect',
          login_uri: `${window.location.origin}/api/google-calendar/callback`,
          context: 'use',
          auto_select: false,
          itp_support: true,
          use_fedcm_for_button: true,
        });

        hostRef.current.replaceChildren();
        identity.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 340,
          click_listener: () => {
            rememberGoogleCalendarReturn('event');
            onStartRef.current?.();
          },
        });
        setReady(true);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Google sign-in could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="google-sso-control">
      <div className="google-sso-button-host" ref={hostRef} />
      {!ready && !error && <span className="google-sso-loading">Loading Google sign-in…</span>}
      {error && <span className="google-sso-error">{error}</span>}
    </div>
  );
}

import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Repeat2,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { allSocialPlatforms, socialPlatformMeta, socialProfileUrl } from '../data/socials';
import { createShareUrl } from '../lib/cardExchange';
import { downloadQrPng, shareQr, type QrExportMeta } from '../lib/qrExport';
import type {
  CardMode,
  MyProfile,
  ShareCardPayload,
  ShareFieldKey,
  SharedSocialIdentity,
  SocialConnection,
  SocialPlatform,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface ReciprocalExchangePanelProps {
  incoming: ShareCardPayload;
  profile: MyProfile;
  connections: SocialConnection[];
  onOpenMyCards: () => void;
}

type ExchangeMethod = 'share' | 'copy' | 'download' | 'qr';

type ExchangeReceipt = {
  incomingName: string;
  eventName?: string;
  outgoingMode: CardMode;
  method: ExchangeMethod;
  sharedAt: string;
};

const RECEIPT_KEY = 'tagonce.exchange.receipts.v1';

const defaultSelections: Record<CardMode, ShareFieldKey[]> = {
  event: ['title', 'company', 'email', 'website', 'eventName', 'social:linkedin'],
  personal: [
    'title',
    'company',
    'email',
    'phone',
    'whatsapp',
    'website',
    'social:linkedin',
    'social:instagram',
    'social:facebook',
    'social:x',
  ],
  custom: ['email', 'social:linkedin'],
};

function incomingFingerprint(payload: ShareCardPayload) {
  const social = Object.entries(payload.socials)
    .map(([platform, identity]) => `${platform}:${identity?.profileUrl || identity?.handle || ''}`)
    .sort()
    .join('|');
  return [payload.profile.displayName, payload.profile.email, payload.profile.phone, payload.eventName, social]
    .filter(Boolean)
    .join('::')
    .toLowerCase();
}

function loadReceipt(payload: ShareCardPayload) {
  try {
    const receipts = JSON.parse(window.localStorage.getItem(RECEIPT_KEY) || '{}') as Record<string, ExchangeReceipt>;
    return receipts[incomingFingerprint(payload)] || null;
  } catch {
    return null;
  }
}

function saveReceipt(payload: ShareCardPayload, receipt: ExchangeReceipt) {
  try {
    const receipts = JSON.parse(window.localStorage.getItem(RECEIPT_KEY) || '{}') as Record<string, ExchangeReceipt>;
    receipts[incomingFingerprint(payload)] = receipt;
    window.localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
  } catch {
    // The exchange still works when local storage is unavailable.
  }
}

function eventTimeSummary(payload: ShareCardPayload) {
  if (!payload.eventStartAt) return '';
  const start = new Date(payload.eventStartAt);
  if (Number.isNaN(start.getTime())) return '';
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = payload.eventEndAt ? new Date(payload.eventEndAt) : null;
  return end && !Number.isNaN(end.getTime())
    ? `${day.format(start)} · ${time.format(start)}–${time.format(end)}`
    : `${day.format(start)} · ${time.format(start)}`;
}

function socialDisplay(identity: SharedSocialIdentity) {
  if (identity.handle?.trim()) return identity.handle.trim().replace(/^@?/, '@');
  if (!identity.profileUrl) return '';
  try {
    const url = new URL(identity.profileUrl);
    return url.pathname.replace(/^\/+|\/+$/g, '') || url.hostname;
  } catch {
    return identity.profileUrl;
  }
}

export function ReciprocalExchangePanel({ incoming, profile, connections, onOpenMyCards }: ReciprocalExchangePanelProps) {
  const hasEventContext = Boolean(incoming.eventName);
  const fingerprint = incomingFingerprint(incoming);
  const [mode, setMode] = useState<CardMode>(hasEventContext ? 'event' : 'personal');
  const [receipt, setReceipt] = useState<ExchangeReceipt | null>(() => loadReceipt(incoming));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'share' | 'download' | ''>('');
  const [presenting, setPresenting] = useState(false);
  const exportQrRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setReceipt(loadReceipt(incoming));
    setMode(hasEventContext ? 'event' : 'personal');
  }, [fingerprint, hasEventContext, incoming]);

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => setStatus(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!presenting) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPresenting(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [presenting]);

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.platform, connection])),
    [connections],
  );

  const payload = useMemo<ShareCardPayload>(() => {
    const selected = profile.cardSelections?.[mode] ?? defaultSelections[mode];
    const includes = (key: ShareFieldKey) => selected.includes(key);
    const socials: ShareCardPayload['socials'] = {};

    allSocialPlatforms.forEach((platform) => {
      if (!includes(`social:${platform}`)) return;
      const saved = profile.socialProfiles?.[platform];
      const legacy = connectionMap.get(platform as SocialConnection['platform']);
      const identity: SharedSocialIdentity = saved?.handle || saved?.profileUrl
        ? saved
        : { handle: legacy?.handle, profileUrl: legacy?.profileUrl };
      const url = socialProfileUrl(platform, identity);
      if (!identity.handle && !url) return;
      socials[platform] = {
        handle: identity.handle?.trim() || undefined,
        profileUrl: url || undefined,
      };
    });

    const carriesEvent = mode === 'event' && hasEventContext;
    return {
      version: 1,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt: carriesEvent ? incoming.expiresAt : undefined,
      eventName: carriesEvent ? incoming.eventName : undefined,
      eventStartAt: carriesEvent ? incoming.eventStartAt : undefined,
      eventEndAt: carriesEvent ? incoming.eventEndAt : undefined,
      eventLocation: carriesEvent ? incoming.eventLocation : undefined,
      eventUrl: carriesEvent ? incoming.eventUrl : undefined,
      profile: {
        displayName: profile.displayName || 'Your name',
        title: includes('title') ? profile.title || undefined : undefined,
        company: includes('company') ? profile.company || undefined : undefined,
        email: includes('email') ? profile.email || undefined : undefined,
        phone: includes('phone') ? profile.phone || undefined : undefined,
        whatsapp: includes('whatsapp') ? profile.whatsapp || undefined : undefined,
        website: includes('website') ? profile.website || undefined : undefined,
      },
      socials,
    };
  }, [connectionMap, hasEventContext, incoming, mode, profile]);

  const shareUrl = useMemo(() => createShareUrl(payload), [payload]);
  const socialEntries = Object.entries(payload.socials) as Array<[SocialPlatform, SharedSocialIdentity]>;
  const subtitle = [payload.profile.title, payload.profile.company].filter(Boolean).join(' · ');
  const exportMeta: QrExportMeta = {
    displayName: payload.profile.displayName,
    subtitle,
    modeLabel: mode === 'event' ? 'Return event card' : 'Return personal card',
    eventName: payload.eventName,
    eventTime: eventTimeSummary(payload),
    eventLocation: payload.eventLocation,
  };

  function recordExchange(method: ExchangeMethod) {
    const next: ExchangeReceipt = {
      incomingName: incoming.profile.displayName,
      eventName: incoming.eventName,
      outgoingMode: mode,
      method,
      sharedAt: new Date().toISOString(),
    };
    setReceipt(next);
    saveReceipt(incoming, next);
  }

  async function shareBack() {
    if (!exportQrRef.current) return;
    setBusy('share');
    try {
      const result = await shareQr(exportQrRef.current, exportMeta, shareUrl);
      if (result === 'unsupported') {
        await navigator.clipboard.writeText(shareUrl);
        recordExchange('copy');
        setStatus('Native sharing is unavailable, so your card link was copied');
      } else {
        recordExchange('share');
        setStatus(result === 'file' ? 'Your QR card was shared' : 'Your card link was shared');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof Error ? error.message : 'Your card could not be shared');
    } finally {
      setBusy('');
    }
  }

  async function copyBack() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      recordExchange('copy');
      setStatus('Your card link was copied');
    } catch {
      setStatus('Copy was blocked by this browser');
    }
  }

  async function downloadBack() {
    if (!exportQrRef.current) return;
    setBusy('download');
    try {
      await downloadQrPng(exportQrRef.current, exportMeta);
      recordExchange('download');
      setStatus('Your return QR was downloaded');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Your QR could not be downloaded');
    } finally {
      setBusy('');
    }
  }

  function showBackQr() {
    recordExchange('qr');
    setPresenting(true);
  }

  return (
    <section className={`panel reciprocal-exchange-panel${receipt ? ' exchange-complete' : ''}`}>
      <div className="reciprocal-exchange-heading">
        <span className="reciprocal-exchange-icon"><Repeat2 size={22} /></span>
        <span>
          <small className="eyebrow">Two-way connection</small>
          <h3>Share your card back</h3>
          <p>Turn this scan into a real exchange instead of a one-sided contact save.</p>
        </span>
        {receipt && <span className="exchange-complete-pill"><Check size={13} /> Shared back</span>}
      </div>

      {hasEventContext && (
        <div className="return-card-mode-switch" role="group" aria-label="Return card context">
          <button className={mode === 'event' ? 'active' : ''} type="button" onClick={() => setMode('event')}>
            <Sparkles size={15} /> Same event
          </button>
          <button className={mode === 'personal' ? 'active' : ''} type="button" onClick={() => setMode('personal')}>
            <UserRound size={15} /> Personal
          </button>
        </div>
      )}

      <div className="return-card-preview">
        <div className="return-card-copy">
          <span className="return-avatar">{profile.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'TO'}</span>
          <span>
            <small>{payload.eventName || (mode === 'personal' ? 'Personal card' : 'Event card')}</small>
            <strong>{payload.profile.displayName}</strong>
            <p>{subtitle || 'Selected contact details and social profiles'}</p>
          </span>
        </div>
        <div className="return-card-mini-qr">
          <QRCodeSVG value={shareUrl} size={126} level="L" marginSize={2} />
        </div>
      </div>

      {payload.eventName && (
        <div className="return-event-context">
          <Sparkles size={15} />
          <span><strong>{payload.eventName}</strong><small>{[eventTimeSummary(payload), payload.eventLocation].filter(Boolean).join(' · ')}</small></span>
        </div>
      )}

      <div className="return-social-row">
        {socialEntries.slice(0, 5).map(([platform, identity]) => (
          <span key={platform} title={`${socialPlatformMeta[platform].label}: ${socialDisplay(identity)}`}>
            <PlatformMark platform={platform} size="sm" />
          </span>
        ))}
        <small>{socialEntries.length} social {socialEntries.length === 1 ? 'profile' : 'profiles'} · {Object.values(payload.profile).filter(Boolean).length} identity fields</small>
      </div>

      <div className="reciprocal-exchange-actions">
        <button className="button primary" type="button" disabled={Boolean(busy)} onClick={() => void shareBack()}>
          <Share2 size={17} /> {busy === 'share' ? 'Opening share…' : 'Share my card'}
        </button>
        <button className="button secondary" type="button" onClick={showBackQr}><Maximize2 size={17} /> Show my QR</button>
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void downloadBack()}><Download size={17} /> Download</button>
        <button className="button secondary" type="button" onClick={() => void copyBack()}><Copy size={17} /> Copy link</button>
      </div>

      <div className="reciprocal-exchange-footer">
        <button className="text-button" type="button" onClick={onOpenMyCards}>Edit what my card shares <ExternalLink size={13} /></button>
        {receipt && <span>Last shared {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(receipt.sharedAt))}</span>}
      </div>
      {status && <div className="exchange-status"><Check size={14} /> {status}</div>}

      <div className="qr-export-source" aria-hidden="true">
        <QRCodeSVG ref={exportQrRef} value={shareUrl} size={1024} level="L" marginSize={4} />
      </div>

      {presenting && (
        <div className="qr-presentation-overlay reciprocal-presentation" role="dialog" aria-modal="true" aria-label="Share my TagOnce card back">
          <button className="qr-presentation-close" type="button" onClick={() => setPresenting(false)} aria-label="Close return QR"><X size={22} /></button>
          <div className="qr-presentation-card">
            <span className="qr-presentation-brand">TAGONCE HANDSHAKE</span>
            <span className="qr-presentation-mode">{payload.eventName || 'Personal return card'}</span>
            <h2>{payload.profile.displayName}</h2>
            {subtitle && <p>{subtitle}</p>}
            <div className="qr-presentation-code"><QRCodeSVG value={shareUrl} size={520} level="L" marginSize={3} /></div>
            <strong>Scan to connect back</strong>
            <small>Once they scan, both sides have a TagOnce card from the same encounter.</small>
          </div>
        </div>
      )}
    </section>
  );
}

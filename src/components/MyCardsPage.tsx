import {
  BriefcaseBusiness,
  Check,
  Copy,
  Download,
  IdCard,
  QrCode,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createShareUrl, downloadVCard } from '../lib/cardExchange';
import type { CardMode, MyProfile, Platform, ShareCardPayload, SocialConnection } from '../types';
import { PlatformMark } from './PlatformMark';

interface MyCardsPageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  onChange: (profile: MyProfile) => void;
}

const personalPlatforms: Platform[] = [
  'linkedin',
  'instagram',
  'facebook',
  'x',
  'threads',
  'tiktok',
  'youtube',
];

export function MyCardsPage({ profile, connections, onChange }: MyCardsPageProps) {
  const [mode, setMode] = useState<CardMode>('event');
  const [copied, setCopied] = useState(false);

  function update<K extends keyof MyProfile>(key: K, value: MyProfile[K]) {
    onChange({ ...profile, [key]: value });
  }

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.platform, connection])),
    [connections],
  );

  const payload = useMemo<ShareCardPayload>(() => {
    const platforms = mode === 'event' ? (['linkedin'] as Platform[]) : personalPlatforms;
    const socials: ShareCardPayload['socials'] = {};

    platforms.forEach((platform) => {
      const connection = connectionMap.get(platform);
      if (connection?.handle || connection?.profileUrl) {
        socials[platform] = {
          handle: connection.handle,
          profileUrl: connection.profileUrl,
        };
      }
    });

    let expiresAt: string | undefined;
    if (mode === 'event' && profile.eventEndsAt) {
      const date = new Date(`${profile.eventEndsAt}T23:59:59`);
      if (!Number.isNaN(date.getTime())) expiresAt = date.toISOString();
    }

    return {
      version: 1,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt,
      eventName: mode === 'event' ? profile.eventName || undefined : undefined,
      profile: {
        displayName: profile.displayName || 'Your name',
        title: profile.title || undefined,
        company: profile.company || undefined,
        email: profile.email || undefined,
        phone: mode === 'personal' ? profile.phone || undefined : undefined,
        whatsapp: mode === 'personal' ? profile.whatsapp || undefined : undefined,
        website: profile.website || undefined,
      },
      socials,
    };
  }, [connectionMap, mode, profile]);

  const shareUrl = useMemo(() => createShareUrl(payload), [payload]);
  const activeSocials = Object.keys(payload.socials).length;

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="page-stack card-studio-page">
      <section className="card-studio-hero">
        <div>
          <span className="hero-kicker">Contextual identity exchange</span>
          <h2>Share the right version of you.</h2>
          <p>
            Use an event card for professional encounters and a personal card when the relationship
            earns more access. Every scan can become a contact, a memory and a future correct tag.
          </p>
        </div>
        <div className="privacy-promise">
          <ShieldCheck size={18} />
          <span><strong>You choose every field.</strong><small>No passwords. No hidden contact sharing.</small></span>
        </div>
      </section>

      <div className="card-studio-grid">
        <section className="panel card-profile-editor">
          <div className="panel-heading">
            <div>
              <span className="step-badge">YOU</span>
              <div><h3>Your contact identity</h3><p>These details generate both contextual cards.</p></div>
            </div>
          </div>

          <div className="settings-fields card-profile-fields">
            <label className="field"><span>Name</span><input value={profile.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="Patrick Tran" /></label>
            <div className="two-field-row">
              <label className="field"><span>Title</span><input value={profile.title} onChange={(event) => update('title', event.target.value)} placeholder="Founder" /></label>
              <label className="field"><span>Company</span><input value={profile.company} onChange={(event) => update('company', event.target.value)} placeholder="AION EHR" /></label>
            </div>
            <div className="two-field-row">
              <label className="field"><span>Email</span><input type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} placeholder="you@company.com" /></label>
              <label className="field"><span>Website</span><input value={profile.website} onChange={(event) => update('website', event.target.value)} placeholder="https://..." /></label>
            </div>
            <div className="two-field-row">
              <label className="field"><span>Phone</span><input value={profile.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Personal card only" /></label>
              <label className="field"><span>WhatsApp</span><input value={profile.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} placeholder="Number or wa.me link" /></label>
            </div>
            <div className="event-context-fields">
              <div className="field-heading"><BriefcaseBusiness size={17} /><div><strong>Today’s event context</strong><small>Included only on the Event card.</small></div></div>
              <div className="two-field-row">
                <label className="field"><span>Event name</span><input value={profile.eventName} onChange={(event) => update('eventName', event.target.value)} placeholder="AGI Summit 2026" /></label>
                <label className="field"><span>Expires after</span><input type="date" value={profile.eventEndsAt} onChange={(event) => update('eventEndsAt', event.target.value)} /></label>
              </div>
            </div>
          </div>
        </section>

        <section className="panel contextual-card-preview">
          <div className="card-mode-switch" role="tablist" aria-label="Card mode">
            <button className={mode === 'event' ? 'active' : ''} onClick={() => setMode('event')}><BriefcaseBusiness size={16} /> Event</button>
            <button className={mode === 'personal' ? 'active' : ''} onClick={() => setMode('personal')}><UserRound size={16} /> Personal</button>
          </div>

          <div className={`share-card share-card-${mode}`}>
            <div className="share-card-header">
              <span className="share-card-icon">{mode === 'event' ? <IdCard size={20} /> : <UserRound size={20} />}</span>
              <span className="status-pill">{mode === 'event' ? 'Professional access' : 'Personal access'}</span>
            </div>
            <span className="eyebrow">{mode === 'event' ? profile.eventName || 'Event card' : 'Personal card'}</span>
            <h3>{profile.displayName || 'Your name'}</h3>
            <p>{[profile.title, profile.company].filter(Boolean).join(' · ') || 'Add your title and company'}</p>

            <div className="qr-stage">
              <QRCodeSVG value={shareUrl} size={218} level="M" marginSize={2} title={`${mode} TagOnce card for ${profile.displayName}`} />
              <span><QrCode size={15} /> Scan with any phone camera</span>
            </div>

            <div className="shared-field-summary">
              <span>{mode === 'event' ? 'LinkedIn + professional contact' : 'Phone + WhatsApp + connected socials'}</span>
              <strong>{activeSocials} social {activeSocials === 1 ? 'identity' : 'identities'}</strong>
            </div>

            <div className="card-social-row">
              {(mode === 'event' ? (['linkedin'] as Platform[]) : personalPlatforms).map((platform) => {
                const identity = payload.socials[platform];
                return <span className={identity ? 'ready' : ''} key={platform}><PlatformMark platform={platform} size="sm" /></span>;
              })}
            </div>
          </div>

          <div className="share-card-actions">
            <button className="button primary" onClick={copyShareLink}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy share link'}</button>
            <button className="button secondary" onClick={() => downloadVCard(payload)}><Download size={17} /> Download vCard</button>
          </div>
          <p className="card-handoff-note">
            The QR contains a compact TagOnce card. A recipient can preview it, save it to TagOnce,
            or download it into their normal phone contacts.
          </p>
        </section>
      </div>
    </div>
  );
}

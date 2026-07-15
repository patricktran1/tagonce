import {
  BriefcaseBusiness,
  Check,
  Copy,
  Download,
  IdCard,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createShareUrl, downloadVCard } from '../lib/cardExchange';
import type {
  CardMode,
  MyProfile,
  Platform,
  ShareCardPayload,
  ShareFieldKey,
  SocialConnection,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface MyCardsPageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  onChange: (profile: MyProfile) => void;
}

const allSocialPlatforms: Platform[] = [
  'linkedin',
  'instagram',
  'facebook',
  'x',
  'threads',
  'tiktok',
  'youtube',
];

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
  ],
  custom: ['email', 'social:linkedin'],
};

const detailOptions: Array<{
  key: 'title' | 'company' | 'email' | 'phone' | 'whatsapp' | 'website';
  label: string;
  description: string;
}> = [
  { key: 'title', label: 'Title', description: 'Role or professional title' },
  { key: 'company', label: 'Company', description: 'Organization or brand' },
  { key: 'email', label: 'Email', description: 'Professional or personal email' },
  { key: 'phone', label: 'Phone', description: 'Direct phone number' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Number or WhatsApp link' },
  { key: 'website', label: 'Website', description: 'Personal or company website' },
];

const modeMeta: Record<CardMode, { label: string; access: string; description: string }> = {
  event: {
    label: 'Event',
    access: 'Professional access',
    description: 'A professional preset you can still customize for today’s room.',
  },
  personal: {
    label: 'Personal',
    access: 'Closer connection',
    description: 'A warmer preset for people you trust with more direct access.',
  },
  custom: {
    label: 'Custom',
    access: 'Your exact mix',
    description: 'Select any combination for a one-off moment or relationship.',
  },
};

function profileFieldValue(profile: MyProfile, key: ShareFieldKey) {
  switch (key) {
    case 'title': return profile.title;
    case 'company': return profile.company;
    case 'email': return profile.email;
    case 'phone': return profile.phone;
    case 'whatsapp': return profile.whatsapp;
    case 'website': return profile.website;
    case 'eventName': return profile.eventName;
    default: return '';
  }
}

function hasValue(profile: MyProfile, key: ShareFieldKey, connectionMap: Map<Platform, SocialConnection>) {
  if (key.startsWith('social:')) {
    const platform = key.slice('social:'.length) as Platform;
    const connection = connectionMap.get(platform);
    return Boolean(connection?.handle?.trim() || connection?.profileUrl?.trim());
  }
  return Boolean(profileFieldValue(profile, key).trim());
}

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

  const selectedFields = useMemo(
    () => profile.cardSelections?.[mode] ?? defaultSelections[mode],
    [mode, profile.cardSelections],
  );

  function setSelectedFields(next: ShareFieldKey[]) {
    onChange({
      ...profile,
      cardSelections: {
        ...profile.cardSelections,
        [mode]: next,
      },
    });
  }

  function toggleField(key: ShareFieldKey) {
    if (!hasValue(profile, key, connectionMap)) return;
    setSelectedFields(
      selectedFields.includes(key)
        ? selectedFields.filter((field) => field !== key)
        : [...selectedFields, key],
    );
  }

  function resetPreset() {
    setSelectedFields(defaultSelections[mode]);
  }

  const payload = useMemo<ShareCardPayload>(() => {
    const includes = (key: ShareFieldKey) => selectedFields.includes(key);
    const socials: ShareCardPayload['socials'] = {};

    allSocialPlatforms.forEach((platform) => {
      if (!includes(`social:${platform}`)) return;
      const connection = connectionMap.get(platform);
      if (connection?.handle || connection?.profileUrl) {
        socials[platform] = {
          handle: connection.handle,
          profileUrl: connection.profileUrl,
        };
      }
    });

    let expiresAt: string | undefined;
    if (includes('eventName') && profile.eventEndsAt) {
      const date = new Date(`${profile.eventEndsAt}T23:59:59`);
      if (!Number.isNaN(date.getTime())) expiresAt = date.toISOString();
    }

    return {
      version: 1,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt,
      eventName: includes('eventName') ? profile.eventName || undefined : undefined,
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
  }, [connectionMap, mode, profile, selectedFields]);

  const shareUrl = useMemo(() => createShareUrl(payload), [payload]);
  const activeSocials = Object.keys(payload.socials).length;
  const activeDetails = Object.values(payload.profile).filter(Boolean).length;
  const cardSubtitle = [payload.profile.title, payload.profile.company].filter(Boolean).join(' · ');

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
            Start with an Event or Personal preset, then highlight exactly which fields belong on
            that card. Use Custom when the moment needs its own rules.
          </p>
        </div>
        <div className="privacy-promise">
          <ShieldCheck size={18} />
          <span><strong>You choose every field.</strong><small>Your name stays visible so the contact remains human and usable.</small></span>
        </div>
      </section>

      <div className="card-studio-grid">
        <section className="panel card-profile-editor">
          <div className="panel-heading">
            <div>
              <span className="step-badge">YOU</span>
              <div><h3>Your contact identity</h3><p>Add the details that can be selected for any card.</p></div>
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
              <label className="field"><span>Phone</span><input value={profile.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Available to any selected card" /></label>
              <label className="field"><span>WhatsApp</span><input value={profile.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} placeholder="Number or wa.me link" /></label>
            </div>
            <div className="event-context-fields">
              <div className="field-heading"><BriefcaseBusiness size={17} /><div><strong>Event context</strong><small>Select it on Event, Personal or Custom cards when relevant.</small></div></div>
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
            <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><SlidersHorizontal size={16} /> Custom</button>
          </div>

          <div className="field-selector-panel">
            <div className="field-selector-heading">
              <div><span className="eyebrow">Fields shared</span><h3>{modeMeta[mode].label} card controls</h3><p>{modeMeta[mode].description}</p></div>
              <button className="text-button reset-fields-button" onClick={resetPreset}><RefreshCw size={14} /> Reset preset</button>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Identity</span>
              <button className="share-field-chip selected locked" disabled><Lock size={13} /><span><strong>Name</strong><small>Always included</small></span><Check size={14} /></button>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Contact details</span>
              <div className="share-field-grid">
                {detailOptions.map((option) => {
                  const available = hasValue(profile, option.key, connectionMap);
                  const selected = selectedFields.includes(option.key);
                  return (
                    <button
                      className={`share-field-chip${selected ? ' selected' : ''}${available ? '' : ' unavailable'}`}
                      key={option.key}
                      disabled={!available}
                      onClick={() => toggleField(option.key)}
                    >
                      <span><strong>{option.label}</strong><small>{available ? option.description : 'Add this detail first'}</small></span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Context</span>
              <button
                className={`share-field-chip${selectedFields.includes('eventName') ? ' selected' : ''}${profile.eventName.trim() ? '' : ' unavailable'}`}
                disabled={!profile.eventName.trim()}
                onClick={() => toggleField('eventName')}
              >
                <BriefcaseBusiness size={14} />
                <span><strong>Event name + expiration</strong><small>{profile.eventName.trim() ? profile.eventName : 'Add an event first'}</small></span>
                {selectedFields.includes('eventName') && <Check size={14} />}
              </button>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Social profiles</span>
              <div className="social-field-grid">
                {allSocialPlatforms.map((platform) => {
                  const key: ShareFieldKey = `social:${platform}`;
                  const available = hasValue(profile, key, connectionMap);
                  const selected = selectedFields.includes(key);
                  return (
                    <button
                      className={`social-field-chip${selected ? ' selected' : ''}${available ? '' : ' unavailable'}`}
                      key={platform}
                      disabled={!available}
                      onClick={() => toggleField(key)}
                    >
                      <PlatformMark platform={platform} size="sm" />
                      <span>{platform}</span>
                      {selected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
              <small className="field-selector-footnote">Unavailable profiles can be added under Social Accounts.</small>
            </div>
          </div>

          <div className={`share-card share-card-${mode}`}>
            <div className="share-card-header">
              <span className="share-card-icon">{mode === 'event' ? <IdCard size={20} /> : mode === 'personal' ? <UserRound size={20} /> : <SlidersHorizontal size={20} />}</span>
              <span className="status-pill">{modeMeta[mode].access}</span>
            </div>
            <span className="eyebrow">{payload.eventName || `${modeMeta[mode].label} card`}</span>
            <h3>{profile.displayName || 'Your name'}</h3>
            <p>{cardSubtitle || 'Only the fields you selected will be shared'}</p>

            <div className="qr-stage">
              <QRCodeSVG value={shareUrl} size={218} level="M" marginSize={2} title={`${mode} TagOnce card for ${profile.displayName}`} />
              <span><QrCode size={15} /> Scan with any phone camera</span>
            </div>

            <div className="shared-field-summary">
              <span>{activeDetails + activeSocials} selected fields</span>
              <strong>{activeSocials} social {activeSocials === 1 ? 'identity' : 'identities'}</strong>
            </div>

            <div className="card-social-row">
              {allSocialPlatforms.map((platform) => (
                <span className={payload.socials[platform] ? 'ready' : ''} key={platform}><PlatformMark platform={platform} size="sm" /></span>
              ))}
            </div>
          </div>

          <div className="share-card-actions">
            <button className="button primary" onClick={copyShareLink}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy share link'}</button>
            <button className="button secondary" onClick={() => downloadVCard(payload)}><Download size={17} /> Download vCard</button>
          </div>
          <p className="card-handoff-note">
            The QR updates instantly as fields are selected or removed. Recipients can preview the exact card before saving it.
          </p>
        </section>
      </div>
    </div>
  );
}

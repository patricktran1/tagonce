import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  IdCard,
  Lock,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createShareUrl, downloadVCard } from '../lib/cardExchange';
import {
  allSocialPlatforms,
  coreSocialPlatforms,
  optionalSocialPlatforms,
  socialPlatformMeta,
  socialProfileUrl,
} from '../data/socials';
import type {
  CardMode,
  MyProfile,
  Platform,
  ShareCardPayload,
  SharedSocialIdentity,
  ShareFieldKey,
  SocialConnection,
  SocialPlatform,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface MyCardsPageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  onChange: (profile: MyProfile) => void;
}

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
    description: 'A professional preset you can customize for today’s room.',
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

function socialDisplay(identity: SharedSocialIdentity) {
  if (identity.handle?.trim()) {
    const handle = identity.handle.trim();
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  if (!identity.profileUrl) return '';
  try {
    const url = new URL(identity.profileUrl);
    return url.pathname.replace(/^\/+|\/+$/g, '') || url.hostname;
  } catch {
    return identity.profileUrl;
  }
}

function isoToLocalInput(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value = '') {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function eventTimeSummary(startValue?: string, endValue?: string) {
  if (!startValue) return '';
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return '';
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = endValue ? new Date(endValue) : null;
  return end && !Number.isNaN(end.getTime())
    ? `${day.format(start)} · ${time.format(start)}–${time.format(end)}`
    : `${day.format(start)} · ${time.format(start)}`;
}

export function MyCardsPage({ profile, connections, onChange }: MyCardsPageProps) {
  const [mode, setMode] = useState<CardMode>('event');
  const [copied, setCopied] = useState(false);
  const [showMoreNetworks, setShowMoreNetworks] = useState(() =>
    optionalSocialPlatforms.some((platform) => Boolean(profile.socialProfiles?.[platform]?.handle || profile.socialProfiles?.[platform]?.profileUrl)),
  );

  function update<K extends keyof MyProfile>(key: K, value: MyProfile[K]) {
    onChange({ ...profile, [key]: value });
  }

  function updateEventTime(key: 'eventStartAt' | 'eventEndAt', value: string) {
    const isoValue = localInputToIso(value);
    const next: MyProfile = { ...profile, [key]: isoValue };
    if (key === 'eventEndAt' && value) next.eventEndsAt = value.slice(0, 10);
    onChange(next);
  }

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.platform, connection])),
    [connections],
  );

  const selectedFields = useMemo(
    () => profile.cardSelections?.[mode] ?? defaultSelections[mode],
    [mode, profile.cardSelections],
  );

  function socialIdentity(platform: SocialPlatform): SharedSocialIdentity {
    const saved = profile.socialProfiles?.[platform];
    if (saved?.handle || saved?.profileUrl) return saved;
    const legacy = connectionMap.get(platform as Platform);
    return {
      handle: legacy?.handle,
      profileUrl: legacy?.profileUrl,
    };
  }

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
    const available = key.startsWith('social:')
      ? Boolean(socialIdentity(key.slice('social:'.length) as SocialPlatform).handle || socialIdentity(key.slice('social:'.length) as SocialPlatform).profileUrl)
      : Boolean(profileFieldValue(profile, key).trim());
    if (!available) return;
    setSelectedFields(
      selectedFields.includes(key)
        ? selectedFields.filter((field) => field !== key)
        : [...selectedFields, key],
    );
  }

  function updateSocial(
    platform: SocialPlatform,
    key: keyof SharedSocialIdentity,
    value: string,
  ) {
    const existing = socialIdentity(platform);
    const socialKey: ShareFieldKey = `social:${platform}`;
    const wasEmpty = !existing.handle?.trim() && !existing.profileUrl?.trim();
    const becomesAvailable = wasEmpty && Boolean(value.trim());
    const nextSelections = becomesAvailable && !selectedFields.includes(socialKey)
      ? [...selectedFields, socialKey]
      : selectedFields;

    onChange({
      ...profile,
      socialProfiles: {
        ...profile.socialProfiles,
        [platform]: {
          ...existing,
          [key]: value,
        },
      },
      cardSelections: {
        ...profile.cardSelections,
        [mode]: nextSelections,
      },
    });
  }

  function resetPreset() {
    setSelectedFields(defaultSelections[mode]);
  }

  const payload = useMemo<ShareCardPayload>(() => {
    const includes = (key: ShareFieldKey) => selectedFields.includes(key);
    const socials: ShareCardPayload['socials'] = {};

    allSocialPlatforms.forEach((platform) => {
      if (!includes(`social:${platform}`)) return;
      const identity = socialIdentity(platform);
      const url = socialProfileUrl(platform, identity);
      if (identity.handle || url) {
        socials[platform] = {
          handle: identity.handle?.trim() || undefined,
          profileUrl: url || undefined,
        };
      }
    });

    let expiresAt: string | undefined;
    if (includes('eventName') && profile.eventEndsAt) {
      const date = new Date(`${profile.eventEndsAt}T23:59:59`);
      if (!Number.isNaN(date.getTime())) expiresAt = date.toISOString();
    }

    const sharesEvent = includes('eventName');
    return {
      version: 1,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt,
      eventName: sharesEvent ? profile.eventName || undefined : undefined,
      eventStartAt: sharesEvent ? profile.eventStartAt || undefined : undefined,
      eventEndAt: sharesEvent ? profile.eventEndAt || undefined : undefined,
      eventLocation: sharesEvent ? profile.eventLocation || undefined : undefined,
      eventUrl: sharesEvent ? profile.eventUrl || undefined : undefined,
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
  const activeSocialEntries = Object.entries(payload.socials) as Array<[
    SocialPlatform,
    SharedSocialIdentity,
  ]>;
  const activeSocials = activeSocialEntries.length;
  const activeDetails = Object.values(payload.profile).filter(Boolean).length;
  const cardSubtitle = [payload.profile.title, payload.profile.company].filter(Boolean).join(' · ');
  const eventTime = eventTimeSummary(payload.eventStartAt, payload.eventEndAt);

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function socialEditor(platform: SocialPlatform) {
    const identity = socialIdentity(platform);
    const meta = socialPlatformMeta[platform];
    const shareKey: ShareFieldKey = `social:${platform}`;
    const available = Boolean(identity.handle?.trim() || identity.profileUrl?.trim());
    const selected = selectedFields.includes(shareKey);

    return (
      <article className={`social-profile-editor${selected ? ' selected' : ''}`} key={platform}>
        <div className="social-profile-editor-heading">
          <PlatformMark platform={platform} />
          <span><strong>{meta.label}</strong><small>{meta.description}</small></span>
          <button
            className={`card-share-toggle${selected ? ' selected' : ''}`}
            disabled={!available}
            onClick={() => toggleField(shareKey)}
            aria-pressed={selected}
          >
            {selected ? <Check size={13} /> : null}
            {selected ? 'Shared' : available ? 'Share' : 'Add first'}
          </button>
        </div>
        <div className="social-profile-inputs">
          <label className="field compact-field">
            <span>Handle</span>
            <input
              value={identity.handle ?? ''}
              onChange={(event) => updateSocial(platform, 'handle', event.target.value)}
              placeholder={platform === 'linkedin' ? 'Vanity name' : '@username'}
            />
          </label>
          <label className="field compact-field">
            <span>Profile link</span>
            <input
              value={identity.profileUrl ?? ''}
              onChange={(event) => updateSocial(platform, 'profileUrl', event.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
      </article>
    );
  }

  return (
    <div className="page-stack card-studio-page">
      <section className="card-studio-hero">
        <div>
          <span className="hero-kicker">Contextual identity exchange</span>
          <h2>One card studio. Every way to connect.</h2>
          <p>
            Edit your contact details and social links together, choose exactly what each card reveals,
            then share one QR with clickable profiles and a complete downloadable vCard.
          </p>
        </div>
        <div className="privacy-promise">
          <ShieldCheck size={18} />
          <span><strong>You choose every field.</strong><small>Social links are shared only on the card modes you highlight.</small></span>
        </div>
      </section>

      <div className="card-studio-grid unified-card-studio-grid">
        <section className="panel card-profile-editor">
          <div className="panel-heading">
            <div>
              <span className="step-badge">YOU</span>
              <div><h3>Your complete contact identity</h3><p>Everything editable now lives in this card studio.</p></div>
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
              <div className="field-heading"><BriefcaseBusiness size={17} /><div><strong>Event context</strong><small>Imported details remain editable and travel with the QR when event context is selected.</small></div></div>
              <div className="two-field-row">
                <label className="field"><span>Event name</span><input value={profile.eventName} onChange={(event) => update('eventName', event.target.value)} placeholder="AGI Summit 2026" /></label>
                <label className="field"><span>Expires after</span><input type="date" value={profile.eventEndsAt} onChange={(event) => update('eventEndsAt', event.target.value)} /></label>
              </div>
              <div className="two-field-row">
                <label className="field"><span>Starts</span><input type="datetime-local" value={isoToLocalInput(profile.eventStartAt)} onChange={(event) => updateEventTime('eventStartAt', event.target.value)} /></label>
                <label className="field"><span>Ends</span><input type="datetime-local" value={isoToLocalInput(profile.eventEndAt)} onChange={(event) => updateEventTime('eventEndAt', event.target.value)} /></label>
              </div>
              <label className="field"><span>Venue or location</span><input value={profile.eventLocation || ''} onChange={(event) => update('eventLocation', event.target.value)} placeholder="Exploratorium, San Francisco" /></label>
              <label className="field"><span>Event page</span><input value={profile.eventUrl || ''} onChange={(event) => update('eventUrl', event.target.value)} placeholder="https://lu.ma/..." /></label>
            </div>
          </div>

          <div className="inline-social-editor">
            <div className="inline-social-editor-heading">
              <div><span className="eyebrow">Social profiles</span><h3>Add, edit and choose what this card shares</h3><p>Handles are enough for most networks; a pasted profile URL is safest for LinkedIn and Facebook.</p></div>
            </div>
            <div className="social-profile-editor-list">
              {coreSocialPlatforms.map(socialEditor)}
            </div>
            <button className={`more-networks-button${showMoreNetworks ? ' open' : ''}`} onClick={() => setShowMoreNetworks((current) => !current)}>
              <span><strong>{showMoreNetworks ? 'Hide optional networks' : 'Show more networks'}</strong><small>Threads, TikTok, YouTube, Snapchat, Pinterest and GitHub</small></span>
              <ChevronDown size={17} />
            </button>
            {showMoreNetworks && <div className="social-profile-editor-list optional-social-list">{optionalSocialPlatforms.map(socialEditor)}</div>}
          </div>
        </section>

        <section className="panel contextual-card-preview">
          <div className="card-mode-switch" role="tablist" aria-label="Card mode">
            <button className={mode === 'event' ? 'active' : ''} onClick={() => setMode('event')}><BriefcaseBusiness size={16} /> Event</button>
            <button className={mode === 'personal' ? 'active' : ''} onClick={() => setMode('personal')}><UserRound size={16} /> Personal</button>
            <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><SlidersHorizontal size={16} /> Custom</button>
          </div>

          <div className="field-selector-panel compact-selector-panel">
            <div className="field-selector-heading">
              <div><span className="eyebrow">Fields shared</span><h3>{modeMeta[mode].label} card controls</h3><p>{modeMeta[mode].description}</p></div>
              <button className="text-button reset-fields-button" onClick={resetPreset}><RefreshCw size={14} /> Reset preset</button>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Identity and contact details</span>
              <div className="share-field-grid">
                <button className="share-field-chip selected locked" disabled><Lock size={13} /><span><strong>Name</strong><small>Always included</small></span><Check size={14} /></button>
                {detailOptions.map((option) => {
                  const available = Boolean(profileFieldValue(profile, option.key).trim());
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
                <span><strong>Event name, time, venue + expiration</strong><small>{profile.eventName.trim() ? profile.eventName : 'Add an event first'}</small></span>
                {selectedFields.includes('eventName') && <Check size={14} />}
              </button>
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

            {payload.eventName && (eventTime || payload.eventLocation || payload.eventUrl) && (
              <div className="share-card-event-context">
                {eventTime && <span><CalendarDays size={14} /> {eventTime}</span>}
                {payload.eventLocation && <span><MapPin size={14} /> {payload.eventLocation}</span>}
                {payload.eventUrl && <a href={payload.eventUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Event page</a>}
              </div>
            )}

            <div className="qr-stage">
              <QRCodeSVG value={shareUrl} size={228} level="L" marginSize={2} title={`${mode} TagOnce card for ${profile.displayName}`} />
              <span><QrCode size={15} /> Scan with any phone camera</span>
            </div>

            <div className="share-card-social-links">
              {activeSocialEntries.map(([platform, identity]) => {
                const url = socialProfileUrl(platform, identity);
                return (
                  <a href={url} target="_blank" rel="noreferrer" key={platform}>
                    <PlatformMark platform={platform} size="sm" />
                    <span><strong>{socialDisplay(identity) || socialPlatformMeta[platform].label}</strong><small>{socialPlatformMeta[platform].action}</small></span>
                    <ExternalLink size={14} />
                  </a>
                );
              })}
              {activeSocialEntries.length === 0 && <span className="no-shared-socials">Select a social profile to place a clickable link on this card.</span>}
            </div>

            <div className="shared-field-summary">
              <span>{activeDetails + activeSocials} selected fields</span>
              <strong>{activeSocials} clickable social {activeSocials === 1 ? 'link' : 'links'}</strong>
            </div>
          </div>

          <div className="share-card-actions">
            <button className="button primary" onClick={copyShareLink}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy share link'}</button>
            <button className="button secondary" onClick={() => downloadVCard(payload)}><Download size={17} /> Download vCard</button>
          </div>
          <p className="card-handoff-note">
            The vCard saves contact details. The QR also carries the selected event context and clickable social profiles.
          </p>
        </section>
      </div>
    </div>
  );
}

import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { QrPortabilityPanel } from './QrPortabilityPanel';

interface MyCardsPageProps {
  profile: MyProfile;
  connections: SocialConnection[];
  onChange: (profile: MyProfile) => void;
}

type EventPresetKey = 'hackathon' | 'conference' | 'social' | 'dating' | 'custom';
type DetailFieldKey = 'title' | 'company' | 'email' | 'phone' | 'whatsapp' | 'website';

const eventPresetSelections: Record<Exclude<EventPresetKey, 'custom'>, ShareFieldKey[]> = {
  hackathon: ['title', 'company', 'email', 'website', 'eventName', 'social:linkedin', 'social:github'],
  conference: ['title', 'company', 'email', 'website', 'eventName', 'social:linkedin', 'social:github', 'social:x'],
  social: ['email', 'phone', 'whatsapp', 'eventName', 'social:instagram', 'social:linkedin'],
  dating: ['phone', 'whatsapp', 'eventName', 'social:instagram', 'social:linkedin'],
};

const eventPresetOptions: Array<{
  key: EventPresetKey;
  label: string;
  description: string;
}> = [
  { key: 'hackathon', label: 'Hackathon', description: 'LinkedIn + GitHub with your work identity and event context.' },
  { key: 'conference', label: 'Conference', description: 'LinkedIn, GitHub and X with professional contact details.' },
  { key: 'social', label: 'Social', description: 'Instagram and LinkedIn with easier direct follow-up options.' },
  { key: 'dating', label: 'Dating', description: 'A consent-controlled mix of Instagram, WhatsApp or phone, and LinkedIn.' },
  { key: 'custom', label: 'Custom', description: 'Keep the current mix and choose every field yourself below.' },
];

const legacyEventSelection: ShareFieldKey[] = [
  'title',
  'company',
  'email',
  'website',
  'eventName',
  'social:linkedin',
];

const defaultSelections: Record<CardMode, ShareFieldKey[]> = {
  event: eventPresetSelections.hackathon,
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
  key: DetailFieldKey;
  label: string;
  description: string;
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'url';
}> = [
  { key: 'title', label: 'Title', description: 'Role or professional title', placeholder: 'Founder' },
  { key: 'company', label: 'Company', description: 'Organization or brand', placeholder: 'AION EHR' },
  { key: 'email', label: 'Email', description: 'Professional or personal email', placeholder: 'you@company.com', type: 'email' },
  { key: 'website', label: 'Website', description: 'Personal or company website', placeholder: 'https://...', type: 'url' },
  { key: 'phone', label: 'Phone', description: 'Direct phone number', placeholder: 'Phone number', type: 'tel' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Number or WhatsApp link', placeholder: 'Number or wa.me link', type: 'tel' },
];

const modeMeta: Record<CardMode, { label: string; access: string; description: string }> = {
  event: {
    label: 'Event',
    access: 'Contextual access',
    description: 'Start with a room-specific preset, then customize any field.',
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

function sameSelection(left: ShareFieldKey[], right: ShareFieldKey[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((field) => rightSet.has(field));
}

function detectEventPreset(fields: ShareFieldKey[]): EventPresetKey {
  const match = (Object.entries(eventPresetSelections) as Array<[
    Exclude<EventPresetKey, 'custom'>,
    ShareFieldKey[],
  ]>).find(([, selection]) => sameSelection(fields, selection));
  return match?.[0] || 'custom';
}

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

function safeHttpUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function MyCardsPage({ profile, connections, onChange }: MyCardsPageProps) {
  const [mode, setMode] = useState<CardMode>('event');
  const [showMoreNetworks, setShowMoreNetworks] = useState(() =>
    optionalSocialPlatforms.some((platform) => Boolean(profile.socialProfiles?.[platform]?.handle || profile.socialProfiles?.[platform]?.profileUrl)),
  );
  const [forceCustomEventPreset, setForceCustomEventPreset] = useState(false);
  const [qrInView, setQrInView] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const qrPreviewRef = useRef<HTMLElement>(null);

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

  const selectedFields = useMemo(() => {
    const saved = profile.cardSelections?.[mode];
    if (mode === 'event' && saved && sameSelection(saved, legacyEventSelection)) {
      return eventPresetSelections.hackathon;
    }
    return saved ?? defaultSelections[mode];
  }, [mode, profile.cardSelections]);

  const activeEventPreset = forceCustomEventPreset
    ? 'custom'
    : detectEventPreset(selectedFields);

  function socialIdentity(platform: SocialPlatform): SharedSocialIdentity {
    const saved = profile.socialProfiles?.[platform];
    if (saved?.handle || saved?.profileUrl) return saved;
    const legacy = connectionMap.get(platform as Platform);
    return { handle: legacy?.handle, profileUrl: legacy?.profileUrl };
  }

  function setSelectedFields(next: ShareFieldKey[]) {
    onChange({
      ...profile,
      cardSelections: { ...profile.cardSelections, [mode]: next },
    });
  }

  function applyEventPreset(preset: EventPresetKey) {
    if (preset === 'custom') {
      setForceCustomEventPreset(true);
      return;
    }
    setForceCustomEventPreset(false);
    setSelectedFields([...eventPresetSelections[preset]]);
  }

  function toggleField(key: ShareFieldKey) {
    const available = key.startsWith('social:')
      ? Boolean(socialIdentity(key.slice('social:'.length) as SocialPlatform).handle || socialIdentity(key.slice('social:'.length) as SocialPlatform).profileUrl)
      : Boolean(profileFieldValue(profile, key).trim());
    if (!available) return;
    if (mode === 'event') setForceCustomEventPreset(true);
    setSelectedFields(
      selectedFields.includes(key)
        ? selectedFields.filter((field) => field !== key)
        : [...selectedFields, key],
    );
  }

  function updateSocial(platform: SocialPlatform, key: keyof SharedSocialIdentity, value: string) {
    const existing = socialIdentity(platform);
    const socialKey: ShareFieldKey = `social:${platform}`;
    const wasEmpty = !existing.handle?.trim() && !existing.profileUrl?.trim();
    const nextSelections = wasEmpty && value.trim() && !selectedFields.includes(socialKey)
      ? [...selectedFields, socialKey]
      : selectedFields;
    if (mode === 'event' && nextSelections !== selectedFields) setForceCustomEventPreset(true);

    onChange({
      ...profile,
      socialProfiles: {
        ...profile.socialProfiles,
        [platform]: { ...existing, [key]: value },
      },
      cardSelections: { ...profile.cardSelections, [mode]: nextSelections },
    });
  }

  function resetPreset() {
    if (mode === 'event') setForceCustomEventPreset(false);
    setSelectedFields(defaultSelections[mode]);
  }

  useEffect(() => {
    const node = qrPreviewRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setQrInView(entry.isIntersecting),
      { threshold: 0.16 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

    const sharesEvent = includes('eventName');
    let expiresAt: string | undefined;
    if (sharesEvent && profile.eventEndAt) {
      const exactEnd = new Date(profile.eventEndAt);
      if (!Number.isNaN(exactEnd.getTime())) expiresAt = exactEnd.toISOString();
    }
    if (!expiresAt && sharesEvent && profile.eventEndsAt) {
      const dayEnd = new Date(`${profile.eventEndsAt}T23:59:59`);
      if (!Number.isNaN(dayEnd.getTime())) expiresAt = dayEnd.toISOString();
    }

    return {
      version: 1,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt,
      eventName: sharesEvent ? profile.eventName || undefined : undefined,
      eventStartAt: sharesEvent ? profile.eventStartAt || undefined : undefined,
      eventEndAt: sharesEvent ? profile.eventEndAt || undefined : undefined,
      eventLocation: sharesEvent ? profile.eventLocation || undefined : undefined,
      eventUrl: sharesEvent ? safeHttpUrl(profile.eventUrl) || undefined : undefined,
      profile: {
        displayName: profile.displayName || 'Your name',
        avatarUrl: profile.avatarUrl,
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
  const activeSocialEntries = Object.entries(payload.socials) as Array<[SocialPlatform, SharedSocialIdentity]>;
  const activeSocials = activeSocialEntries.length;
  const activeDetails = Object.values(payload.profile).filter(Boolean).length;
  const totalSelected = activeDetails + activeSocials;
  const cardSubtitle = [payload.profile.title, payload.profile.company].filter(Boolean).join(' · ');
  const eventTime = eventTimeSummary(payload.eventStartAt, payload.eventEndAt);
  const exportMeta = {
    displayName: payload.profile.displayName,
    subtitle: cardSubtitle,
    modeLabel: `${modeMeta[mode].label} card`,
    eventName: payload.eventName,
    eventTime,
    eventLocation: payload.eventLocation,
  };

  function scrollTo(section: 'editor' | 'qr') {
    const node = section === 'editor' ? editorRef.current : qrPreviewRef.current;
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function modeSwitch(className: string) {
    return (
      <div className={`card-mode-switch ${className}`} role="tablist" aria-label="Card mode">
        <button className={mode === 'event' ? 'active' : ''} type="button" onClick={() => setMode('event')}><BriefcaseBusiness size={16} /> Event</button>
        <button className={mode === 'personal' ? 'active' : ''} type="button" onClick={() => setMode('personal')}><UserRound size={16} /> Personal</button>
        <button className={mode === 'custom' ? 'active' : ''} type="button" onClick={() => setMode('custom')}><SlidersHorizontal size={16} /> Custom</button>
      </div>
    );
  }

  function presetSelector() {
    if (mode !== 'event') return null;
    return (
      <div className="event-card-presets" aria-label="Event card presets">
        <div className="event-card-presets-heading">
          <span><strong>Choose the room</strong><small>Start with a recommended sharing mix</small></span>
          <span className="event-preset-current">{eventPresetOptions.find((preset) => preset.key === activeEventPreset)?.label}</span>
        </div>
        <div className="event-card-preset-grid">
          {eventPresetOptions.map((preset) => (
            <button
              className={activeEventPreset === preset.key ? 'active' : ''}
              type="button"
              key={preset.key}
              onClick={() => applyEventPreset(preset.key)}
              aria-pressed={activeEventPreset === preset.key}
            >
              <strong>{preset.label}</strong>
            </button>
          ))}
        </div>
        <p>{eventPresetOptions.find((preset) => preset.key === activeEventPreset)?.description}</p>
      </div>
    );
  }

  function detailEditor(option: (typeof detailOptions)[number]) {
    const selected = selectedFields.includes(option.key);
    const available = Boolean(profile[option.key].trim());
    return (
      <div className={`inline-share-field${selected ? ' selected' : ''}${available ? '' : ' unavailable'}`} key={option.key}>
        <label className="field">
          <span>{option.label}</span>
          <input
            type={option.type || 'text'}
            value={profile[option.key]}
            onChange={(event) => update(option.key, event.target.value)}
            placeholder={option.placeholder}
          />
          <small>{option.description}</small>
        </label>
        <button
          className={`card-share-toggle inline-field-share-toggle${selected ? ' selected' : ''}`}
          type="button"
          disabled={!available}
          onClick={() => toggleField(option.key)}
          aria-pressed={selected}
        >
          {selected ? <Check size={13} /> : null}
          {selected ? 'Shared' : available ? 'Share' : 'Add first'}
        </button>
      </div>
    );
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
            type="button"
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
              placeholder={platform === 'linkedin' ? 'Vanity name' : platform === 'github' ? 'username' : '@username'}
            />
          </label>
          <label className="field compact-field">
            <span>Profile link</span>
            <input value={identity.profileUrl ?? ''} onChange={(event) => updateSocial(platform, 'profileUrl', event.target.value)} placeholder="https://…" />
          </label>
        </div>
      </article>
    );
  }

  const eventContextSelected = selectedFields.includes('eventName');
  const eventContextAvailable = Boolean(profile.eventName.trim());

  return (
    <div className="page-stack card-studio-page pocket-qr-page">
      <section className="card-studio-hero pocket-qr-hero">
        <div>
          <span className="hero-kicker">Pocket QR</span>
          <h2>Build the card, then show the QR.</h2>
          <p>Fill in your details, tap what you want to share, and jump to the live QR whenever you are ready.</p>
        </div>
        <div className="privacy-promise">
          <ShieldCheck size={18} />
          <span><strong>You choose every field.</strong><small>Every export matches the active Event, Personal or Custom card.</small></span>
        </div>
      </section>

      <div className="card-studio-grid unified-card-studio-grid pocket-qr-grid">
        <section ref={editorRef} className="panel card-profile-editor pocket-qr-editor">
          <div className="pocket-qr-editor-content mobile-open">
            <div className="panel-heading pocket-editor-heading">
              <div><span className="step-badge">1</span><div><h3>Fill in your details</h3><p>Use the Share buttons beside each field to control the QR.</p></div></div>
            </div>

            <div className="mobile-card-setup">
              <div className="mobile-card-setup-heading"><span className="step-badge">CARD</span><div><strong>Choose your card type</strong><small>{modeMeta[mode].description}</small></div></div>
              {modeSwitch('mobile-card-mode-switch')}
              {presetSelector()}
            </div>

            <div className="settings-fields card-profile-fields">
              <div className="inline-share-field selected locked name-inline-field">
                <label className="field">
                  <span>Name</span>
                  <input value={profile.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="Patrick Tran" />
                  <small>Your name is always included on the card.</small>
                </label>
                <span className="always-shared-badge"><Lock size={12} /> Always shared</span>
              </div>

              <div className="inline-detail-grid">
                {detailOptions.map(detailEditor)}
              </div>

              <div className={`event-context-fields inline-event-context${eventContextSelected ? ' selected' : ''}`}>
                <div className="field-heading event-context-heading">
                  <BriefcaseBusiness size={17} />
                  <div><strong>Event context</strong><small>Name, time, venue, event page and expiration travel together.</small></div>
                  <button
                    className={`card-share-toggle event-context-share-toggle${eventContextSelected ? ' selected' : ''}`}
                    type="button"
                    disabled={!eventContextAvailable}
                    onClick={() => toggleField('eventName')}
                    aria-pressed={eventContextSelected}
                  >
                    {eventContextSelected ? <Check size={13} /> : null}
                    {eventContextSelected ? 'Shared' : eventContextAvailable ? 'Share context' : 'Add event first'}
                  </button>
                </div>
                <div className="two-field-row">
                  <label className="field"><span>Event name</span><input value={profile.eventName} onChange={(event) => update('eventName', event.target.value)} placeholder="AGI Summit 2026" /></label>
                  <label className="field"><span>Expires after</span><input type="date" value={profile.eventEndsAt} onChange={(event) => update('eventEndsAt', event.target.value)} /></label>
                </div>
                <div className="two-field-row">
                  <label className="field"><span>Starts</span><input type="datetime-local" value={isoToLocalInput(profile.eventStartAt)} onChange={(event) => updateEventTime('eventStartAt', event.target.value)} /></label>
                  <label className="field"><span>Ends</span><input type="datetime-local" value={isoToLocalInput(profile.eventEndAt)} onChange={(event) => updateEventTime('eventEndAt', event.target.value)} /></label>
                </div>
                <label className="field"><span>Venue or location</span><input value={profile.eventLocation || ''} onChange={(event) => update('eventLocation', event.target.value)} placeholder="Exploratorium, San Francisco" /></label>
                <label className="field"><span>Event page</span><input value={profile.eventUrl || ''} onChange={(event) => update('eventUrl', event.target.value)} placeholder="https://event-page.example" /></label>
              </div>
            </div>

            <div className="inline-social-editor">
              <div className="inline-social-editor-heading"><div><span className="eyebrow">Social profiles</span><h3>Add, edit and choose what this card shares</h3><p>Each completed network has its own Share toggle.</p></div></div>
              <div className="social-profile-editor-list">{coreSocialPlatforms.map(socialEditor)}</div>
              <button className={`more-networks-button${showMoreNetworks ? ' open' : ''}`} type="button" onClick={() => setShowMoreNetworks((current) => !current)}>
                <span><strong>{showMoreNetworks ? 'Hide optional networks' : 'Show more networks'}</strong><small>Threads, TikTok, YouTube, Snapchat and Pinterest</small></span>
                <ChevronDown size={17} />
              </button>
              {showMoreNetworks && <div className="social-profile-editor-list optional-social-list">{optionalSocialPlatforms.map(socialEditor)}</div>}
            </div>
          </div>
        </section>

        <section ref={qrPreviewRef} id="tagonce-qr-preview" className="panel contextual-card-preview pocket-qr-preview">
          <div className="desktop-card-setup">
            {modeSwitch('pocket-mode-switch')}
            {presetSelector()}
          </div>

          <div className="qr-preview-heading">
            <span className="step-badge">2</span>
            <div><strong>Your live QR</strong><small>{totalSelected} selected {totalSelected === 1 ? 'field' : 'fields'} update instantly as you edit.</small></div>
          </div>

          <div className={`share-card share-card-${mode} pocket-share-card`}>
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

            <div className="qr-stage pocket-qr-stage">
              <QRCodeSVG value={shareUrl} size={252} level="L" marginSize={3} title={`${mode} TagOnce card for ${profile.displayName}`} />
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

            <div className="shared-field-summary"><span>{totalSelected} selected fields</span><strong>{activeSocials} clickable social {activeSocials === 1 ? 'link' : 'links'}</strong></div>
          </div>

          <QrPortabilityPanel shareUrl={shareUrl} meta={exportMeta} />

          <button className="button secondary full-button pocket-vcard-button" type="button" onClick={() => downloadVCard(payload)}><Download size={17} /> Download contact vCard</button>

          <div className="field-selector-panel compact-selector-panel pocket-field-selector">
            <div className="field-selector-heading">
              <div><span className="eyebrow">Fields shared</span><h3>{modeMeta[mode].label} card controls</h3><p>{modeMeta[mode].description}</p></div>
              <button className="text-button reset-fields-button" type="button" onClick={resetPreset}><RefreshCw size={14} /> Reset preset</button>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Identity and contact details</span>
              <div className="share-field-grid">
                <button className="share-field-chip selected locked" type="button" disabled><Lock size={13} /><span><strong>Name</strong><small>Always included</small></span><Check size={14} /></button>
                {detailOptions.map((option) => {
                  const available = Boolean(profileFieldValue(profile, option.key).trim());
                  const selected = selectedFields.includes(option.key);
                  return (
                    <button className={`share-field-chip${selected ? ' selected' : ''}${available ? '' : ' unavailable'}`} type="button" key={option.key} disabled={!available} onClick={() => toggleField(option.key)}>
                      <span><strong>{option.label}</strong><small>{available ? option.description : 'Add this detail first'}</small></span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="share-field-group">
              <span className="share-field-group-label">Context</span>
              <button className={`share-field-chip${eventContextSelected ? ' selected' : ''}${eventContextAvailable ? '' : ' unavailable'}`} type="button" disabled={!eventContextAvailable} onClick={() => toggleField('eventName')}>
                <BriefcaseBusiness size={14} />
                <span><strong>Event name, time, venue + expiration</strong><small>{profile.eventName.trim() ? profile.eventName : 'Add an event first'}</small></span>
                {eventContextSelected && <Check size={14} />}
              </button>
            </div>
          </div>

          <p className="card-handoff-note">The vCard saves contact details. The QR image and live link also carry selected event context and clickable social profiles.</p>
        </section>
      </div>

      <button className={`mobile-qr-jump${qrInView ? ' showing-qr' : ''}`} type="button" onClick={() => scrollTo(qrInView ? 'editor' : 'qr')}>
        {qrInView ? <SlidersHorizontal size={18} /> : <QrCode size={18} />}
        <span><strong>{qrInView ? 'Edit card' : 'View QR'}</strong><small>{totalSelected} selected</small></span>
      </button>
    </div>
  );
}

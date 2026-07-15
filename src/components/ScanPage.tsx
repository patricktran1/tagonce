import {
  Camera,
  Check,
  ContactRound,
  Download,
  ExternalLink,
  ImagePlus,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  compressImage,
  decodeCardPayload,
  downloadVCard,
  extractCardToken,
} from '../lib/cardExchange';
import {
  isPublishingPlatform,
  socialPlatformMeta,
  socialProfileUrl,
} from '../data/socials';
import type {
  MentionEntity,
  PlatformMapping,
  ShareCardPayload,
  SharedSocialIdentity,
  SocialPlatform,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface ScanPageProps {
  onSaveContact: (entity: MentionEntity) => void;
  onOpenAddressBook: () => void;
}

interface InitialScanState {
  input: string;
  payload: ShareCardPayload | null;
  error: string;
}

function getInitialScanState(): InitialScanState {
  const token = new URLSearchParams(window.location.search).get('card') ?? '';
  if (!token) return { input: '', payload: null, error: '' };
  try {
    return { input: token, payload: decodeCardPayload(token), error: '' };
  } catch (error) {
    return {
      input: token,
      payload: null,
      error: error instanceof Error ? error.message : 'The TagOnce card could not be opened.',
    };
  }
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TO';
}

function cardContext(payload: ShareCardPayload) {
  if (payload.mode === 'event') return payload.eventName || 'Event connection';
  if (payload.mode === 'custom') return payload.eventName || 'Custom connection';
  return 'Personal connection';
}

export function ScanPage({ onSaveContact, onOpenAddressBook }: ScanPageProps) {
  const [initial] = useState(getInitialScanState);
  const [input, setInput] = useState(initial.input);
  const [payload, setPayload] = useState<ShareCardPayload | null>(initial.payload);
  const [error, setError] = useState(initial.error);
  const [metAt, setMetAt] = useState(initial.payload?.eventName ?? '');
  const [notes, setNotes] = useState('');
  const [memoryPhoto, setMemoryPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saved, setSaved] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const socialEntries = useMemo(
    () => payload
      ? (Object.entries(payload.socials) as Array<[SocialPlatform, SharedSocialIdentity]>)
      : [],
    [payload],
  );

  const expired = Boolean(payload?.expiresAt && new Date(payload.expiresAt).getTime() < Date.now());

  function openCard() {
    const token = extractCardToken(input);
    if (!token) {
      setError('Paste a TagOnce share link or card code first.');
      setPayload(null);
      return;
    }
    try {
      const decoded = decodeCardPayload(token);
      setPayload(decoded);
      setMetAt(decoded.eventName ?? '');
      setError('');
      setSaved(false);
    } catch (openError) {
      setPayload(null);
      setError(openError instanceof Error ? openError.message : 'The TagOnce card could not be opened.');
    }
  }

  async function captureMemory(file: File | undefined, input?: HTMLInputElement | null) {
    if (!file) return;
    try {
      setMemoryPhoto(await compressImage(file));
      setPhotoError('');
    } catch (captureError) {
      setPhotoError(captureError instanceof Error ? captureError.message : 'The photo could not be saved.');
    } finally {
      if (input) input.value = '';
    }
  }

  function saveContact() {
    if (!payload || expired) return;
    const mappings: MentionEntity['mappings'] = {};
    socialEntries.forEach(([platform, identity]) => {
      if (!isPublishingPlatform(platform)) return;
      const mapping: PlatformMapping = {
        platform,
        displayName: payload.profile.displayName,
        handle: identity.handle,
        profileUrl: identity.profileUrl,
        nativeTagSupported: true,
        verified: false,
      };
      mappings[platform] = mapping;
    });

    onSaveContact({
      id: `contact_${crypto.randomUUID?.() ?? Date.now()}`,
      displayName: payload.profile.displayName,
      type: 'person',
      description: [payload.profile.title, payload.profile.company].filter(Boolean).join(' · '),
      title: payload.profile.title,
      company: payload.profile.company,
      email: payload.profile.email,
      phone: payload.profile.phone,
      whatsapp: payload.profile.whatsapp,
      website: payload.profile.website,
      metAt: metAt || payload.eventName,
      metOn: new Date().toISOString(),
      notes,
      memoryPhotoDataUrl: memoryPhoto || undefined,
      sourceCardMode: payload.mode,
      socialProfiles: payload.socials,
      initials: initialsFor(payload.profile.displayName),
      mappings,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });

    setSaved(true);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('card');
    window.history.replaceState({}, '', cleanUrl);
  }

  function clearCard() {
    setPayload(null);
    setInput('');
    setError('');
    setSaved(false);
    setMemoryPhoto('');
    setNotes('');
    setMetAt('');
  }

  return (
    <div className="page-stack scan-page">
      {!payload && (
        <section className="scan-empty-state">
          <span className="scan-orbit"><ScanLine size={34} /></span>
          <span className="hero-kicker">Receive a TagOnce card</span>
          <h2>Scan with your phone camera. Save the human context.</h2>
          <p>
            A TagOnce QR opens this page automatically. You can also paste a share link below when
            someone sends their card through text, WhatsApp or email.
          </p>
          <div className="scan-link-entry">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste TagOnce link or card code" />
            <button className="button primary" onClick={openCard}><Upload size={17} /> Open card</button>
          </div>
          {error && <div className="inline-error">{error}</div>}
          <div className="scan-trust-row">
            <span><ShieldCheck size={16} /> Preview before saving</span>
            <span><ContactRound size={16} /> Works with phone contacts</span>
            <span><Camera size={16} /> Optional private memory photo</span>
          </div>
        </section>
      )}

      {payload && (
        <div className="received-card-layout">
          <section className="panel received-card-preview">
            <div className="received-card-topline">
              <span className="received-avatar">{initialsFor(payload.profile.displayName)}</span>
              <button className="icon-button" onClick={clearCard} aria-label="Close card"><X size={18} /></button>
            </div>
            <span className="eyebrow">{cardContext(payload)}</span>
            <h2>{payload.profile.displayName}</h2>
            <p>{[payload.profile.title, payload.profile.company].filter(Boolean).join(' · ')}</p>

            {expired && <div className="expired-card-note">This temporary event card has expired. Ask the person to show a fresh QR.</div>}

            <div className="received-contact-details">
              {payload.profile.email && <span><strong>Email</strong>{payload.profile.email}</span>}
              {payload.profile.phone && <span><strong>Phone</strong>{payload.profile.phone}</span>}
              {payload.profile.whatsapp && <span><strong>WhatsApp</strong>{payload.profile.whatsapp}</span>}
              {payload.profile.website && <span><strong>Website</strong>{payload.profile.website}</span>}
            </div>

            <div className="received-socials">
              {socialEntries.map(([platform, identity]) => {
                const meta = socialPlatformMeta[platform];
                const url = socialProfileUrl(platform, identity);
                return (
                  <a href={url} target="_blank" rel="noreferrer" key={platform}>
                    <PlatformMark platform={platform} />
                    <span><strong>{meta.label}</strong><small>{identity.handle || identity.profileUrl || 'Shared profile'}</small></span>
                    <span className="received-social-action">{meta.action}<ExternalLink size={13} /></span>
                  </a>
                );
              })}
            </div>

            <button className="button secondary full-button" onClick={() => downloadVCard(payload)}><Download size={17} /> Save complete vCard</button>
          </section>

          <section className="panel memory-capture-panel">
            <div className="panel-heading">
              <div>
                <span className="step-badge">MEM</span>
                <div><h3>Remember the moment</h3><p>Private to your TagOnce address book unless you choose to share it later.</p></div>
              </div>
            </div>

            {memoryPhoto && (
              <div className="memory-photo-stage compact-memory-photo-stage">
                <img src={memoryPhoto} alt="Memory with this contact" />
                <button className="photo-remove-button" onClick={() => setMemoryPhoto('')}><X size={15} /> Remove</button>
              </div>
            )}

            <input
              ref={cameraInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*"
              capture="user"
              onChange={(event) => captureMemory(event.target.files?.[0], event.currentTarget)}
            />
            <input
              ref={uploadInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => captureMemory(event.target.files?.[0], event.currentTarget)}
            />

            <button className="memory-camera-cta" onClick={() => cameraInputRef.current?.click()}>
              <span className="memory-camera-icon"><Camera size={29} /></span>
              <span>
                <strong>{memoryPhoto ? 'Retake photo together' : 'Take a photo together'}</strong>
                <small>Open the front camera and capture the moment.</small>
              </span>
            </button>
            <div className="memory-upload-row">
              <span>Already have a photo?</span>
              <button className="text-button memory-upload-button" onClick={() => uploadInputRef.current?.click()}>
                <ImagePlus size={15} /> Upload photo
              </button>
            </div>
            {photoError && <div className="inline-error">{photoError}</div>}

            <label className="field"><span>Where did you meet?</span><div className="input-with-icon"><MapPin size={16} /><input value={metAt} onChange={(event) => setMetAt(event.target.value)} placeholder="Event, venue or introduction" /></div></label>
            <label className="field"><span>What should you remember?</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What they do, what you discussed, and the next step..." /></label>

            <button className="button primary full-button" disabled={expired || saved} onClick={saveContact}>
              {saved ? <Check size={17} /> : <Sparkles size={17} />}
              {saved ? 'Saved to address book' : 'Save contact and memory'}
            </button>
            {saved && <button className="text-button centered-text-button" onClick={onOpenAddressBook}>Open address book</button>}
          </section>
        </div>
      )}
    </div>
  );
}

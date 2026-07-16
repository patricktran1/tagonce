import {
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ContactRound,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compressImage,
  decodeCardPayload,
  downloadVCard,
  extractCardToken,
} from '../lib/cardExchange';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarEventSuggestions,
  getCalendarStatus,
  type CalendarConnectionState,
  type CalendarEventSuggestion,
} from '../lib/calendarService';
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

interface ReverseGeocodeResult {
  display_name?: string;
  name?: string;
  address?: {
    amenity?: string;
    building?: string;
    tourism?: string;
    leisure?: string;
    shop?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    county?: string;
    state?: string;
  };
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

function eventMeetingContext(payload: ShareCardPayload | null) {
  if (!payload) return '';
  return [payload.eventName, payload.eventLocation].filter(Boolean).join(' · ');
}

function sharedEventTime(payload: ShareCardPayload) {
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

function safeEventUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function conciseLocation(result: ReverseGeocodeResult, latitude: number, longitude: number) {
  const address = result.address ?? {};
  const landmark = result.name
    || address.amenity
    || address.building
    || address.tourism
    || address.leisure
    || address.shop
    || address.road;
  const locality = address.city
    || address.town
    || address.village
    || address.suburb
    || address.county;
  const region = address.state;
  const parts = [landmark, locality, region].filter(
    (value, index, values): value is string => Boolean(value && values.indexOf(value) === index),
  );
  return parts.join(', ')
    || result.display_name
    || `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
}

async function reverseGeocode(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('The place name could not be resolved.');
  return response.json() as Promise<ReverseGeocodeResult>;
}

const relevanceLabels: Record<CalendarEventSuggestion['relevance'], string> = {
  happening_now: 'Happening now',
  starting_soon: 'Starting soon',
  recently_ended: 'Just ended',
  today: 'Today',
};

function calendarTimeLabel(event: CalendarEventSuggestion) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(start);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time.format(start)}–${time.format(end)}`;
}

export function ScanPage({ onSaveContact, onOpenAddressBook }: ScanPageProps) {
  const [initial] = useState(getInitialScanState);
  const [input, setInput] = useState(initial.input);
  const [payload, setPayload] = useState<ShareCardPayload | null>(initial.payload);
  const [error, setError] = useState(initial.error);
  const [metAt, setMetAt] = useState(eventMeetingContext(initial.payload));
  const [notes, setNotes] = useState('');
  const [memoryPhoto, setMemoryPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [locating, setLocating] = useState(false);
  const [calendarState, setCalendarState] = useState<CalendarConnectionState>('checking');
  const [calendarSuggestions, setCalendarSuggestions] = useState<CalendarEventSuggestion[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [saved, setSaved] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const socialEntries = useMemo(
    () => payload
      ? (Object.entries(payload.socials) as Array<[SocialPlatform, SharedSocialIdentity]>)
      : [],
    [payload],
  );

  const eventTime = payload ? sharedEventTime(payload) : '';
  const eventUrl = safeEventUrl(payload?.eventUrl);
  const expired = Boolean(payload?.expiresAt && new Date(payload.expiresAt).getTime() < Date.now());

  useEffect(() => {
    if (!payload) return undefined;
    let cancelled = false;

    async function checkCalendar() {
      setCalendarState('checking');
      setCalendarError('');
      const oauthResult = new URLSearchParams(window.location.search).get('calendar');
      if (oauthResult === 'cancelled') setCalendarError('Google Calendar connection was cancelled.');
      if (oauthResult && !['connected', 'cancelled'].includes(oauthResult)) {
        setCalendarError('Google Calendar could not be connected. Check the app setup and try again.');
      }

      try {
        const status = await getCalendarStatus();
        if (cancelled) return;
        if (!status.configured) {
          setCalendarState('unconfigured');
          return;
        }
        if (!status.connected) {
          setCalendarState('disconnected');
          return;
        }

        setCalendarState('connected');
        setCalendarLoading(true);
        const suggestionResponse = await getCalendarEventSuggestions(payload?.eventName || '');
        if (cancelled) return;
        if (!suggestionResponse.connected) {
          setCalendarState('disconnected');
          setCalendarSuggestions([]);
          if (suggestionResponse.error) setCalendarError(suggestionResponse.error);
          return;
        }
        setCalendarSuggestions(suggestionResponse.events || []);
      } catch (calendarFailure) {
        if (!cancelled) {
          setCalendarState('disconnected');
          setCalendarError(calendarFailure instanceof Error ? calendarFailure.message : 'Calendar could not be checked.');
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }

      const cleanUrl = new URL(window.location.href);
      if (cleanUrl.searchParams.has('calendar')) {
        cleanUrl.searchParams.delete('calendar');
        window.history.replaceState({}, '', cleanUrl);
      }
    }

    void checkCalendar();
    return () => { cancelled = true; };
  }, [payload]);

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
      setMetAt(eventMeetingContext(decoded));
      setError('');
      setLocationError('');
      setLocationNote(decoded.eventName ? 'Event context filled from this TagOnce card.' : '');
      setSaved(false);
    } catch (openError) {
      setPayload(null);
      setError(openError instanceof Error ? openError.message : 'The TagOnce card could not be opened.');
    }
  }

  async function captureMemory(file: File | undefined, inputElement?: HTMLInputElement | null) {
    if (!file) return;
    try {
      setMemoryPhoto(await compressImage(file));
      setPhotoError('');
    } catch (captureError) {
      setPhotoError(captureError instanceof Error ? captureError.message : 'The photo could not be saved.');
    } finally {
      if (inputElement) inputElement.value = '';
    }
  }

  function useCurrentLocation() {
    setLocationError('');
    setLocationNote('');
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser. You can still type the venue manually.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const fallback = `Current location (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`;
        try {
          const result = await reverseGeocode(coords.latitude, coords.longitude);
          setMetAt(conciseLocation(result, coords.latitude, coords.longitude));
          setLocationNote('Current place added from this device. You can edit it before saving.');
        } catch {
          setMetAt(fallback);
          setLocationNote('GPS coordinates added. Rename the place if you recognize the venue.');
        } finally {
          setLocating(false);
        }
      },
      (locationFailure) => {
        setLocating(false);
        if (locationFailure.code === locationFailure.PERMISSION_DENIED) {
          setLocationError('Location permission was not granted. Your location was not saved.');
        } else if (locationFailure.code === locationFailure.TIMEOUT) {
          setLocationError('Location lookup timed out. Try again or enter the venue manually.');
        } else {
          setLocationError('Your current location could not be determined.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function useEventContext() {
    if (!payload?.eventName) return;
    setMetAt(eventMeetingContext(payload));
    setLocationError('');
    setLocationNote('Event context restored from the scanned TagOnce card.');
  }

  function useCalendarEvent(event: CalendarEventSuggestion) {
    setMetAt([event.title, event.location].filter(Boolean).join(' · '));
    setLocationError('');
    setLocationNote(`Meeting context filled from Google Calendar: ${event.title}.`);
  }

  async function refreshCalendarSuggestions() {
    if (!payload) return;
    setCalendarLoading(true);
    setCalendarError('');
    try {
      const response = await getCalendarEventSuggestions(payload.eventName || '');
      if (!response.connected) {
        setCalendarState('disconnected');
        setCalendarSuggestions([]);
        setCalendarError(response.error || 'Google Calendar needs to be reconnected.');
        return;
      }
      setCalendarState('connected');
      setCalendarSuggestions(response.events || []);
    } catch (calendarFailure) {
      setCalendarError(calendarFailure instanceof Error ? calendarFailure.message : 'Calendar could not be checked.');
    } finally {
      setCalendarLoading(false);
    }
  }

  async function disconnectCalendar() {
    try {
      await disconnectGoogleCalendar();
      setCalendarState('disconnected');
      setCalendarSuggestions([]);
      setCalendarError('');
    } catch (calendarFailure) {
      setCalendarError(calendarFailure instanceof Error ? calendarFailure.message : 'Calendar could not be disconnected.');
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
      metAt: metAt || eventMeetingContext(payload),
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
    setLocationError('');
    setLocationNote('');
    setCalendarSuggestions([]);
    setCalendarError('');
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

            {payload.eventName && (eventTime || payload.eventLocation || eventUrl) && (
              <div className="received-event-context">
                <span className="received-event-context-title"><CalendarDays size={16} /><strong>{payload.eventName}</strong></span>
                {eventTime && <span><CalendarDays size={14} /> {eventTime}</span>}
                {payload.eventLocation && <span><MapPin size={14} /> {payload.eventLocation}</span>}
                {eventUrl && <a href={eventUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open event page</a>}
              </div>
            )}

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

            <div className="meeting-context-field">
              <label className="field">
                <span>Where did you meet?</span>
                <div className="input-with-icon"><MapPin size={16} /><input value={metAt} onChange={(event) => setMetAt(event.target.value)} placeholder="Event, venue or introduction" /></div>
              </label>
              <div className="meeting-context-actions">
                <button className="meeting-context-button" disabled={locating} onClick={useCurrentLocation}>
                  {locating ? <Loader2 className="spin" size={15} /> : <LocateFixed size={15} />}
                  {locating ? 'Finding place…' : 'Use current location'}
                </button>
                {payload.eventName && (
                  <button className="meeting-context-button event-context-button" onClick={useEventContext}>
                    <CalendarCheck size={15} /> Use QR event: {payload.eventName}
                  </button>
                )}
              </div>
              <small className="location-privacy-note">GPS is requested only when you tap the button. Review or edit the result before saving.</small>
              {locationNote && <div className="location-status-note">{locationNote}</div>}
              {locationError && <div className="inline-error">{locationError}</div>}

              <div className={`calendar-detection-card calendar-${calendarState}`}>
                <div className="calendar-detection-heading">
                  <span className="calendar-detection-icon"><CalendarDays size={18} /></span>
                  <span>
                    <strong>Find this event from your calendar</strong>
                    <small>Useful for Luma and other registrations added to Google Calendar.</small>
                  </span>
                  {calendarState === 'connected' && (
                    <button className="icon-button small-icon-button" disabled={calendarLoading} onClick={refreshCalendarSuggestions} aria-label="Refresh calendar suggestions">
                      <RefreshCw className={calendarLoading ? 'spin' : ''} size={15} />
                    </button>
                  )}
                </div>

                {(calendarState === 'checking' || calendarLoading) && (
                  <div className="calendar-loading-state"><Loader2 className="spin" size={16} /> Checking nearby calendar events…</div>
                )}

                {calendarState === 'disconnected' && !calendarLoading && (
                  <div className="calendar-connect-state">
                    <span>Connect once with read-only access. TagOnce will suggest events near the current time.</span>
                    <button className="button secondary small-button" onClick={connectGoogleCalendar}><CalendarCheck size={15} /> Connect Google Calendar</button>
                  </div>
                )}

                {calendarState === 'unconfigured' && (
                  <div className="calendar-connect-state muted-calendar-state">
                    <span>Calendar sync is built but still needs Google OAuth credentials in Vercel.</span>
                  </div>
                )}

                {calendarState === 'connected' && !calendarLoading && calendarSuggestions.length === 0 && (
                  <div className="calendar-empty-state">No current, just-ended, or soon-starting event was found on your primary calendar.</div>
                )}

                {calendarState === 'connected' && calendarSuggestions.length > 0 && (
                  <div className="calendar-suggestion-list">
                    {calendarSuggestions.map((event) => (
                      <article className={event.matchesCard ? 'calendar-suggestion matches-card' : 'calendar-suggestion'} key={event.id}>
                        <div className="calendar-suggestion-copy">
                          <span className="calendar-relevance-pill">{event.matchesCard ? 'Matches card' : relevanceLabels[event.relevance]}</span>
                          <strong>{event.title}</strong>
                          <small>{event.location || 'No venue listed'} · {calendarTimeLabel(event)}</small>
                        </div>
                        <div className="calendar-suggestion-actions">
                          {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer" aria-label={`Open ${event.title} in Google Calendar`}><ExternalLink size={14} /></a>}
                          <button onClick={() => useCalendarEvent(event)}>Use event</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {calendarState === 'connected' && (
                  <button className="text-button calendar-disconnect-button" onClick={disconnectCalendar}><Unplug size={13} /> Disconnect calendar</button>
                )}
                {calendarError && <div className="inline-error calendar-inline-error">{calendarError}</div>}
              </div>
            </div>

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

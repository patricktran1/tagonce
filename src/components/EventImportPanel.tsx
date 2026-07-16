import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  PencilLine,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { MyProfile } from '../types';

interface EventImportPanelProps {
  profile: MyProfile;
  onChange: (profile: MyProfile) => void;
  onOpenCards: () => void;
}

interface EventPreviewResponse {
  ok: boolean;
  url?: string;
  sourceHost?: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  confidence?: 'high' | 'medium' | 'low';
  sourceKind?: 'json-ld' | 'embedded-json' | 'metadata';
  warnings?: string[];
  error?: string;
}

interface EventDraft {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  url: string;
  description: string;
  imageUrl: string;
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

function draftFromProfile(profile: MyProfile): EventDraft {
  return {
    title: profile.eventName || '',
    startAt: isoToLocalInput(profile.eventStartAt),
    endAt: isoToLocalInput(profile.eventEndAt),
    location: profile.eventLocation || '',
    url: profile.eventUrl || '',
    description: profile.eventDescription || '',
    imageUrl: '',
  };
}

function normalizedEventUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return '';
    }
  }
}

function sourceLabel(sourceKind: EventPreviewResponse['sourceKind']) {
  if (sourceKind === 'json-ld') return 'structured event data';
  if (sourceKind === 'embedded-json') return 'embedded event data';
  return 'page metadata';
}

export function EventImportPanel({ profile, onChange, onOpenCards }: EventImportPanelProps) {
  const [eventUrl, setEventUrl] = useState(profile.eventUrl || '');
  const [draft, setDraft] = useState<EventDraft>(() => draftFromProfile(profile));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState<EventPreviewResponse['confidence']>();
  const [sourceKind, setSourceKind] = useState<EventPreviewResponse['sourceKind']>();

  function updateDraft<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function importEvent() {
    const normalized = normalizedEventUrl(eventUrl);
    if (!normalized) {
      setError('Paste a complete event link first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setConfidence(undefined);
    setSourceKind(undefined);

    try {
      const response = await fetch(`/api/event-preview?url=${encodeURIComponent(normalized)}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as EventPreviewResponse;
      setDraft((current) => ({
        title: payload.title || current.title,
        startAt: payload.startAt ? isoToLocalInput(payload.startAt) : current.startAt,
        endAt: payload.endAt ? isoToLocalInput(payload.endAt) : current.endAt,
        location: payload.location || current.location,
        url: payload.url || normalized,
        description: payload.description || current.description,
        imageUrl: payload.imageUrl || current.imageUrl,
      }));
      setEventUrl(payload.url || normalized);
      setConfidence(payload.confidence);
      setSourceKind(payload.sourceKind);

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'TagOnce could not extract every event detail. Complete the form manually.');
      } else {
        const missing = payload.warnings?.length || 0;
        setMessage(
          missing
            ? `Event loaded from ${payload.sourceHost || 'the page'}. Review the ${missing} missing field${missing === 1 ? '' : 's'}.`
            : `Event loaded from ${payload.sourceHost || 'the page'} using ${sourceLabel(payload.sourceKind)}.`,
        );
      }
    } catch (importError) {
      setDraft((current) => ({ ...current, url: normalized }));
      setError(importError instanceof Error ? importError.message : 'The event link could not be previewed. Enter the details manually.');
    } finally {
      setLoading(false);
    }
  }

  function clearDraft() {
    setEventUrl('');
    setDraft({ title: '', startAt: '', endAt: '', location: '', url: '', description: '', imageUrl: '' });
    setMessage('');
    setError('');
    setConfidence(undefined);
    setSourceKind(undefined);
  }

  function createEventCard() {
    const title = draft.title.trim();
    if (!title) {
      setError('Add an event name before creating the QR.');
      return;
    }
    const eventSelection = profile.cardSelections?.event ?? [];
    const selectedEventFields = eventSelection.includes('eventName')
      ? eventSelection
      : [...eventSelection, 'eventName' as const];
    const expirationDate = (draft.endAt || draft.startAt || new Date().toISOString()).slice(0, 10);

    onChange({
      ...profile,
      eventName: title,
      eventStartsAt: undefined,
      eventStartAt: localInputToIso(draft.startAt),
      eventEndAt: localInputToIso(draft.endAt),
      eventEndsAt: expirationDate,
      eventLocation: draft.location.trim(),
      eventUrl: (draft.url || eventUrl).trim(),
      eventDescription: draft.description.trim(),
      cardSelections: {
        ...profile.cardSelections,
        event: selectedEventFields,
      },
    } as MyProfile);
    onOpenCards();
  }

  const hasDraft = Boolean(draft.title || draft.startAt || draft.location || draft.url);

  return (
    <section className="panel event-import-panel">
      <div className="panel-heading event-import-heading">
        <div>
          <span className="step-badge">1</span>
          <div>
            <h3>Load an event</h3>
            <p>Paste a Luma or public event link, or enter the details manually.</p>
          </div>
        </div>
        {hasDraft && (
          <button className="text-button event-clear-button" type="button" onClick={clearDraft}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div className="event-link-importer">
        <div className="event-link-input">
          <Link2 size={18} />
          <input
            value={eventUrl}
            onChange={(event) => setEventUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void importEvent();
            }}
            placeholder="Paste a Luma or event link"
            inputMode="url"
          />
        </div>
        <button className="button primary" type="button" disabled={loading || !eventUrl.trim()} onClick={() => void importEvent()}>
          {loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
          {loading ? 'Reading event…' : 'Load event'}
        </button>
      </div>

      {(message || confidence) && (
        <div className={`event-import-status confidence-${confidence || 'medium'}`}>
          <CheckCircle2 size={16} />
          <span>
            <strong>{confidence ? `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence` : 'Event loaded'}</strong>
            <small>{message}</small>
          </span>
        </div>
      )}
      {error && <div className="inline-error event-import-error"><AlertCircle size={15} /> {error}</div>}

      <div className="event-draft-heading">
        <span><PencilLine size={16} /> Editable event details</span>
        <small>Nothing is locked. Correct anything before creating the QR.</small>
      </div>

      <div className="event-draft-grid">
        <label className="field event-title-field">
          <span>Event name</span>
          <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="AI Builders Summit" />
        </label>

        <label className="field">
          <span>Starts</span>
          <div className="input-with-icon"><Clock3 size={15} /><input type="datetime-local" value={draft.startAt} onChange={(event) => updateDraft('startAt', event.target.value)} /></div>
        </label>
        <label className="field">
          <span>Ends</span>
          <div className="input-with-icon"><Clock3 size={15} /><input type="datetime-local" value={draft.endAt} onChange={(event) => updateDraft('endAt', event.target.value)} /></div>
        </label>

        <label className="field event-location-field">
          <span>Venue or location</span>
          <div className="input-with-icon"><MapPin size={15} /><input value={draft.location} onChange={(event) => updateDraft('location', event.target.value)} placeholder="Exploratorium, San Francisco" /></div>
        </label>

        <label className="field event-source-field">
          <span>Event page</span>
          <div className="input-with-icon"><ExternalLink size={15} /><input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="https://lu.ma/..." /></div>
        </label>

        <label className="field event-description-field">
          <span>Private setup note</span>
          <textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} placeholder="Optional event description or reminder" rows={3} />
        </label>
      </div>

      {draft.imageUrl && (
        <div className="event-import-cover">
          <img src={draft.imageUrl} alt="Imported event cover" />
          <span>Event cover found</span>
        </div>
      )}

      <div className="event-import-actions">
        <div>
          <CalendarPlus size={18} />
          <span><strong>Ready to meet people?</strong><small>This loads Event mode and opens the QR studio.</small></span>
        </div>
        <button className="button primary event-create-card-button" type="button" disabled={!draft.title.trim()} onClick={createEventCard}>
          <Sparkles size={17} /> Create Event QR
        </button>
      </div>
    </section>
  );
}

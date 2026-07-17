import {
  CalendarDays,
  Check,
  ChevronDown,
  Clipboard,
  ContactRound,
  Image,
  MessageCircle,
  Repeat2,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildEventRecaps, eventRecapText } from '../lib/eventRecaps';
import type { MentionEntity } from '../types';
import { ProfileAvatar } from './ProfileAvatar';

interface EventRecapPreviewProps {
  entities: MentionEntity[];
  onOpenContacts: () => void;
}

function eventDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved event';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function EventRecapPreview({ entities, onOpenContacts }: EventRecapPreviewProps) {
  const recaps = useMemo(() => buildEventRecaps(entities).slice(0, 3), [entities]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (recaps.length === 0) return null;

  async function copyRecap(recapId: string) {
    const recap = recaps.find((item) => item.id === recapId);
    if (!recap) return;
    try {
      await navigator.clipboard.writeText(eventRecapText(recap));
      setCopiedId(recapId);
      window.setTimeout(() => setCopiedId((current) => current === recapId ? null : current), 2200);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="panel event-recap-panel" aria-labelledby="event-recap-heading">
      <header className="event-recap-header">
        <span className="event-recap-header-icon"><CalendarDays size={21} /></span>
        <span>
          <small className="eyebrow">Event memory</small>
          <strong id="event-recap-heading">Recent event recaps</strong>
          <p>See who you met, whether you shared back, and what still needs follow-up.</p>
        </span>
        <button className="button secondary small-button" type="button" onClick={onOpenContacts}><ContactRound size={15} /> Open contacts</button>
      </header>

      <div className="event-recap-grid">
        {recaps.map((recap) => {
          const expanded = expandedId === recap.id;
          return (
            <article className={`event-recap-card${expanded ? ' expanded' : ''}`} key={recap.id}>
              <div className="event-recap-card-heading">
                <span>
                  <small>{eventDateLabel(recap.latestAt)}</small>
                  <strong>{recap.name}</strong>
                </span>
                <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : recap.id)}>
                  <ChevronDown size={17} />
                </button>
              </div>

              <div className="event-recap-metrics">
                <span><UsersRound size={15} /><strong>{recap.people.length}</strong><small>people</small></span>
                <span><Repeat2 size={15} /><strong>{recap.sharedBackCount}</strong><small>shared back</small></span>
                <span className={recap.pendingFollowUpCount ? 'needs-attention' : ''}><MessageCircle size={15} /><strong>{recap.pendingFollowUpCount}</strong><small>follow-ups</small></span>
              </div>

              <div className="event-recap-people-preview" aria-label={`${recap.people.length} people met at ${recap.name}`}>
                {recap.people.slice(0, 4).map((person) => (
                  <ProfileAvatar
                    name={person.entity.displayName}
                    src={person.entity.avatarUrl}
                    className="event-recap-avatar"
                    key={person.entity.id}
                  />
                ))}
                {recap.people.length > 4 && <span className="event-recap-avatar-overflow">+{recap.people.length - 4}</span>}
                <span>{recap.noteCount ? `${recap.noteCount} with notes` : 'No notes yet'}{recap.photoCount ? ` · ${recap.photoCount} photos` : ''}</span>
              </div>

              {expanded && (
                <div className="event-recap-people-list">
                  {recap.people.map((person) => (
                    <div className="event-recap-person" key={person.entity.id}>
                      <ProfileAvatar name={person.entity.displayName} src={person.entity.avatarUrl} className="event-recap-person-avatar" />
                      <span>
                        <strong>{person.entity.displayName}</strong>
                        <small>{person.entity.company || person.entity.title || person.latestEncounter.notes || 'TagOnce contact'}</small>
                      </span>
                      <span className="event-recap-person-states">
                        {person.sharedBack && <small className="shared-back"><Repeat2 size={12} /> Shared back</small>}
                        {person.pendingFollowUps > 0 && <small className="pending"><MessageCircle size={12} /> {person.pendingFollowUps} pending</small>}
                        {person.latestEncounter.memoryPhotoDataUrl && <small><Image size={12} /> Photo</small>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="event-recap-card-actions">
                <button type="button" onClick={() => void copyRecap(recap.id)}>
                  {copiedId === recap.id ? <Check size={14} /> : <Clipboard size={14} />}
                  {copiedId === recap.id ? 'Copied' : 'Copy recap'}
                </button>
                <button type="button" onClick={() => setExpandedId(expanded ? null : recap.id)}>
                  {expanded ? 'Hide people' : 'View people'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

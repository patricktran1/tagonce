import {
  CalendarDays,
  Camera,
  ContactRound,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ScanLine,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { allSocialPlatforms, socialPlatformMeta, socialProfileUrl } from '../data/socials';
import { compressImage } from '../lib/cardExchange';
import { contactEncounters, prepareContactRecord } from '../lib/contactHistory';
import type { ContactEncounter, MentionEntity, SocialPlatform } from '../types';
import { AddEntityModal } from './AddEntityModal';
import { PlatformMark } from './PlatformMark';
import { ProfileAvatar } from './ProfileAvatar';

interface AddressBookPageProps {
  entities: MentionEntity[];
  onAdd: (entity: MentionEntity) => void;
  onUpdate: (entity: MentionEntity) => void;
  onDelete: (entityId: string) => void;
  onScan: () => void;
  onCreatePost: () => void;
}

interface PhotoTarget {
  entityId: string;
  encounterId?: string;
}

function formatEncounterDate(value?: string) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function safeHttpUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function whatsappUrl(value?: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return safeHttpUrl(value);
  const digits = value.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function newEncounterId() {
  return `encounter_${crypto.randomUUID?.() ?? Date.now()}`;
}

export function AddressBookPage({
  entities,
  onAdd,
  onUpdate,
  onDelete,
  onScan,
}: AddressBookPageProps) {
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const contactRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entities
      .map((entity) => {
        const encounters = contactEncounters(entity);
        return { entity, encounters, latest: encounters[0] };
      })
      .filter(({ entity, encounters }) => {
        if (!normalized) return true;
        return [
          entity.displayName,
          entity.description,
          entity.company,
          entity.email,
          entity.phone,
          entity.whatsapp,
          ...encounters.flatMap((encounter) => [encounter.metAt, encounter.notes]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      })
      .sort((left, right) => {
        const leftTime = new Date(left.latest?.metOn || left.entity.createdAt).getTime() || 0;
        const rightTime = new Date(right.latest?.metOn || right.entity.createdAt).getTime() || 0;
        return rightTime - leftTime;
      });
  }, [entities, query]);

  const encounterCount = entities.reduce((total, entity) => total + contactEncounters(entity).length, 0);
  const noteCount = entities.reduce(
    (total, entity) => total + contactEncounters(entity).filter((encounter) => Boolean(encounter.notes)).length,
    0,
  );

  function patchEntity(entity: MentionEntity, patch: Partial<MentionEntity>) {
    onUpdate(prepareContactRecord({ ...entity, ...patch }));
  }

  function saveEncounterList(entity: MentionEntity, encounters: ContactEncounter[]) {
    onUpdate(prepareContactRecord({
      ...entity,
      encounters,
      metAt: encounters[0]?.metAt,
      metOn: encounters[0]?.metOn,
      notes: encounters[0]?.notes,
      sourceCardMode: encounters[0]?.sourceCardMode,
    }));
  }

  function patchEncounter(entity: MentionEntity, encounterId: string, patch: Partial<ContactEncounter>) {
    const encounters = contactEncounters(entity).map((encounter) =>
      encounter.id === encounterId ? { ...encounter, ...patch } : encounter,
    );
    saveEncounterList(entity, encounters);
  }

  function addEncounter(entity: MentionEntity) {
    const encounter: ContactEncounter = {
      id: newEncounterId(),
      metOn: new Date().toISOString(),
      metAt: '',
      notes: '',
      sourceCardMode: 'custom',
    };
    saveEncounterList(entity, [encounter, ...contactEncounters(entity)]);
    setExpandedId(entity.id);
  }

  function removeEncounter(entity: MentionEntity, encounterId: string) {
    saveEncounterList(entity, contactEncounters(entity).filter((encounter) => encounter.id !== encounterId));
  }

  function choosePhoto(entityId: string, encounterId?: string) {
    setPhotoTarget({ entityId, encounterId });
    photoInputRef.current?.click();
  }

  async function savePhoto(file: File | undefined) {
    if (!file || !photoTarget) return;
    const entity = entities.find((item) => item.id === photoTarget.entityId);
    if (!entity) return;
    try {
      const memoryPhotoDataUrl = await compressImage(file);
      const history = contactEncounters(entity);
      if (photoTarget.encounterId) {
        saveEncounterList(entity, history.map((encounter) =>
          encounter.id === photoTarget.encounterId ? { ...encounter, memoryPhotoDataUrl } : encounter,
        ));
      } else if (history[0]) {
        saveEncounterList(entity, history.map((encounter, index) =>
          index === 0 ? { ...encounter, memoryPhotoDataUrl } : encounter,
        ));
      } else {
        saveEncounterList(entity, [{
          id: newEncounterId(),
          metOn: new Date().toISOString(),
          memoryPhotoDataUrl,
          sourceCardMode: 'custom',
        }]);
      }
    } finally {
      setPhotoTarget(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  return (
    <div className="page-stack address-book-page relationship-address-book">
      <section className="address-book-hero relationship-book-hero">
        <div>
          <span className="hero-kicker">People and encounters</span>
          <h2>One person. Every time you crossed paths.</h2>
          <p>
            TagOnce keeps each contact together while preserving the events, notes and photos from every encounter.
          </p>
          <div className="identity-hero-actions">
            <button className="button primary" onClick={onScan}><ScanLine size={17} /> Receive a card</button>
            <button className="button secondary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add manually</button>
          </div>
        </div>
        <div className="address-stats">
          <span><strong>{entities.length}</strong><small>People</small></span>
          <span><strong>{encounterCount}</strong><small>Encounters</small></span>
          <span><strong>{noteCount}</strong><small>With notes</small></span>
        </div>
      </section>

      <section className="panel address-book-panel relationship-book-panel">
        <div className="directory-toolbar">
          <label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, companies, events or notes" /></label>
          <span className="record-count">{contactRows.length} {contactRows.length === 1 ? 'person' : 'people'}</span>
        </div>

        <div className="contact-card-grid relationship-contact-grid">
          {contactRows.map(({ entity, encounters, latest }) => {
            const expanded = expandedId === entity.id;
            const website = safeHttpUrl(entity.website);
            const whatsapp = whatsappUrl(entity.whatsapp);
            const socialEntries = allSocialPlatforms
              .map((platform) => ({
                platform,
                identity: entity.socialProfiles?.[platform],
                url: socialProfileUrl(platform, entity.socialProfiles?.[platform]),
              }))
              .filter((entry) => Boolean(entry.url));
            const coverPhoto = latest?.memoryPhotoDataUrl || entity.memoryPhotoDataUrl;

            return (
              <article className={expanded ? 'memory-contact-card relationship-contact-card expanded' : 'memory-contact-card relationship-contact-card'} key={entity.id}>
                <div className="relationship-contact-summary">
                  <div className="relationship-contact-photo">
                    {coverPhoto
                      ? <img src={coverPhoto} alt={`Memory with ${entity.displayName}`} />
                      : entity.avatarUrl
                        ? <img src={entity.avatarUrl} alt={`${entity.displayName} profile`} />
                        : <div className="memory-contact-placeholder"><UserRound size={30} /><span>Add a memory photo</span></div>}
                    <button className="memory-photo-button" onClick={() => choosePhoto(entity.id, latest?.id)}><Camera size={15} /> {coverPhoto ? 'Replace' : 'Add photo'}</button>
                  </div>

                  <div className="relationship-contact-main">
                    <div className="memory-contact-heading relationship-contact-heading">
                      <ProfileAvatar name={entity.displayName} src={entity.avatarUrl} className="relationship-contact-avatar" />
                      <span>
                        <strong>{entity.displayName}</strong>
                        <small>{entity.description || [entity.title, entity.company].filter(Boolean).join(' · ') || 'TagOnce contact'}</small>
                      </span>
                      {encounters.length > 0 && <span className="encounter-count-pill">{encounters.length} {encounters.length === 1 ? 'encounter' : 'encounters'}</span>}
                    </div>

                    <div className="contact-context-strip relationship-context-strip">
                      {latest?.metAt
                        ? <span><MapPin size={14} /> {latest.metAt}</span>
                        : <span className="muted-copy"><MapPin size={14} /> Add where you met</span>}
                      {latest?.metOn && <span><CalendarDays size={14} /> {formatEncounterDate(latest.metOn)}</span>}
                    </div>

                    <div className="contact-quick-actions" aria-label={`Ways to contact ${entity.displayName}`}>
                      {entity.email && <a href={`mailto:${entity.email}`}><Mail size={17} /><span>Email</span></a>}
                      {entity.phone && <a href={`tel:${entity.phone}`}><Phone size={17} /><span>Call</span></a>}
                      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} /><span>WhatsApp</span></a>}
                      {website && <a href={website} target="_blank" rel="noreferrer"><Globe2 size={17} /><span>Website</span></a>}
                      {socialEntries.map(({ platform, url }) => (
                        <a href={url} target="_blank" rel="noreferrer" key={platform}>
                          <PlatformMark platform={platform as SocialPlatform} size="sm" />
                          <span>{socialPlatformMeta[platform].label}</span>
                        </a>
                      ))}
                    </div>

                    {latest?.notes && <p className="memory-note-preview relationship-note-preview">{latest.notes}</p>}

                    <div className="memory-contact-actions relationship-contact-actions">
                      <button className="button secondary small-button" onClick={() => setExpandedId(expanded ? null : entity.id)}><ContactRound size={15} /> {expanded ? 'Close details' : 'View history'}</button>
                      <button className="button secondary small-button" onClick={() => addEncounter(entity)}><Plus size={15} /> Add encounter</button>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="memory-contact-editor relationship-contact-editor">
                    <div className="contact-details-editor">
                      <div className="contact-editor-section-heading">
                        <div><strong>Contact details</strong><small>Update the current way to reach this person.</small></div>
                      </div>
                      <div className="two-field-row">
                        <label className="field"><span>Title</span><input value={entity.title ?? ''} onChange={(event) => patchEntity(entity, { title: event.target.value })} /></label>
                        <label className="field"><span>Company</span><input value={entity.company ?? ''} onChange={(event) => patchEntity(entity, { company: event.target.value })} /></label>
                      </div>
                      <div className="two-field-row">
                        <label className="field"><span>Email</span><input type="email" value={entity.email ?? ''} onChange={(event) => patchEntity(entity, { email: event.target.value })} /></label>
                        <label className="field"><span>Phone</span><input type="tel" value={entity.phone ?? ''} onChange={(event) => patchEntity(entity, { phone: event.target.value })} /></label>
                      </div>
                    </div>

                    <div className="encounter-history-section">
                      <div className="contact-editor-section-heading">
                        <div><strong>Encounter history</strong><small>Newest first. Each meeting keeps its own context.</small></div>
                        <button className="text-button" type="button" onClick={() => addEncounter(entity)}><Plus size={14} /> Add encounter</button>
                      </div>

                      <div className="encounter-timeline">
                        {encounters.map((encounter, index) => (
                          <article className="encounter-timeline-item" key={encounter.id}>
                            <span className="encounter-timeline-dot" aria-hidden="true" />
                            <div className="encounter-timeline-card">
                              <div className="encounter-timeline-heading">
                                <span><CalendarDays size={15} /><strong>{formatEncounterDate(encounter.metOn)}</strong></span>
                                <span className="relationship-chip">{encounter.sourceCardMode || 'saved'}</span>
                              </div>
                              {encounter.memoryPhotoDataUrl && <img className="encounter-memory-photo" src={encounter.memoryPhotoDataUrl} alt={`Encounter ${index + 1} with ${entity.displayName}`} />}
                              <label className="field"><span>Where you met</span><div className="input-with-icon"><MapPin size={15} /><input value={encounter.metAt ?? ''} onChange={(event) => patchEncounter(entity, encounter.id, { metAt: event.target.value })} placeholder="Event, venue or introduction" /></div></label>
                              <label className="field"><span>What should you remember?</span><textarea value={encounter.notes ?? ''} onChange={(event) => patchEncounter(entity, encounter.id, { notes: event.target.value })} placeholder="What you discussed and the next step" /></label>
                              <div className="encounter-timeline-actions">
                                <button className="text-button" type="button" onClick={() => choosePhoto(entity.id, encounter.id)}><Camera size={14} /> {encounter.memoryPhotoDataUrl ? 'Replace photo' : 'Add photo'}</button>
                                <button className="text-button danger-text-button" type="button" onClick={() => removeEncounter(entity, encounter.id)}><Trash2 size={14} /> Remove encounter</button>
                              </div>
                            </div>
                          </article>
                        ))}
                        {encounters.length === 0 && (
                          <button className="empty-encounter-cta" type="button" onClick={() => addEncounter(entity)}><Plus size={18} /><span><strong>Add the first encounter</strong><small>Record where you met and what matters next.</small></span></button>
                        )}
                      </div>
                    </div>

                    <div className="contact-editor-footer relationship-editor-footer">
                      <span><MessageCircle size={15} /> Saved locally in this browser</span>
                      <button className="button danger small-button" onClick={() => onDelete(entity.id)}><Trash2 size={15} /> Delete contact</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {contactRows.length === 0 && (
            <div className="empty-state address-empty-state"><Search size={24} /><strong>No matching people</strong><span>Scan a TagOnce card or add someone manually.</span></div>
          )}
        </div>
      </section>

      <input ref={photoInputRef} className="hidden-file-input" type="file" accept="image/*" capture="user" onChange={(event) => savePhoto(event.target.files?.[0])} />
      {showAdd && <AddEntityModal onClose={() => setShowAdd(false)} onSave={(entity) => { onAdd(entity); setExpandedId(entity.id); setShowAdd(false); }} />}
    </div>
  );
}

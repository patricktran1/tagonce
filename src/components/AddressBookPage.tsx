import {
  Camera,
  ContactRound,
  MapPin,
  MessageCircle,
  PenLine,
  Plus,
  ScanLine,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { allPlatforms } from '../data/demo';
import { compressImage } from '../lib/cardExchange';
import type { MentionEntity } from '../types';
import { AddEntityModal } from './AddEntityModal';
import { PlatformMark } from './PlatformMark';

interface AddressBookPageProps {
  entities: MentionEntity[];
  onAdd: (entity: MentionEntity) => void;
  onUpdate: (entity: MentionEntity) => void;
  onDelete: (entityId: string) => void;
  onScan: () => void;
  onCreatePost: () => void;
}

export function AddressBookPage({
  entities,
  onAdd,
  onUpdate,
  onDelete,
  onScan,
  onCreatePost,
}: AddressBookPageProps) {
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entities;
    return entities.filter((entity) =>
      [entity.displayName, entity.description, entity.company, entity.metAt, entity.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [entities, query]);

  const memoryCount = entities.filter((entity) => entity.memoryPhotoDataUrl || entity.notes || entity.metAt).length;
  const taggedCount = entities.filter((entity) => Object.keys(entity.mappings).length > 0).length;

  function patchEntity(entity: MentionEntity, patch: Partial<MentionEntity>) {
    onUpdate({ ...entity, ...patch });
  }

  function choosePhoto(entityId: string) {
    setPhotoTargetId(entityId);
    photoInputRef.current?.click();
  }

  async function savePhoto(file: File | undefined) {
    if (!file || !photoTargetId) return;
    const entity = entities.find((item) => item.id === photoTargetId);
    if (!entity) return;
    try {
      patchEntity(entity, { memoryPhotoDataUrl: await compressImage(file) });
    } finally {
      setPhotoTargetId(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  return (
    <div className="page-stack address-book-page">
      <section className="address-book-hero">
        <div>
          <span className="hero-kicker">Social address book</span>
          <h2>Remember the person, the context and every way to connect.</h2>
          <p>
            Scanned cards and manually saved collaborators live in the same identity graph used by
            TagOnce when you prepare social posts.
          </p>
          <div className="identity-hero-actions">
            <button className="button primary" onClick={onScan}><ScanLine size={17} /> Receive a card</button>
            <button className="button secondary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add manually</button>
          </div>
        </div>
        <div className="address-stats">
          <span><strong>{entities.length}</strong><small>Contacts</small></span>
          <span><strong>{memoryCount}</strong><small>With context</small></span>
          <span><strong>{taggedCount}</strong><small>Tag-ready</small></span>
        </div>
      </section>

      <section className="panel address-book-panel">
        <div className="directory-toolbar">
          <label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, events, companies or notes" /></label>
          <span className="record-count">{filtered.length} visible</span>
        </div>

        <div className="contact-card-grid">
          {filtered.map((entity) => {
            const expanded = expandedId === entity.id;
            const mappedPlatforms = allPlatforms.filter((platform) => entity.mappings[platform]);
            return (
              <article className={expanded ? 'memory-contact-card expanded' : 'memory-contact-card'} key={entity.id}>
                <div className="memory-contact-cover">
                  {entity.memoryPhotoDataUrl
                    ? <img src={entity.memoryPhotoDataUrl} alt={`Memory with ${entity.displayName}`} />
                    : <div className="memory-contact-placeholder"><UserRound size={30} /><span>No shared photo yet</span></div>}
                  <button className="memory-photo-button" onClick={() => choosePhoto(entity.id)}><Camera size={15} /> {entity.memoryPhotoDataUrl ? 'Replace' : 'Add photo'}</button>
                </div>

                <div className="memory-contact-body">
                  <div className="memory-contact-heading">
                    <span className="entity-avatar">{entity.initials}</span>
                    <span><strong>{entity.displayName}</strong><small>{entity.description || [entity.title, entity.company].filter(Boolean).join(' · ') || `${entity.type} contact`}</small></span>
                  </div>

                  <div className="contact-context-strip">
                    {entity.metAt ? <span><MapPin size={14} /> {entity.metAt}</span> : <span className="muted-copy"><MapPin size={14} /> Add where you met</span>}
                    {entity.sourceCardMode && <span className="relationship-chip">{entity.sourceCardMode}</span>}
                  </div>

                  {entity.notes && <p className="memory-note-preview">“{entity.notes}”</p>}

                  <div className="contact-platform-strip">
                    {mappedPlatforms.length > 0
                      ? mappedPlatforms.map((platform) => <span key={platform}><PlatformMark platform={platform} size="sm" /></span>)
                      : <span className="muted-copy">No social identities mapped</span>}
                  </div>

                  <div className="memory-contact-actions">
                    <button className="button secondary small-button" onClick={() => setExpandedId(expanded ? null : entity.id)}><ContactRound size={15} /> {expanded ? 'Close' : 'Details'}</button>
                    <button className="button primary small-button" onClick={onCreatePost}><PenLine size={15} /> Use in post</button>
                  </div>

                  {expanded && (
                    <div className="memory-contact-editor">
                      <div className="two-field-row">
                        <label className="field"><span>Where you met</span><input value={entity.metAt ?? ''} onChange={(event) => patchEntity(entity, { metAt: event.target.value })} placeholder="Event or introduction" /></label>
                        <label className="field"><span>Company</span><input value={entity.company ?? ''} onChange={(event) => patchEntity(entity, { company: event.target.value })} /></label>
                      </div>
                      <div className="two-field-row">
                        <label className="field"><span>Email</span><input value={entity.email ?? ''} onChange={(event) => patchEntity(entity, { email: event.target.value })} /></label>
                        <label className="field"><span>Phone / WhatsApp</span><input value={entity.whatsapp || entity.phone || ''} onChange={(event) => patchEntity(entity, { whatsapp: event.target.value })} /></label>
                      </div>
                      <label className="field"><span>Memory note</span><textarea value={entity.notes ?? ''} onChange={(event) => patchEntity(entity, { notes: event.target.value })} placeholder="What did you discuss? What is the next step?" /></label>
                      <div className="contact-editor-footer">
                        <span><MessageCircle size={15} /> Saved privately in this browser</span>
                        <button className="button danger small-button" onClick={() => onDelete(entity.id)}><Trash2 size={15} /> Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {filtered.length === 0 && (
            <div className="empty-state address-empty-state"><Search size={24} /><strong>No matching contacts</strong><span>Scan a TagOnce card or add someone manually.</span></div>
          )}
        </div>
      </section>

      <input ref={photoInputRef} className="hidden-file-input" type="file" accept="image/*" capture="user" onChange={(event) => savePhoto(event.target.files?.[0])} />
      {showAdd && <AddEntityModal onClose={() => setShowAdd(false)} onSave={(entity) => { onAdd(entity); setExpandedId(entity.id); setShowAdd(false); }} />}
    </div>
  );
}

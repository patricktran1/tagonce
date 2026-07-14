import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, MoreHorizontal, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { allPlatforms, platformMeta } from '../data/demo';
import type { MentionEntity, Platform } from '../types';
import { AddEntityModal } from './AddEntityModal';
import { MappingEditorModal } from './MappingEditorModal';
import { PlatformMark } from './PlatformMark';

interface MentionDirectoryProps {
  entities: MentionEntity[];
  onAdd: (entity: MentionEntity) => void;
  onDelete: (entityId: string) => void;
  onUpdate: (entity: MentionEntity) => void;
}

export function MentionDirectory({ entities, onAdd, onDelete, onUpdate }: MentionDirectoryProps) {
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(entities[0]?.id ?? null);
  const [editing, setEditing] = useState<{ entity: MentionEntity; platform?: Platform } | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return entities;
    return entities.filter((entity) => `${entity.displayName} ${entity.description ?? ''} ${entity.type}`.toLowerCase().includes(normalized));
  }, [entities, query]);

  return (
    <div className="page-stack">
      <section className="hero-panel compact-hero">
        <div><span className="hero-kicker">Your identity graph</span><h2>Map once. Stop hunting for handles.</h2><p>Save each person or company’s platform identity once, then reuse the correct native mention in every future campaign.</p></div>
        <button className="button primary" onClick={() => setShowModal(true)}><Plus size={17} />Add mention</button>
      </section>
      <section className="panel directory-panel">
        <div className="directory-toolbar"><label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, companies or handles" /></label><span className="record-count">{filtered.length} saved entities</span></div>
        <div className="entity-list">
          {filtered.map((entity) => {
            const mappedCount = allPlatforms.filter((platform) => entity.mappings[platform]).length;
            const expanded = expandedId === entity.id;
            return (
              <article className={expanded ? 'entity-card expanded' : 'entity-card'} key={entity.id}>
                <button className="entity-card-summary" onClick={() => setExpandedId(expanded ? null : entity.id)}>
                  <span className="entity-avatar">{entity.initials}</span><span className="entity-main-copy"><strong>{entity.displayName}</strong><small>{entity.description || `${entity.type} mention`}</small></span><span className="entity-type-pill">{entity.type}</span><span className="mapping-count"><ShieldCheck size={15} />{mappedCount}/{allPlatforms.length} mapped</span><span className="usage-count">Used {entity.usageCount}×</span><MoreHorizontal size={18} />
                </button>
                {expanded && (
                  <div className="entity-mapping-grid">
                    {allPlatforms.map((platform) => {
                      const mapping = entity.mappings[platform];
                      return (
                        <div className="mapping-tile" key={platform}>
                          <div className="mapping-tile-heading"><PlatformMark platform={platform} size="sm" /><span>{platformMeta[platform].label}</span>{mapping?.verified && <CheckCircle2 className="success-icon" size={16} />}</div>
                          {mapping ? <><strong>{mapping.handle ?? mapping.displayName}</strong><small>{mapping.verified ? 'Verified mapping' : 'Needs confirmation'}</small>{mapping.profileUrl ? <a className="text-button" href={mapping.profileUrl} target="_blank" rel="noreferrer">Open profile <ExternalLink size={13} /></a> : <button className="text-button" onClick={() => setEditing({ entity, platform })}>Add profile URL</button>}</> : <><strong className="muted-copy">Not mapped</strong><small>Add this profile before publishing</small><button className="text-button" onClick={() => setEditing({ entity, platform })}>Add account</button></>}
                        </div>
                      );
                    })}
                    <div className="entity-card-actions"><button className="button secondary small-button" onClick={() => setEditing({ entity })}>Edit mappings</button><button className="button danger small-button" onClick={() => onDelete(entity.id)}><Trash2 size={15} />Delete</button></div>
                  </div>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && <div className="empty-state"><Search size={24} /><strong>No matching mentions</strong><span>Try another name or add a new entity.</span></div>}
        </div>
      </section>
      {editing && <MappingEditorModal entity={editing.entity} initialPlatform={editing.platform} onClose={() => setEditing(null)} onSave={(entity) => { onUpdate(entity); setEditing(null); }} />}
      {showModal && <AddEntityModal onClose={() => setShowModal(false)} onSave={(entity) => { onAdd(entity); setExpandedId(entity.id); setShowModal(false); }} />}
    </div>
  );
}

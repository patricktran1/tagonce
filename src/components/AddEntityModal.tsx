import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { allPlatforms, platformMeta } from '../data/demo';
import type { EntityType, MentionEntity, PlatformMapping } from '../types';
import { PlatformMark } from './PlatformMark';

interface AddEntityModalProps {
  onClose: () => void;
  onSave: (entity: MentionEntity) => void;
}

export function AddEntityModal({ onClose, onSave }: AddEntityModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<EntityType>('company');
  const [description, setDescription] = useState('');
  const [handles, setHandles] = useState<Record<string, string>>({});

  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join('') || '?',
    [displayName],
  );

  function submit() {
    if (!displayName.trim()) return;
    const mappings: MentionEntity['mappings'] = {};

    allPlatforms.forEach((platform) => {
      const handle = handles[platform]?.trim();
      if (!handle) return;
      const mapping: PlatformMapping = {
        platform,
        displayName: displayName.trim(),
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        nativeTagSupported: true,
        verified: false,
      };
      mappings[platform] = mapping;
    });

    onSave({
      id: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      displayName: displayName.trim(),
      type,
      description: description.trim(),
      initials,
      mappings,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-entity-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Universal mention directory</span>
            <h2 id="add-entity-title">Add a person or company</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>

        <div className="entity-identity-row">
          <span className="entity-avatar large">{initials}</span>
          <div className="field grow">
            <label htmlFor="entity-name">Display name</label>
            <input
              id="entity-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Example: Northstar Labs"
              autoFocus
            />
          </div>
          <div className="field compact-field">
            <label htmlFor="entity-type">Type</label>
            <select
              id="entity-type"
              value={type}
              onChange={(event) => setType(event.target.value as EntityType)}
            >
              <option value="person">Person</option>
              <option value="company">Company</option>
              <option value="brand">Brand</option>
              <option value="organization">Organization</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="entity-description">Description</label>
          <input
            id="entity-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Enough context to prevent selecting the wrong account"
          />
        </div>

        <div className="mapping-editor">
          <div className="section-heading-row">
            <div>
              <h3>Platform identities</h3>
              <p>Add what you know now. Missing profiles can be mapped later.</p>
            </div>
          </div>
          {allPlatforms.map((platform) => (
            <label className="mapping-input-row" key={platform}>
              <PlatformMark platform={platform} size="sm" />
              <span>{platformMeta[platform].label}</span>
              <input
                value={handles[platform] ?? ''}
                onChange={(event) =>
                  setHandles((current) => ({
                    ...current,
                    [platform]: event.target.value,
                  }))
                }
                placeholder={`@${displayName.toLowerCase().replace(/\s+/g, '') || 'handle'}`}
              />
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={submit} disabled={!displayName.trim()}>
            <Check size={17} />
            Save mention
          </button>
        </div>
      </section>
    </div>
  );
}

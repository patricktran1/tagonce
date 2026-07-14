import { Check, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { allPlatforms, platformMeta } from '../data/demo';
import type { MentionEntity, Platform, PlatformMapping } from '../types';
import { PlatformMark } from './PlatformMark';

interface MappingEditorModalProps {
  entity: MentionEntity;
  initialPlatform?: Platform;
  onClose: () => void;
  onSave: (entity: MentionEntity) => void;
}

type MappingDraft = {
  handle: string;
  platformId: string;
  profileUrl: string;
  verified: boolean;
  nativeTagSupported: boolean;
};

function createDraft(entity: MentionEntity): Record<Platform, MappingDraft> {
  return Object.fromEntries(allPlatforms.map((platform) => {
    const mapping = entity.mappings[platform];
    return [platform, {
      handle: mapping?.handle ?? '',
      platformId: mapping?.platformId ?? '',
      profileUrl: mapping?.profileUrl ?? '',
      verified: mapping?.verified ?? false,
      nativeTagSupported: mapping?.nativeTagSupported ?? true,
    }];
  })) as Record<Platform, MappingDraft>;
}

export function MappingEditorModal({ entity, initialPlatform, onClose, onSave }: MappingEditorModalProps) {
  const [draft, setDraft] = useState(() => createDraft(entity));
  const [activePlatform, setActivePlatform] = useState<Platform>(initialPlatform ?? 'linkedin');
  const active = draft[activePlatform];
  const mappedCount = useMemo(() => allPlatforms.filter((platform) => draft[platform].handle.trim()).length, [draft]);

  function update(patch: Partial<MappingDraft>) {
    setDraft((current) => ({ ...current, [activePlatform]: { ...current[activePlatform], ...patch } }));
  }

  function save() {
    const mappings: MentionEntity['mappings'] = {};
    allPlatforms.forEach((platform) => {
      const value = draft[platform];
      const handle = value.handle.trim();
      if (!handle) return;
      const mapping: PlatformMapping = {
        platform,
        displayName: entity.displayName,
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        platformId: value.platformId.trim() || undefined,
        profileUrl: value.profileUrl.trim() || undefined,
        nativeTagSupported: value.nativeTagSupported,
        verified: value.verified,
      };
      mappings[platform] = mapping;
    });
    onSave({ ...entity, mappings });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card mapping-modal" role="dialog" aria-modal="true" aria-labelledby="mapping-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="eyebrow">Cross-platform identity</span><h2 id="mapping-editor-title">Edit {entity.displayName}</h2><p>{mappedCount}/{allPlatforms.length} platforms mapped</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <div className="mapping-workspace">
          <nav className="mapping-platform-nav" aria-label="Platform mappings">
            {allPlatforms.map((platform) => {
              const mapping = draft[platform];
              return <button key={platform} className={activePlatform === platform ? 'active' : ''} onClick={() => setActivePlatform(platform)}><PlatformMark platform={platform} size="sm" /><span><strong>{platformMeta[platform].label}</strong><small>{mapping.handle || 'Not mapped'}</small></span>{mapping.verified && <ShieldCheck size={15} />}</button>;
            })}
          </nav>
          <div className="mapping-detail-editor">
            <div className="mapping-detail-heading"><PlatformMark platform={activePlatform} /><div><h3>{platformMeta[activePlatform].label}</h3><p>Save the exact account identity used on this platform.</p></div></div>
            <label className="field"><span>Handle or username</span><input value={active.handle} onChange={(event) => update({ handle: event.target.value })} placeholder={`@${entity.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '')}`} /></label>
            <label className="field"><span>Platform entity ID or URN</span><input value={active.platformId} onChange={(event) => update({ platformId: event.target.value })} placeholder="Optional until the official API resolves it" /></label>
            <label className="field"><span>Profile URL</span><div className="url-input-row"><input value={active.profileUrl} onChange={(event) => update({ profileUrl: event.target.value })} placeholder="https://..." />{active.profileUrl && <a className="icon-button" href={active.profileUrl} target="_blank" rel="noreferrer" aria-label="Open profile"><ExternalLink size={16} /></a>}</div></label>
            <label className="toggle-row"><span><strong>Native tagging supported</strong><small>Use a clickable platform-native mention when the publishing API permits it.</small></span><input type="checkbox" checked={active.nativeTagSupported} onChange={(event) => update({ nativeTagSupported: event.target.checked })} /></label>
            <label className="toggle-row"><span><strong>Mapping verified</strong><small>Confirm that this is the correct person, company or brand account.</small></span><input type="checkbox" checked={active.verified} onChange={(event) => update({ verified: event.target.checked })} /></label>
            {active.handle && !active.verified && <div className="mapping-warning"><ShieldCheck size={17} /><span>Unverified accounts remain visible in preflight before publishing.</span></div>}
          </div>
        </div>
        <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Check size={17} /> Save mappings</button></div>
      </section>
    </div>
  );
}

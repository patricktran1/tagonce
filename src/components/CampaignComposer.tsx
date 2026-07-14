import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Play,
  Plus,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { allPlatforms, platformMeta } from '../data/demo';
import { generateCampaignVariants } from '../lib/generationService';
import { getAdapter } from '../lib/platformAdapters';
import type {
  BrandSettings,
  Campaign,
  GenerationSource,
  MentionEntity,
  Platform,
  PlatformVariant,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface CampaignComposerProps {
  entities: MentionEntity[];
  brand: BrandSettings;
  onSaveCampaign: (campaign: Campaign) => void;
  onOpenMentions: () => void;
}

const starterText =
  'We built a faster way to publish one idea across every social platform without rebuilding the post or retagging the same people each time.';

function shortTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean || 'Untitled campaign';
}

export function CampaignComposer({
  entities,
  brand,
  onSaveCampaign,
  onOpenMentions,
}: CampaignComposerProps) {
  const [masterText, setMasterText] = useState(starterText);
  const [platforms, setPlatforms] = useState<Platform[]>([
    'facebook',
    'linkedin',
    'instagram',
    'x',
  ]);
  const [entityIds, setEntityIds] = useState<string[]>(['aion-ehr']);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [variants, setVariants] = useState<PlatformVariant[]>([]);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSource, setGenerationSource] = useState<GenerationSource | null>(null);
  const [notice, setNotice] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [publishState, setPublishState] = useState<
    Partial<Record<Platform, 'waiting' | 'publishing' | 'published' | 'failed'>>
  >({});

  const selectedEntities = useMemo(
    () => entities.filter((entity) => entityIds.includes(entity.id)),
    [entities, entityIds],
  );
  const mentionMatches = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    return entities
      .filter((entity) => !entityIds.includes(entity.id))
      .filter((entity) => !query || entity.displayName.toLowerCase().includes(query))
      .slice(0, 6);
  }, [entities, entityIds, mentionQuery]);
  const activeVariant = variants.find((variant) => variant.platform === activePlatform);
  const unresolved = variants.reduce(
    (total, variant) =>
      total + variant.mentionResolutions.filter((item) => item.status !== 'resolved').length,
    0,
  );

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function generate() {
    if (!masterText.trim() || platforms.length === 0) return;
    setIsGenerating(true);
    setNotice('');
    const result = await generateCampaignVariants(platforms, masterText, selectedEntities, brand);
    setVariants(result.variants);
    setGenerationSource(result.source);
    setNotice(result.notice ?? '');
    if (!platforms.includes(activePlatform)) setActivePlatform(platforms[0]);
    setIsGenerating(false);
  }

  function buildCampaign(status: Campaign['status']): Campaign {
    return {
      id: `campaign_${Date.now()}`,
      title: shortTitle(masterText),
      masterText,
      selectedEntityIds: entityIds,
      selectedPlatforms: platforms,
      variants,
      status,
      createdAt: new Date().toISOString(),
      scheduledFor: scheduledFor || undefined,
    };
  }

  function save(status: Campaign['status']) {
    onSaveCampaign(buildCampaign(status));
    setNotice(
      status === 'scheduled' && scheduledFor
        ? `Scheduled for ${new Date(scheduledFor).toLocaleString()}.`
        : 'Campaign saved.',
    );
  }

  async function publish() {
    if (variants.length === 0) return;
    setPublishState(
      Object.fromEntries(variants.map((variant) => [variant.platform, 'waiting'])),
    );
    let failed = false;
    for (const variant of variants) {
      setPublishState((current) => ({ ...current, [variant.platform]: 'publishing' }));
      const adapter = getAdapter(variant.platform);
      if (adapter.validate(variant).length) {
        failed = true;
        setPublishState((current) => ({ ...current, [variant.platform]: 'failed' }));
        continue;
      }
      const result = await adapter.publish(variant);
      failed ||= result.status === 'failed';
      setPublishState((current) => ({ ...current, [variant.platform]: result.status }));
    }
    save(failed ? 'partial' : 'published');
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="hero-kicker">Tag once. Format once. Publish everywhere.</span>
          <h2>One post in. Platform-native content out.</h2>
          <p>
            Write the idea once, select every person or company once, then generate the right
            copy and identity mapping for every channel.
          </p>
        </div>
        <div className="hero-metric">
          <span>Repetitive tagging removed</span>
          <strong>100%</strong>
          <small>after each identity is mapped</small>
        </div>
      </section>

      <div className="compose-layout">
        <section className="panel composer-panel">
          <div className="panel-heading">
            <div>
              <span className="step-badge">01</span>
              <div><h3>Create the master post</h3><p>Start with the idea. TagOnce handles the channel work.</p></div>
            </div>
            <span className="autosave-label"><Check size={14} /> Browser autosave</span>
          </div>

          <label className="master-editor">
            <span>What do you want to say?</span>
            <textarea value={masterText} onChange={(event) => setMasterText(event.target.value)} />
            <small>{masterText.length} characters</small>
          </label>

          <div className="mention-builder">
            <div className="field-heading">
              <div><label htmlFor="mention-search">Tag people and companies once</label><small>Each chip resolves to the correct account per platform.</small></div>
              <button className="text-button" onClick={onOpenMentions}>Manage directory <ArrowRight size={14} /></button>
            </div>
            <div className="mention-input-shell">
              {selectedEntities.map((entity) => (
                <span className="mention-chip" key={entity.id}>
                  <span className="tiny-avatar">{entity.initials}</span>{entity.displayName}
                  <button onClick={() => setEntityIds((current) => current.filter((id) => id !== entity.id))} aria-label={`Remove ${entity.displayName}`}><X size={13} /></button>
                </span>
              ))}
              <input
                id="mention-search"
                value={mentionQuery}
                placeholder="Add another…"
                onFocus={() => setShowMentions(true)}
                onChange={(event) => { setMentionQuery(event.target.value); setShowMentions(true); }}
              />
              {showMentions && (
                <div className="mention-menu">
                  {mentionMatches.map((entity) => (
                    <button key={entity.id} onClick={() => { setEntityIds((current) => [...current, entity.id]); setMentionQuery(''); setShowMentions(false); }}>
                      <span className="entity-avatar small-avatar">{entity.initials}</span>
                      <span><strong>{entity.displayName}</strong><small>{entity.description}</small></span><Plus size={16} />
                    </button>
                  ))}
                  {mentionMatches.length === 0 && <button onClick={onOpenMentions}><Plus size={16} /> Add a new mention</button>}
                </div>
              )}
            </div>
          </div>

          <div className="platform-selector-block">
            <div className="field-heading">
              <div><label>Publish to</label><small>Select the destination channels.</small></div>
              <button className="text-button" onClick={() => setPlatforms(allPlatforms)}>Select all</button>
            </div>
            <div className="platform-selector-grid">
              {allPlatforms.map((platform) => (
                <button key={platform} className={clsx('platform-select-card', platforms.includes(platform) && 'selected')} onClick={() => togglePlatform(platform)}>
                  <PlatformMark platform={platform} />
                  <span><strong>{platformMeta[platform].label}</strong><small>{platformMeta[platform].description}</small></span>
                  <span className="selection-check">{platforms.includes(platform) && <Check size={14} />}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="composer-actions">
            <button className="button secondary" onClick={() => save(variants.length ? 'ready' : 'draft')}>Save draft</button>
            <button className="button primary large-button" disabled={isGenerating || !masterText.trim() || !platforms.length} onClick={generate}>
              {isGenerating ? <Loader2 className="spin" size={18} /> : <WandSparkles size={18} />}
              {isGenerating ? 'Building posts…' : 'Generate with AI'}
            </button>
          </div>
        </section>

        <aside className="panel readiness-panel">
          <div className="panel-heading simple-heading"><div><span className="step-badge">02</span><div><h3>Mention readiness</h3><p>Missing mappings surface before publishing.</p></div></div></div>
          <div className="readiness-list">
            {selectedEntities.map((entity) => {
              const mapped = platforms.filter((platform) => entity.mappings[platform]).length;
              return (
                <div className="readiness-entity" key={entity.id}>
                  <div className="readiness-entity-header">
                    <span className="entity-avatar">{entity.initials}</span>
                    <span><strong>{entity.displayName}</strong><small>{mapped}/{platforms.length} channels mapped</small></span>
                    {mapped === platforms.length ? <CheckCircle2 className="success-icon" size={19} /> : <span className="warning-count">{platforms.length - mapped} missing</span>}
                  </div>
                  <div className="mini-platform-row">{platforms.map((platform) => <span key={platform} className={entity.mappings[platform] ? 'mapped' : 'missing'}>{platformMeta[platform].short}</span>)}</div>
                </div>
              );
            })}
          </div>
          <div className="security-note"><CheckCircle2 size={17} /><span><strong>No silent fallbacks.</strong> Every unresolved native tag remains visible.</span></div>
        </aside>
      </div>

      {(isGenerating || variants.length > 0) && (
        <section className="panel output-panel">
          <div className="panel-heading output-heading">
            <div><span className="step-badge">03</span><div><h3>Review platform-native versions</h3><p>Edit any channel independently.</p></div></div>
            {variants.length > 0 && <div className="output-heading-actions">
              {generationSource && <div className={`generation-source ${generationSource}`}><Sparkles size={14} />{generationSource === 'ai' ? 'AI generated' : 'Built-in engine'}</div>}
              <div className={unresolved ? 'preflight-pill warning' : 'preflight-pill success'}>{unresolved ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}{unresolved ? `${unresolved} mention checks` : 'All mentions resolved'}</div>
            </div>}
          </div>

          {notice && !isGenerating && <div className={generationSource === 'rules' ? 'generation-notice warning' : 'generation-notice success'}>{generationSource === 'rules' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{notice}</span></div>}

          {isGenerating ? <div className="generation-state"><span className="generation-orbit"><Sparkles size={24} /></span><div><strong>Building native versions</strong><span>Applying brand voice, mention mappings and channel constraints.</span></div></div> : <>
            <div className="platform-tabs">{variants.map((variant) => <button key={variant.platform} className={activePlatform === variant.platform ? 'active' : ''} onClick={() => setActivePlatform(variant.platform)}><PlatformMark platform={variant.platform} size="sm" />{platformMeta[variant.platform].label}</button>)}</div>
            {activeVariant && <div className="variant-review-grid">
              <div className="native-preview-card">
                <div className="native-preview-header"><span className="user-avatar small-user">PT</span><span><strong>{brand.brandName}</strong><small>Draft · {platformMeta[activeVariant.platform].label}</small></span><PlatformMark platform={activeVariant.platform} size="sm" /></div>
                <div className="generated-visual-placeholder"><span className="visual-logo">T1</span><span>{shortTitle(masterText)}</span><small>Static visual placeholder</small></div>
                <div className="native-preview-body">{activeVariant.title && <strong>{activeVariant.title}</strong>}<p>{activeVariant.body}</p></div>
              </div>
              <div className="variant-editor-card">
                <div className="variant-editor-heading"><div><span className="eyebrow">{activeVariant.format}</span><h4>{platformMeta[activeVariant.platform].label} content</h4></div><button className="icon-button" onClick={() => navigator.clipboard?.writeText(activeVariant.body)} aria-label="Copy post"><Copy size={17} /></button></div>
                {activeVariant.title !== undefined && <label className="field"><span>Title</span><input value={activeVariant.title} onChange={(event) => setVariants((current) => current.map((variant) => variant.platform === activeVariant.platform ? { ...variant, title: event.target.value } : variant))} /></label>}
                <label className="field"><span>Post</span><textarea className="variant-textarea" value={activeVariant.body} onChange={(event) => setVariants((current) => current.map((variant) => variant.platform === activeVariant.platform ? { ...variant, body: event.target.value, characterCount: event.target.value.length } : variant))} /></label>
                <div className="character-row"><span>{activeVariant.characterCount} characters</span>{activeVariant.limit && <span>Limit: {activeVariant.limit}</span>}</div>
                <div className="mention-preflight-list"><span className="subsection-label">Mention preflight</span>{activeVariant.mentionResolutions.map((resolution) => <div className="preflight-row" key={resolution.entityId}><span className={`resolution-dot status-${resolution.status}`} /><span><strong>{resolution.entityName}</strong><small>{resolution.detail}</small></span><code>{resolution.renderedText}</code></div>)}</div>
              </div>
            </div>}

            <div className="publish-bar">
              <div className="publish-summary"><span className="publish-icon-stack"><Send size={18} /></span><span><strong>{variants.length} platform posts ready</strong><small>Scheduling works now. Live publishing activates as OAuth adapters are connected.</small></span></div>
              <div className="publish-actions expanded-actions">
                <label className="schedule-field"><CalendarClock size={16} /><input type="datetime-local" value={scheduledFor} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledFor(event.target.value)} /></label>
                <button className="button secondary" disabled={!scheduledFor} onClick={() => save('scheduled')}>Schedule</button>
                <button className="button secondary" onClick={() => save('ready')}>Save</button>
                <button className="button primary" onClick={publish}><Play size={17} />Publish everywhere</button>
              </div>
            </div>
            {Object.keys(publishState).length > 0 && <div className="publish-progress-grid">{variants.map((variant) => { const state = publishState[variant.platform] ?? 'waiting'; return <div className={`publish-status-card status-${state}`} key={variant.platform}><PlatformMark platform={variant.platform} size="sm" /><span><strong>{platformMeta[variant.platform].label}</strong><small>{state}</small></span>{state === 'publishing' && <Loader2 className="spin" size={16} />}{state === 'published' && <CheckCircle2 size={16} />}{state === 'failed' && <AlertTriangle size={16} />}</div>; })}</div>}
          </>}
        </section>
      )}
    </div>
  );
}

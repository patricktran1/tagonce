import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ImagePlus,
  Loader2,
  Play,
  Plus,
  Send,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { allPlatforms, platformMeta } from '../data/demo';
import { generateAllVariants } from '../lib/contentEngine';
import { getAdapter } from '../lib/platformAdapters';
import type {
  BrandSettings,
  Campaign,
  MentionEntity,
  Platform,
  PlatformVariant,
} from '../types';
import { PlatformMark } from './PlatformMark';

interface ComposePageProps {
  entities: MentionEntity[];
  brand: BrandSettings;
  onSaveCampaign: (campaign: Campaign) => void;
  onOpenMentions: () => void;
}

const starterText =
  'We built a faster way to publish one idea across every social platform without rebuilding the post or retagging the same people each time.';

function shortTitle(text: string) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}…` : cleaned || 'Untitled campaign';
}

export function ComposePage({
  entities,
  brand,
  onSaveCampaign,
  onOpenMentions,
}: ComposePageProps) {
  const [masterText, setMasterText] = useState(starterText);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    'facebook',
    'linkedin',
    'instagram',
    'x',
  ]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(['aion-ehr']);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [variants, setVariants] = useState<PlatformVariant[]>([]);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');
  const [isGenerating, setIsGenerating] = useState(false);
  const [publishState, setPublishState] = useState<
    Partial<Record<Platform, 'waiting' | 'publishing' | 'published' | 'failed'>>
  >({});
  const [mediaName, setMediaName] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEntities = useMemo(
    () => entities.filter((entity) => selectedEntityIds.includes(entity.id)),
    [entities, selectedEntityIds],
  );

  const matchingEntities = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    return entities
      .filter((entity) => !selectedEntityIds.includes(entity.id))
      .filter((entity) => !q || entity.displayName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [entities, mentionQuery, selectedEntityIds]);

  const activeVariant = variants.find((variant) => variant.platform === activePlatform);

  const unresolvedCount = variants.reduce(
    (total, variant) =>
      total +
      variant.mentionResolutions.filter((resolution) => resolution.status !== 'resolved').length,
    0,
  );

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((current) => {
      if (current.includes(platform)) {
        return current.filter((item) => item !== platform);
      }
      return [...current, platform];
    });
  }

  async function generate() {
    if (!masterText.trim() || selectedPlatforms.length === 0) return;
    setIsGenerating(true);
    setVariants([]);
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    const next = generateAllVariants(
      selectedPlatforms,
      masterText,
      selectedEntities,
      brand,
    );
    setVariants(next);
    if (!selectedPlatforms.includes(activePlatform)) {
      setActivePlatform(selectedPlatforms[0]);
    }
    setIsGenerating(false);
  }

  function updateVariantBody(platform: Platform, body: string) {
    setVariants((current) =>
      current.map((variant) =>
        variant.platform === platform
          ? { ...variant, body, characterCount: body.length }
          : variant,
      ),
    );
  }

  function buildCampaign(status: Campaign['status']): Campaign {
    return {
      id: `campaign_${Date.now()}`,
      title: shortTitle(masterText),
      masterText,
      selectedEntityIds,
      selectedPlatforms,
      variants,
      status,
      createdAt: new Date().toISOString(),
      mediaName: mediaName || undefined,
    };
  }

  function saveDraft() {
    onSaveCampaign(buildCampaign(variants.length > 0 ? 'ready' : 'draft'));
  }

  async function publish() {
    if (variants.length === 0) return;
    const initial = Object.fromEntries(
      variants.map((variant) => [variant.platform, 'waiting']),
    ) as Partial<Record<Platform, 'waiting' | 'publishing' | 'published' | 'failed'>>;
    setPublishState(initial);

    let failed = false;
    for (const variant of variants) {
      setPublishState((current) => ({
        ...current,
        [variant.platform]: 'publishing',
      }));
      const adapter = getAdapter(variant.platform);
      const errors = adapter.validate(variant);
      if (errors.length > 0) {
        failed = true;
        setPublishState((current) => ({
          ...current,
          [variant.platform]: 'failed',
        }));
        continue;
      }
      const result = await adapter.publish(variant);
      if (result.status === 'failed') failed = true;
      setPublishState((current) => ({
        ...current,
        [variant.platform]: result.status,
      }));
    }
    onSaveCampaign(buildCampaign(failed ? 'partial' : 'published'));
  }

  function handleMedia(file?: File) {
    if (!file) return;
    setMediaName(file.name);
    setMediaUrl(URL.createObjectURL(file));
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="hero-kicker">Tag once. Format once. Publish everywhere.</span>
          <h2>One post in. Platform-native content out.</h2>
          <p>
            Write the idea once, select every person or company once, then let TagOnce map
            the correct identity and formatting for each network.
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
              <div>
                <h3>Create the master post</h3>
                <p>Start messy. Each platform version is generated later.</p>
              </div>
            </div>
            <span className="autosave-label">
              <Check size={14} /> Local autosave
            </span>
          </div>

          <label className="master-editor">
            <span>What do you want to say?</span>
            <textarea
              value={masterText}
              onChange={(event) => setMasterText(event.target.value)}
              placeholder="Write the core idea, announcement or story..."
            />
            <small>{masterText.length} characters</small>
          </label>

          <div className="mention-builder">
            <div className="field-heading">
              <div>
                <label htmlFor="mention-search">Tag people and companies once</label>
                <small>TagOnce resolves each platform identity at publish time.</small>
              </div>
              <button className="text-button" onClick={onOpenMentions}>
                Manage directory <ArrowRight size={14} />
              </button>
            </div>

            <div className="mention-input-shell">
              {selectedEntities.map((entity) => (
                <span className="mention-chip" key={entity.id}>
                  <span className="tiny-avatar">{entity.initials}</span>
                  {entity.displayName}
                  <button
                    aria-label={`Remove ${entity.displayName}`}
                    onClick={() =>
                      setSelectedEntityIds((current) =>
                        current.filter((id) => id !== entity.id),
                      )
                    }
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <input
                id="mention-search"
                value={mentionQuery}
                onFocus={() => setShowMentionMenu(true)}
                onChange={(event) => {
                  setMentionQuery(event.target.value);
                  setShowMentionMenu(true);
                }}
                placeholder={selectedEntities.length ? 'Add another…' : 'Search saved mentions…'}
              />
              <ChevronDown size={16} />
              {showMentionMenu && (
                <div className="mention-menu">
                  {matchingEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => {
                        setSelectedEntityIds((current) => [...current, entity.id]);
                        setMentionQuery('');
                        setShowMentionMenu(false);
                      }}
                    >
                      <span className="entity-avatar small-avatar">{entity.initials}</span>
                      <span>
                        <strong>{entity.displayName}</strong>
                        <small>{entity.description}</small>
                      </span>
                      <Plus size={16} />
                    </button>
                  ))}
                  {matchingEntities.length === 0 && (
                    <button onClick={onOpenMentions}>
                      <span className="entity-avatar small-avatar">+</span>
                      <span>
                        <strong>Add a new mention</strong>
                        <small>Map this identity across platforms</small>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="media-builder">
            <div className="field-heading">
              <div>
                <label>Media</label>
                <small>Optional image for the campaign preview.</small>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={(event) => handleMedia(event.target.files?.[0])}
            />
            {mediaUrl ? (
              <div className="media-preview-row">
                <img src={mediaUrl} alt="Campaign upload preview" />
                <div>
                  <strong>{mediaName}</strong>
                  <small>Ready for platform resizing</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMediaName('');
                    setMediaUrl('');
                  }}
                >
                  <X size={17} />
                </button>
              </div>
            ) : (
              <button className="media-dropzone" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-glyph">
                  <UploadCloud size={21} />
                </span>
                <span>
                  <strong>Upload an image</strong>
                  <small>PNG, JPG or WEBP</small>
                </span>
                <ImagePlus size={18} />
              </button>
            )}
          </div>

          <div className="platform-selector-block">
            <div className="field-heading">
              <div>
                <label>Publish to</label>
                <small>Select the channels for this campaign.</small>
              </div>
              <button
                className="text-button"
                onClick={() => setSelectedPlatforms(allPlatforms)}
              >
                Select all
              </button>
            </div>
            <div className="platform-selector-grid">
              {allPlatforms.map((platform) => (
                <button
                  key={platform}
                  className={clsx(
                    'platform-select-card',
                    selectedPlatforms.includes(platform) && 'selected',
                  )}
                  onClick={() => togglePlatform(platform)}
                >
                  <PlatformMark platform={platform} />
                  <span>
                    <strong>{platformMeta[platform].label}</strong>
                    <small>{platformMeta[platform].description}</small>
                  </span>
                  <span className="selection-check">
                    {selectedPlatforms.includes(platform) && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="composer-actions">
            <button className="button secondary" onClick={saveDraft}>
              Save draft
            </button>
            <button
              className="button primary large-button"
              onClick={generate}
              disabled={!masterText.trim() || selectedPlatforms.length === 0 || isGenerating}
            >
              {isGenerating ? <Loader2 className="spin" size={18} /> : <WandSparkles size={18} />}
              {isGenerating ? 'Building platform posts…' : 'Generate platform posts'}
            </button>
          </div>
        </section>

        <aside className="panel readiness-panel">
          <div className="panel-heading simple-heading">
            <div>
              <span className="step-badge">02</span>
              <div>
                <h3>Mention readiness</h3>
                <p>See missing mappings before they become manual work.</p>
              </div>
            </div>
          </div>
          {selectedEntities.length === 0 ? (
            <div className="empty-state slim-empty">
              <span className="empty-glyph">@</span>
              <strong>No mentions selected</strong>
              <span>Add collaborators, companies or brands to this campaign.</span>
            </div>
          ) : (
            <div className="readiness-list">
              {selectedEntities.map((entity) => {
                const mapped = selectedPlatforms.filter((platform) => entity.mappings[platform]);
                const missing = selectedPlatforms.length - mapped.length;
                return (
                  <div className="readiness-entity" key={entity.id}>
                    <div className="readiness-entity-header">
                      <span className="entity-avatar">{entity.initials}</span>
                      <span>
                        <strong>{entity.displayName}</strong>
                        <small>
                          {mapped.length}/{selectedPlatforms.length} channels mapped
                        </small>
                      </span>
                      {missing === 0 ? (
                        <CheckCircle2 className="success-icon" size={19} />
                      ) : (
                        <span className="warning-count">{missing} missing</span>
                      )}
                    </div>
                    <div className="mini-platform-row">
                      {selectedPlatforms.map((platform) => (
                        <span
                          key={platform}
                          title={`${platformMeta[platform].label}: ${
                            entity.mappings[platform] ? 'mapped' : 'missing'
                          }`}
                          className={entity.mappings[platform] ? 'mapped' : 'missing'}
                        >
                          {platformMeta[platform].short}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="security-note">
            <CheckCircle2 size={17} />
            <span>
              <strong>No silent fallbacks.</strong>
              TagOnce exposes every account that cannot become a native clickable mention.
            </span>
          </div>
        </aside>
      </div>

      {(isGenerating || variants.length > 0) && (
        <section className="panel output-panel">
          <div className="panel-heading output-heading">
            <div>
              <span className="step-badge">03</span>
              <div>
                <h3>Review platform-native versions</h3>
                <p>Edit any post independently before publishing.</p>
              </div>
            </div>
            {variants.length > 0 && (
              <div className={unresolvedCount ? 'preflight-pill warning' : 'preflight-pill success'}>
                {unresolvedCount ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {unresolvedCount
                  ? `${unresolvedCount} mention checks`
                  : 'All mentions resolved'}
              </div>
            )}
          </div>

          {isGenerating ? (
            <div className="generation-state">
              <span className="generation-orbit">
                <Sparkles size={24} />
              </span>
              <div>
                <strong>Building native versions</strong>
                <span>Applying format rules, identity mappings and hashtag logic.</span>
              </div>
            </div>
          ) : (
            <>
              <div className="platform-tabs">
                {variants.map((variant) => (
                  <button
                    key={variant.platform}
                    className={activePlatform === variant.platform ? 'active' : ''}
                    onClick={() => setActivePlatform(variant.platform)}
                  >
                    <PlatformMark platform={variant.platform} size="sm" />
                    {platformMeta[variant.platform].label}
                    {variant.mentionResolutions.some(
                      (resolution) => resolution.status !== 'resolved',
                    ) && <span className="tab-warning" />}
                  </button>
                ))}
              </div>

              {activeVariant && (
                <div className="variant-review-grid">
                  <div className="native-preview-card">
                    <div className="native-preview-header">
                      <span className="user-avatar small-user">PT</span>
                      <span>
                        <strong>{brand.brandName}</strong>
                        <small>Draft · {platformMeta[activeVariant.platform].label}</small>
                      </span>
                      <PlatformMark platform={activeVariant.platform} size="sm" />
                    </div>
                    {mediaUrl ? (
                      <img className="native-media-preview" src={mediaUrl} alt="Campaign preview" />
                    ) : (
                      <div className="generated-visual-placeholder">
                        <span className="visual-logo">T1</span>
                        <span>{shortTitle(masterText)}</span>
                        <small>Static visual placeholder</small>
                      </div>
                    )}
                    <div className="native-preview-body">
                      {activeVariant.title && <strong>{activeVariant.title}</strong>}
                      <p>{activeVariant.body}</p>
                    </div>
                  </div>

                  <div className="variant-editor-card">
                    <div className="variant-editor-heading">
                      <div>
                        <span className="eyebrow">{activeVariant.format}</span>
                        <h4>{platformMeta[activeVariant.platform].label} content</h4>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => navigator.clipboard?.writeText(activeVariant.body)}
                        aria-label="Copy post"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                    {activeVariant.title !== undefined && (
                      <label className="field">
                        <span>Title</span>
                        <input
                          value={activeVariant.title}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((variant) =>
                                variant.platform === activeVariant.platform
                                  ? { ...variant, title: event.target.value }
                                  : variant,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    <label className="field">
                      <span>Post</span>
                      <textarea
                        className="variant-textarea"
                        value={activeVariant.body}
                        onChange={(event) =>
                          updateVariantBody(activeVariant.platform, event.target.value)
                        }
                      />
                    </label>
                    <div className="character-row">
                      <span>{activeVariant.characterCount} characters</span>
                      {activeVariant.limit && <span>Limit: {activeVariant.limit}</span>}
                    </div>

                    <div className="mention-preflight-list">
                      <span className="subsection-label">Mention preflight</span>
                      {activeVariant.mentionResolutions.length === 0 ? (
                        <small>No tagged entities in this campaign.</small>
                      ) : (
                        activeVariant.mentionResolutions.map((resolution) => (
                          <div className="preflight-row" key={resolution.entityId}>
                            <span
                              className={clsx(
                                'resolution-dot',
                                `status-${resolution.status}`,
                              )}
                            />
                            <span>
                              <strong>{resolution.entityName}</strong>
                              <small>{resolution.detail}</small>
                            </span>
                            <code>{resolution.renderedText}</code>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="publish-bar">
                <div className="publish-summary">
                  <span className="publish-icon-stack">
                    <Send size={18} />
                  </span>
                  <span>
                    <strong>{variants.length} platform posts ready</strong>
                    <small>
                      MVP publishing is simulated until OAuth adapters are connected.
                    </small>
                  </span>
                </div>
                <div className="publish-actions">
                  <button className="button secondary" onClick={saveDraft}>
                    Save campaign
                  </button>
                  <button className="button primary" onClick={publish}>
                    <Play size={17} />
                    Publish everywhere
                  </button>
                </div>
              </div>

              {Object.keys(publishState).length > 0 && (
                <div className="publish-progress-grid">
                  {variants.map((variant) => {
                    const state = publishState[variant.platform] ?? 'waiting';
                    return (
                      <div className={`publish-status-card status-${state}`} key={variant.platform}>
                        <PlatformMark platform={variant.platform} size="sm" />
                        <span>
                          <strong>{platformMeta[variant.platform].label}</strong>
                          <small>{state}</small>
                        </span>
                        {state === 'publishing' && <Loader2 className="spin" size={16} />}
                        {state === 'published' && <CheckCircle2 size={16} />}
                        {state === 'failed' && <AlertTriangle size={16} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

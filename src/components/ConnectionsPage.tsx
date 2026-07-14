import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { platformMeta } from '../data/demo';
import type { BrandSettings, Platform, SocialConnection } from '../types';
import { PlatformMark } from './PlatformMark';

interface ConnectionsPageProps {
  brand: BrandSettings;
  connections: SocialConnection[];
  onChange: (connections: SocialConnection[]) => void;
}

const primaryPlatforms: Platform[] = ['linkedin', 'facebook', 'instagram'];

function profileSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '') || 'yourname';
}

export function ConnectionsPage({ brand, connections, onChange }: ConnectionsPageProps) {
  const [copied, setCopied] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState<Platform | null>(null);
  const slug = profileSlug(brand.brandName);
  const universalTag = `@${slug}`;
  const connectedCount = primaryPlatforms.filter(
    (platform) => connections.find((item) => item.platform === platform)?.connected,
  ).length;

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.platform, connection])),
    [connections],
  );

  function updateConnection(platform: Platform, patch: Partial<SocialConnection>) {
    const existing = connectionMap.get(platform) ?? { platform, connected: false };
    const next = connections.filter((item) => item.platform !== platform);
    onChange([...next, { ...existing, ...patch }]);
  }

  function saveIdentity(platform: Platform) {
    const current = connectionMap.get(platform);
    if (!current) return;
    const connected = Boolean(current.handle?.trim() || current.profileUrl?.trim());
    updateConnection(platform, {
      connected,
      connectionMethod: 'manual',
      lastCheckedAt: new Date().toISOString(),
    });
    setSavedPlatform(platform);
    window.setTimeout(() => setSavedPlatform(null), 1600);
  }

  async function copyUniversalTag() {
    await navigator.clipboard.writeText(universalTag);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function startLinking() {
    document.getElementById('connection-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="page-stack connections-page">
      <section className="identity-hero">
        <div className="identity-hero-copy">
          <span className="hero-kicker">Universal social identity</span>
          <h2>One identity. Every account. The right tag every time.</h2>
          <p>
            Link your social profiles once, then let TagOnce resolve the correct LinkedIn,
            Facebook and Instagram identity whenever you publish or tag a collaborator.
          </p>
          <div className="identity-hero-actions">
            <button className="button primary" onClick={startLinking}>
              <Link2 size={17} /> Link my socials
            </button>
            <span className="connection-progress">
              <CheckCircle2 size={16} /> {connectedCount}/{primaryPlatforms.length} connected
            </span>
          </div>
        </div>

        <aside className="universal-card">
          <div className="universal-card-topline">
            <span className="universal-glyph"><Network size={20} /></span>
            <span className={connectedCount === primaryPlatforms.length ? 'status-pill success' : 'status-pill'}>
              {connectedCount === primaryPlatforms.length ? 'Ready everywhere' : 'Setup in progress'}
            </span>
          </div>
          <span className="eyebrow">Your TagOnce identity</span>
          <h3>{brand.brandName || 'Your identity'}</h3>
          <button className="universal-tag" onClick={copyUniversalTag}>
            <span>{universalTag}</span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <div className="universal-platform-row">
            {primaryPlatforms.map((platform) => {
              const connection = connectionMap.get(platform);
              return (
                <span className={connection?.connected ? 'linked' : ''} key={platform}>
                  <PlatformMark platform={platform} size="sm" />
                  {connection?.handle || 'Not linked'}
                </span>
              );
            })}
          </div>
          <small>
            This becomes the canonical identity TagOnce uses to map your separate platform accounts.
          </small>
        </aside>
      </section>

      <section className="identity-principles">
        <div><strong>1</strong><span><b>Connect yourself</b><small>Save the accounts you publish from.</small></span></div>
        <ArrowRight size={17} />
        <div><strong>2</strong><span><b>Map collaborators</b><small>One person can have different handles everywhere.</small></span></div>
        <ArrowRight size={17} />
        <div><strong>3</strong><span><b>Tag once</b><small>TagOnce chooses the correct platform identity.</small></span></div>
      </section>

      <section className="panel connection-panel" id="connection-grid">
        <div className="panel-heading">
          <div>
            <span className="step-badge">LINK</span>
            <div>
              <h3>Connect publishing identities</h3>
              <p>Add your profile URLs now. Secure OAuth publishing can replace manual links as each platform app is approved.</p>
            </div>
          </div>
          <span className="privacy-note"><ShieldCheck size={16} /> Credentials never belong in GitHub</span>
        </div>

        <div className="social-connection-grid">
          {primaryPlatforms.map((platform) => {
            const connection = connectionMap.get(platform) ?? { platform, connected: false };
            const meta = platformMeta[platform];
            return (
              <article className={connection.connected ? 'social-connection-card connected' : 'social-connection-card'} key={platform}>
                <div className="social-card-heading">
                  <PlatformMark platform={platform} />
                  <div><h4>{meta.label}</h4><p>{connection.accountType || 'Personal profile or managed brand account'}</p></div>
                  <span className={connection.connected ? 'connection-state connected' : 'connection-state'}>
                    {connection.connected ? 'Linked' : 'Not linked'}
                  </span>
                </div>

                <label className="field compact-field">
                  <span>Handle</span>
                  <input
                    value={connection.handle ?? ''}
                    onChange={(event) => updateConnection(platform, { handle: event.target.value })}
                    placeholder={platform === 'linkedin' ? 'Display name or vanity name' : '@username'}
                  />
                </label>
                <label className="field compact-field">
                  <span>Profile URL</span>
                  <input
                    value={connection.profileUrl ?? ''}
                    onChange={(event) => updateConnection(platform, { profileUrl: event.target.value })}
                    placeholder={`https://${platform}.com/...`}
                  />
                </label>

                <div className="social-card-actions">
                  <button className="button primary small-button" onClick={() => saveIdentity(platform)}>
                    {savedPlatform === platform ? <Check size={15} /> : <Link2 size={15} />}
                    {savedPlatform === platform ? 'Saved' : 'Save identity'}
                  </button>
                  {connection.profileUrl && (
                    <a className="button secondary small-button" href={connection.profileUrl} target="_blank" rel="noreferrer">
                      Open <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                <div className="oauth-roadmap">
                  <span>Next layer</span>
                  <p>OAuth connection, account verification and direct publishing after platform approval.</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel identity-moat-panel">
        <div><span className="eyebrow">The product wedge</span><h3>TagOnce becomes the identity layer between people and social platforms.</h3></div>
        <p>
          AI copy generation is useful. The durable asset is the verified map connecting one real person or brand to every platform-specific account, ID and tagging format.
        </p>
      </section>
    </div>
  );
}

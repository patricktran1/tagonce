import { Save, Sparkles } from 'lucide-react';
import type { BrandSettings } from '../types';

interface SettingsPageProps {
  brand: BrandSettings;
  onChange: (brand: BrandSettings) => void;
}

export function SettingsPage({ brand, onChange }: SettingsPageProps) {
  function update<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    onChange({ ...brand, [key]: value });
  }

  return (
    <div className="page-stack settings-grid">
      <section className="panel settings-form-panel">
        <div className="panel-heading">
          <div>
            <span className="step-badge">AI</span>
            <div>
              <h3>Brand context</h3>
              <p>These defaults shape every generated platform version.</p>
            </div>
          </div>
        </div>

        <div className="settings-fields">
          <label className="field">
            <span>Brand name</span>
            <input
              value={brand.brandName}
              onChange={(event) => update('brandName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Audience</span>
            <input
              value={brand.audience}
              onChange={(event) => update('audience', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Voice</span>
            <textarea
              value={brand.voice}
              onChange={(event) => update('voice', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Default CTA</span>
            <input
              value={brand.defaultCta}
              onChange={(event) => update('defaultCta', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Preferred hashtags</span>
            <input
              value={brand.preferredHashtags}
              onChange={(event) => update('preferredHashtags', event.target.value)}
              placeholder="AI, CreatorTools, SocialMedia"
            />
          </label>
        </div>

        <div className="settings-save-row">
          <span>Changes are saved automatically in this browser.</span>
          <button className="button primary">
            <Save size={17} />
            Saved
          </button>
        </div>
      </section>

      <aside className="panel brand-preview-card">
        <span className="brand-preview-glyph">
          <Sparkles size={22} />
        </span>
        <span className="eyebrow">Generation profile</span>
        <h3>{brand.brandName || 'Your Brand'}</h3>
        <p>{brand.voice}</p>
        <dl>
          <div>
            <dt>Audience</dt>
            <dd>{brand.audience}</dd>
          </div>
          <div>
            <dt>CTA</dt>
            <dd>{brand.defaultCta}</dd>
          </div>
          <div>
            <dt>Hashtags</dt>
            <dd>{brand.preferredHashtags}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

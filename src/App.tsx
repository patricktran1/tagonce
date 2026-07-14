import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { CampaignsPage } from './components/CampaignsPage';
import { ComposePage } from './components/ComposePage';
import { Header } from './components/Header';
import { MentionDirectory } from './components/MentionDirectory';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar, type PageKey } from './components/Sidebar';
import {
  defaultBrandSettings,
  demoEntities,
} from './data/demo';
import { loadLocal, saveLocal } from './lib/storage';
import type { BrandSettings, Campaign, MentionEntity } from './types';

const ENTITY_KEY = 'tagonce.entities.v1';
const CAMPAIGN_KEY = 'tagonce.campaigns.v1';
const BRAND_KEY = 'tagonce.brand.v1';

const pageMeta: Record<PageKey, { title: string; eyebrow: string }> = {
  compose: { title: 'Create campaign', eyebrow: 'Content command center' },
  mentions: { title: 'Mention directory', eyebrow: 'Cross-platform identity graph' },
  campaigns: { title: 'Campaigns', eyebrow: 'Publishing history' },
  settings: { title: 'Brand settings', eyebrow: 'Generation defaults' },
};

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('compose');
  const [entities, setEntities] = useState<MentionEntity[]>(() =>
    loadLocal(ENTITY_KEY, demoEntities),
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(() =>
    loadLocal(CAMPAIGN_KEY, []),
  );
  const [brand, setBrand] = useState<BrandSettings>(() =>
    loadLocal(BRAND_KEY, defaultBrandSettings),
  );

  useEffect(() => saveLocal(ENTITY_KEY, entities), [entities]);
  useEffect(() => saveLocal(CAMPAIGN_KEY, campaigns), [campaigns]);
  useEffect(() => saveLocal(BRAND_KEY, brand), [brand]);

  const currentMeta = pageMeta[activePage];

  const page = useMemo(() => {
    switch (activePage) {
      case 'compose':
        return (
          <ComposePage
            entities={entities}
            brand={brand}
            onOpenMentions={() => setActivePage('mentions')}
            onSaveCampaign={(campaign) =>
              setCampaigns((current) => [campaign, ...current])
            }
          />
        );
      case 'mentions':
        return (
          <MentionDirectory
            entities={entities}
            onAdd={(entity) => setEntities((current) => [entity, ...current])}
            onDelete={(entityId) =>
              setEntities((current) => current.filter((entity) => entity.id !== entityId))
            }
          />
        );
      case 'campaigns':
        return (
          <CampaignsPage
            campaigns={campaigns}
            onDelete={(campaignId) =>
              setCampaigns((current) =>
                current.filter((campaign) => campaign.id !== campaignId),
              )
            }
          />
        );
      case 'settings':
        return <SettingsPage brand={brand} onChange={setBrand} />;
    }
  }, [activePage, brand, campaigns, entities]);

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-shell">
        <Header title={currentMeta.title} eyebrow={currentMeta.eyebrow} />
        <div className="page-container">{page}</div>
      </main>
    </div>
  );
}

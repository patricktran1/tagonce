import { useEffect, useMemo, useState } from 'react';
import './App.css';
import './release02.css';
import './release03.css';
import './release04.css';
import { CalendarPage } from './components/CalendarPage';
import { CampaignsPage } from './components/CampaignsPage';
import { CampaignComposer } from './components/CampaignComposer';
import { ConnectionsPage } from './components/ConnectionsPage';
import { DashboardPage } from './components/DashboardPage';
import { Header } from './components/Header';
import { MentionDirectory } from './components/MentionDirectory';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar, type PageKey } from './components/Sidebar';
import { defaultBrandSettings, demoEntities } from './data/demo';
import { loadLocal, saveLocal } from './lib/storage';
import type { BrandSettings, Campaign, MentionEntity, SocialConnection } from './types';

const ENTITY_KEY = 'tagonce.entities.v1';
const CAMPAIGN_KEY = 'tagonce.campaigns.v1';
const BRAND_KEY = 'tagonce.brand.v1';
const CONNECTION_KEY = 'tagonce.connections.v1';

const defaultConnections: SocialConnection[] = [
  {
    platform: 'linkedin',
    connected: false,
    accountType: 'Personal profile or company page',
  },
  {
    platform: 'facebook',
    connected: false,
    accountType: 'Personal profile or managed Page',
  },
  {
    platform: 'instagram',
    connected: false,
    accountType: 'Creator, business or personal profile',
  },
];

const pageMeta: Record<PageKey, { title: string; eyebrow: string }> = {
  dashboard: { title: 'Dashboard', eyebrow: 'Workspace overview' },
  compose: { title: 'Create campaign', eyebrow: 'Content command center' },
  connections: { title: 'Connect socials', eyebrow: 'Universal social identity' },
  mentions: { title: 'Identity book', eyebrow: 'Cross-platform identity graph' },
  campaigns: { title: 'Campaigns', eyebrow: 'Publishing history' },
  calendar: { title: 'Calendar', eyebrow: 'Publishing schedule' },
  settings: { title: 'Brand settings', eyebrow: 'Generation defaults' },
};

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [entities, setEntities] = useState<MentionEntity[]>(() => loadLocal(ENTITY_KEY, demoEntities));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadLocal(CAMPAIGN_KEY, []));
  const [brand, setBrand] = useState<BrandSettings>(() => loadLocal(BRAND_KEY, defaultBrandSettings));
  const [connections, setConnections] = useState<SocialConnection[]>(() =>
    loadLocal(CONNECTION_KEY, defaultConnections),
  );

  useEffect(() => saveLocal(ENTITY_KEY, entities), [entities]);
  useEffect(() => saveLocal(CAMPAIGN_KEY, campaigns), [campaigns]);
  useEffect(() => saveLocal(BRAND_KEY, brand), [brand]);
  useEffect(() => saveLocal(CONNECTION_KEY, connections), [connections]);

  const currentMeta = pageMeta[activePage];
  const saveCampaign = (campaign: Campaign) => {
    setCampaigns((current) => [campaign, ...current]);
    setEntities((current) =>
      current.map((entity) =>
        campaign.selectedEntityIds.includes(entity.id)
          ? { ...entity, usageCount: entity.usageCount + 1 }
          : entity,
      ),
    );
  };

  const page = useMemo(() => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            campaigns={campaigns}
            entities={entities}
            onCreate={() => setActivePage('compose')}
            onOpenCampaigns={() => setActivePage('campaigns')}
          />
        );
      case 'compose':
        return (
          <CampaignComposer
            entities={entities}
            brand={brand}
            onOpenMentions={() => setActivePage('mentions')}
            onSaveCampaign={saveCampaign}
          />
        );
      case 'connections':
        return <ConnectionsPage brand={brand} connections={connections} onChange={setConnections} />;
      case 'mentions':
        return (
          <MentionDirectory
            entities={entities}
            onAdd={(entity) => setEntities((current) => [entity, ...current])}
            onDelete={(entityId) =>
              setEntities((current) => current.filter((entity) => entity.id !== entityId))
            }
            onUpdate={(updated) =>
              setEntities((current) =>
                current.map((entity) => (entity.id === updated.id ? updated : entity)),
              )
            }
          />
        );
      case 'campaigns':
        return (
          <CampaignsPage
            campaigns={campaigns}
            onDelete={(campaignId) =>
              setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId))
            }
            onDuplicate={(campaign) =>
              saveCampaign({
                ...campaign,
                id: `campaign_${Date.now()}`,
                title: `${campaign.title} copy`,
                status: 'draft',
                createdAt: new Date().toISOString(),
                scheduledFor: undefined,
              })
            }
          />
        );
      case 'calendar':
        return <CalendarPage campaigns={campaigns} onCreate={() => setActivePage('compose')} />;
      case 'settings':
        return <SettingsPage brand={brand} onChange={setBrand} />;
    }
  }, [activePage, brand, campaigns, connections, entities]);

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

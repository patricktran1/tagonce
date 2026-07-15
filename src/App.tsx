import { useEffect, useMemo, useState } from 'react';
import './App.css';
import './release02.css';
import './release03.css';
import './release04.css';
import './release05.css';
import './release06.css';
import './release07.css';
import './release08.css';
import './release09.css';
import './release10.css';
import { AddressBookPage } from './components/AddressBookPage';
import { CampaignsPage } from './components/CampaignsPage';
import { CampaignComposer } from './components/CampaignComposer';
import { ConnectionsPage } from './components/ConnectionsPage';
import { DashboardPage } from './components/DashboardPage';
import { Header } from './components/Header';
import { MyCardsPage } from './components/MyCardsPage';
import { ScanPage } from './components/ScanPage';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar, type PageKey } from './components/Sidebar';
import { defaultBrandSettings, demoEntities } from './data/demo';
import { loadLocal, saveLocal } from './lib/storage';
import type {
  BrandSettings,
  Campaign,
  MentionEntity,
  MyProfile,
  SocialConnection,
} from './types';

const ENTITY_KEY = 'tagonce.entities.v1';
const CAMPAIGN_KEY = 'tagonce.campaigns.v1';
const BRAND_KEY = 'tagonce.brand.v1';
const CONNECTION_KEY = 'tagonce.connections.v1';
const PROFILE_KEY = 'tagonce.profile.v1';

const defaultConnections: SocialConnection[] = [
  { platform: 'linkedin', connected: false, accountType: 'Personal profile or company page' },
  { platform: 'facebook', connected: false, accountType: 'Personal profile or managed Page' },
  { platform: 'instagram', connected: false, accountType: 'Creator, business or personal profile' },
];

const defaultProfile: MyProfile = {
  displayName: 'Patrick Tran',
  title: 'Founder',
  company: 'AION EHR',
  email: '',
  phone: '',
  whatsapp: '',
  website: 'https://aionehr.com',
  eventName: '',
  eventEndsAt: new Date().toISOString().slice(0, 10),
  cardSelections: {
    event: ['title', 'company', 'email', 'website', 'eventName', 'social:linkedin'],
    personal: [
      'title',
      'company',
      'email',
      'phone',
      'whatsapp',
      'website',
      'social:linkedin',
      'social:instagram',
      'social:facebook',
    ],
    custom: ['email', 'social:linkedin'],
  },
};

const pageMeta: Record<PageKey, { title: string; eyebrow: string }> = {
  dashboard: { title: 'Dashboard', eyebrow: 'Identity workspace overview' },
  mycard: { title: 'My QR cards', eyebrow: 'Contextual identity exchange' },
  scan: { title: 'Receive card', eyebrow: 'Save the person and the moment' },
  address: { title: 'Address book', eyebrow: 'Social contacts and memories' },
  compose: { title: 'Create post', eyebrow: 'Tag-ready content workspace' },
  connections: { title: 'Social accounts', eyebrow: 'Your publishing identities' },
  campaigns: { title: 'Campaigns', eyebrow: 'Publishing history' },
  settings: { title: 'Brand settings', eyebrow: 'Generation defaults' },
};

function identitiesMatch(left: MentionEntity, right: MentionEntity) {
  if (left.displayName.trim().toLowerCase() === right.displayName.trim().toLowerCase()) return true;
  const leftUrls = new Set(
    Object.values(left.mappings)
      .map((mapping) => mapping?.profileUrl)
      .filter((value): value is string => Boolean(value)),
  );
  return Object.values(right.mappings).some(
    (mapping) => Boolean(mapping?.profileUrl && leftUrls.has(mapping.profileUrl)),
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(() =>
    new URLSearchParams(window.location.search).has('card') ? 'scan' : 'dashboard',
  );
  const [entities, setEntities] = useState<MentionEntity[]>(() => loadLocal(ENTITY_KEY, demoEntities));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadLocal(CAMPAIGN_KEY, []));
  const [brand, setBrand] = useState<BrandSettings>(() => loadLocal(BRAND_KEY, defaultBrandSettings));
  const [connections, setConnections] = useState<SocialConnection[]>(() => loadLocal(CONNECTION_KEY, defaultConnections));
  const [profile, setProfile] = useState<MyProfile>(() => loadLocal(PROFILE_KEY, defaultProfile));

  useEffect(() => saveLocal(ENTITY_KEY, entities), [entities]);
  useEffect(() => saveLocal(CAMPAIGN_KEY, campaigns), [campaigns]);
  useEffect(() => saveLocal(BRAND_KEY, brand), [brand]);
  useEffect(() => saveLocal(CONNECTION_KEY, connections), [connections]);
  useEffect(() => saveLocal(PROFILE_KEY, profile), [profile]);

  const currentMeta = pageMeta[activePage];

  function saveCampaign(campaign: Campaign) {
    setCampaigns((current) => [campaign, ...current]);
    setEntities((current) =>
      current.map((entity) =>
        campaign.selectedEntityIds.includes(entity.id)
          ? { ...entity, usageCount: entity.usageCount + 1 }
          : entity,
      ),
    );
  }

  function mergeScannedContact(incoming: MentionEntity) {
    setEntities((current) => {
      const existingIndex = current.findIndex((entity) => identitiesMatch(entity, incoming));
      if (existingIndex < 0) return [incoming, ...current];
      const existing = current[existingIndex];
      const merged: MentionEntity = {
        ...existing,
        ...incoming,
        id: existing.id,
        createdAt: existing.createdAt,
        usageCount: existing.usageCount,
        description: incoming.description || existing.description,
        title: incoming.title || existing.title,
        company: incoming.company || existing.company,
        email: incoming.email || existing.email,
        phone: incoming.phone || existing.phone,
        whatsapp: incoming.whatsapp || existing.whatsapp,
        website: incoming.website || existing.website,
        metAt: incoming.metAt || existing.metAt,
        metOn: incoming.metOn || existing.metOn,
        notes: [existing.notes, incoming.notes].filter(Boolean).join('\n') || undefined,
        memoryPhotoDataUrl: incoming.memoryPhotoDataUrl || existing.memoryPhotoDataUrl,
        mappings: { ...existing.mappings, ...incoming.mappings },
      };
      return current.map((entity, index) => (index === existingIndex ? merged : entity));
    });
  }

  const page = useMemo(() => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage campaigns={campaigns} entities={entities} onCreate={() => setActivePage('compose')} onOpenCampaigns={() => setActivePage('campaigns')} />;
      case 'mycard':
        return <MyCardsPage profile={profile} connections={connections} onChange={setProfile} />;
      case 'scan':
        return <ScanPage onSaveContact={mergeScannedContact} onOpenAddressBook={() => setActivePage('address')} />;
      case 'address':
        return (
          <AddressBookPage
            entities={entities}
            onAdd={(entity) => setEntities((current) => [entity, ...current])}
            onUpdate={(updated) => setEntities((current) => current.map((entity) => entity.id === updated.id ? updated : entity))}
            onDelete={(entityId) => setEntities((current) => current.filter((entity) => entity.id !== entityId))}
            onScan={() => setActivePage('scan')}
            onCreatePost={() => setActivePage('compose')}
          />
        );
      case 'compose':
        return <CampaignComposer entities={entities} brand={brand} onOpenMentions={() => setActivePage('address')} onSaveCampaign={saveCampaign} />;
      case 'connections':
        return <ConnectionsPage brand={brand} connections={connections} onChange={setConnections} />;
      case 'campaigns':
        return (
          <CampaignsPage
            campaigns={campaigns}
            onDelete={(campaignId) => setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId))}
            onDuplicate={(campaign) => saveCampaign({ ...campaign, id: `campaign_${Date.now()}`, title: `${campaign.title} copy`, status: 'draft', createdAt: new Date().toISOString(), scheduledFor: undefined })}
          />
        );
      case 'settings':
        return <SettingsPage brand={brand} onChange={setBrand} />;
    }
  }, [activePage, brand, campaigns, connections, entities, profile]);

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

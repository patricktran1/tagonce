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
import './release11.css';
import './release12.css';
import './release13.css';
import './release14.css';
import { AddressBookPage } from './components/AddressBookPage';
import { CampaignsPage } from './components/CampaignsPage';
import { CampaignComposer } from './components/CampaignComposer';
import { ConnectionsPage } from './components/ConnectionsPage';
import { DashboardPage } from './components/DashboardPage';
import { EventCardLauncher } from './components/EventCardLauncher';
import { ActiveEventSessionBar, EventSessionPrompt } from './components/EventSessionChrome';
import { Header } from './components/Header';
import { MyCardsPage } from './components/MyCardsPage';
import { ScanExchangePage } from './components/ScanExchangePage';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar, type PageKey } from './components/Sidebar';
import { defaultBrandSettings } from './data/demo';
import {
  clearRememberedGoogleCalendarAccount,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarStatus,
  getRememberedGoogleIdentity,
  restoreGoogleCalendarReturn,
} from './lib/calendarService';
import { contactsMatch, mergeContactRecords, prepareContactRecord } from './lib/contactHistory';
import {
  ACTIVE_EVENT_SESSION_KEY,
  attachEventSessionToContact,
  eventSessionFromProfile,
  loadActiveEventSession,
  saveActiveEventSession,
  type ActiveEventSession,
} from './lib/eventSession';
import { loadLocal, saveLocal } from './lib/storage';
import type {
  BrandSettings,
  Campaign,
  GoogleAccountIdentity,
  MentionEntity,
  MyProfile,
  SocialConnection,
} from './types';

restoreGoogleCalendarReturn();

const ENTITY_KEY = 'tagonce.entities.v1';
const CAMPAIGN_KEY = 'tagonce.campaigns.v1';
const BRAND_KEY = 'tagonce.brand.v1';
const CONNECTION_KEY = 'tagonce.connections.v1';
const PROFILE_KEY = 'tagonce.profile.v1';
const EXCHANGE_RECEIPT_KEY = 'tagonce.exchange.receipts.v1';
const WORKSPACE_KEYS = [
  ENTITY_KEY,
  CAMPAIGN_KEY,
  BRAND_KEY,
  CONNECTION_KEY,
  PROFILE_KEY,
  EXCHANGE_RECEIPT_KEY,
  ACTIVE_EVENT_SESSION_KEY,
];

const defaultConnections: SocialConnection[] = [
  { platform: 'linkedin', connected: false, accountType: 'Personal profile or company page' },
  { platform: 'facebook', connected: false, accountType: 'Personal profile or managed Page' },
  { platform: 'instagram', connected: false, accountType: 'Creator, business or personal profile' },
];

const defaultProfile: MyProfile = {
  displayName: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  avatarUrl: '',
  eventName: '',
  eventEndsAt: new Date().toISOString().slice(0, 10),
  eventStartAt: '',
  eventEndAt: '',
  eventLocation: '',
  eventUrl: '',
  eventDescription: '',
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
  dashboard: { title: 'Home', eyebrow: 'Event contact exchange' },
  event: { title: 'Events & Calendar', eyebrow: 'Create an event QR' },
  mycard: { title: 'My QR cards', eyebrow: 'Choose what you share' },
  scan: { title: 'Exchange cards', eyebrow: 'Save the person and the moment' },
  address: { title: 'Contacts', eyebrow: 'People, context and memories' },
  compose: { title: 'Post Studio', eyebrow: 'Beta: adapt one post across platforms' },
  connections: { title: 'Social accounts', eyebrow: 'Beta Studio identities' },
  campaigns: { title: 'Campaigns', eyebrow: 'Beta Studio history' },
  settings: { title: 'Brand settings', eyebrow: 'Beta Studio defaults' },
};

function initialPage(): PageKey {
  const params = new URLSearchParams(window.location.search);
  if (params.has('card')) return 'scan';
  if (params.get('view') === 'event') return 'event';
  if (params.get('view') === 'scan') return 'scan';
  return 'dashboard';
}

function profileWithGoogleIdentity(profile: MyProfile, identity: GoogleAccountIdentity | null) {
  if (!identity) return profile;
  const next = {
    ...profile,
    displayName: profile.displayName || identity.displayName || '',
    email: profile.email || identity.email,
    avatarUrl: profile.avatarUrl || identity.picture || '',
  };
  const changed = next.displayName !== profile.displayName
    || next.email !== profile.email
    || next.avatarUrl !== profile.avatarUrl;
  return changed ? next : profile;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>(initialPage);
  const [entities, setEntities] = useState<MentionEntity[]>(() =>
    loadLocal<MentionEntity[]>(ENTITY_KEY, []).map(prepareContactRecord),
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadLocal(CAMPAIGN_KEY, []));
  const [brand, setBrand] = useState<BrandSettings>(() => loadLocal(BRAND_KEY, defaultBrandSettings));
  const [connections, setConnections] = useState<SocialConnection[]>(() => loadLocal(CONNECTION_KEY, defaultConnections));
  const [profile, setProfile] = useState<MyProfile>(() => loadLocal(PROFILE_KEY, defaultProfile));
  const [activeEventSession, setActiveEventSession] = useState<ActiveEventSession | null>(loadActiveEventSession);
  const [googleIdentity, setGoogleIdentity] = useState<GoogleAccountIdentity | null>(() => getRememberedGoogleIdentity());
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => saveLocal(ENTITY_KEY, entities), [entities]);
  useEffect(() => saveLocal(CAMPAIGN_KEY, campaigns), [campaigns]);
  useEffect(() => saveLocal(BRAND_KEY, brand), [brand]);
  useEffect(() => saveLocal(CONNECTION_KEY, connections), [connections]);
  useEffect(() => saveLocal(PROFILE_KEY, profile), [profile]);
  useEffect(() => saveActiveEventSession(activeEventSession), [activeEventSession]);

  useEffect(() => {
    setProfile((current) => profileWithGoogleIdentity(current, googleIdentity));
  }, [googleIdentity]);

  useEffect(() => {
    let cancelled = false;
    async function checkGoogleConnection() {
      try {
        const status = await getCalendarStatus();
        if (!cancelled) setCalendarConnected(status.connected);
      } catch {
        if (!cancelled) setCalendarConnected(false);
      }
    }
    void checkGoogleConnection();
    return () => { cancelled = true; };
  }, []);

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
      const sessionAttributed = attachEventSessionToContact(incoming, activeEventSession);
      const preparedIncoming = prepareContactRecord(sessionAttributed);
      const existingIndex = current.findIndex((entity) => contactsMatch(entity, preparedIncoming));
      if (existingIndex < 0) return [preparedIncoming, ...current];
      const existing = current[existingIndex];
      const merged = mergeContactRecords(existing, preparedIncoming);
      return current.map((entity, index) => (index === existingIndex ? merged : entity));
    });
  }

  function startEventSession() {
    const session = eventSessionFromProfile(profile);
    if (!session) return;
    setActiveEventSession(session);
    setActivePage('scan');
  }

  function endEventSession() {
    if (!activeEventSession) return;
    const confirmed = window.confirm(
      `End the live session for ${activeEventSession.eventName}? Its contacts and recap will remain saved.`,
    );
    if (!confirmed) return;
    setActiveEventSession(null);
    setActivePage('dashboard');
  }

  function connectGoogle(returnToEvent = false, selectAccount = false) {
    connectGoogleCalendar(returnToEvent ? 'event' : undefined, '', selectAccount);
  }

  async function switchGoogleAccount() {
    try {
      await disconnectGoogleCalendar();
    } catch {
      // The account chooser can still replace an expired session.
    }
    clearRememberedGoogleCalendarAccount();
    setGoogleIdentity(null);
    setCalendarConnected(false);
    setActiveEventSession(null);
    setProfile(defaultProfile);
    connectGoogle(false, true);
  }

  async function logout() {
    try {
      await disconnectGoogleCalendar();
    } catch {
      // Local logout still completes when the Google session already expired.
    }
    clearRememberedGoogleCalendarAccount();
    setGoogleIdentity(null);
    setCalendarConnected(false);
    setActivePage('dashboard');
  }

  async function eraseWorkspace() {
    const confirmed = window.confirm(
      'Erase TagOnce data from this device? This deletes saved contacts, cards, profile edits and Beta Studio drafts stored in this browser.',
    );
    if (!confirmed) return;

    try {
      await disconnectGoogleCalendar();
    } catch {
      // Local data erasure does not depend on an active Google session.
    }
    WORKSPACE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    clearRememberedGoogleCalendarAccount();
    setEntities([]);
    setCampaigns([]);
    setBrand(defaultBrandSettings);
    setConnections(defaultConnections);
    setProfile(defaultProfile);
    setActiveEventSession(null);
    setGoogleIdentity(null);
    setCalendarConnected(false);
    setActivePage('dashboard');
  }

  const page = useMemo(() => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            profile={profile}
            googleIdentity={googleIdentity}
            calendarConnected={calendarConnected}
            campaigns={campaigns}
            entities={entities}
            onConnectGoogle={() => connectGoogle(false)}
            onOpenEvents={() => setActivePage('event')}
            onOpenCards={() => setActivePage('mycard')}
            onExchange={() => setActivePage('scan')}
            onOpenContacts={() => setActivePage('address')}
            onOpenBeta={() => setActivePage('compose')}
          />
        );
      case 'event':
        return <EventCardLauncher profile={profile} onChange={setProfile} onOpenCards={() => setActivePage('mycard')} />;
      case 'mycard':
        return <MyCardsPage profile={profile} connections={connections} onChange={setProfile} />;
      case 'scan':
        return (
          <ScanExchangePage
            profile={profile}
            connections={connections}
            activeEventSession={activeEventSession}
            onChangeProfile={setProfile}
            onSaveContact={mergeScannedContact}
            onOpenAddressBook={() => setActivePage('address')}
            onOpenMyCards={() => setActivePage('mycard')}
          />
        );
      case 'address':
        return (
          <AddressBookPage
            entities={entities}
            onAdd={(entity) => setEntities((current) => [prepareContactRecord(entity), ...current])}
            onUpdate={(updated) => setEntities((current) => current.map((entity) => entity.id === updated.id ? prepareContactRecord(updated) : entity))}
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
  }, [activeEventSession, activePage, brand, calendarConnected, campaigns, connections, entities, googleIdentity, profile]);

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        profileName={profile.displayName || googleIdentity?.displayName || ''}
        profileAvatarUrl={profile.avatarUrl || googleIdentity?.picture}
        onNavigate={setActivePage}
      />
      <main className="main-shell">
        <Header
          title={currentMeta.title}
          eyebrow={currentMeta.eyebrow}
          profileName={profile.displayName}
          profileEmail={profile.email}
          profileAvatarUrl={profile.avatarUrl}
          googleIdentity={googleIdentity}
          onOpenProfile={() => setActivePage('mycard')}
          onOpenCalendar={() => setActivePage('event')}
          onConnectGoogle={() => connectGoogle(false)}
          onSwitchGoogle={switchGoogleAccount}
          onLogout={logout}
          onEraseWorkspace={eraseWorkspace}
        />
        {activeEventSession ? (
          <ActiveEventSessionBar
            session={activeEventSession}
            entities={entities}
            onScan={() => setActivePage('scan')}
            onShowQr={() => setActivePage('mycard')}
            onOpenContacts={() => setActivePage('address')}
            onEnd={endEventSession}
          />
        ) : activePage === 'mycard' && profile.eventName.trim() ? (
          <EventSessionPrompt profile={profile} onStart={startEventSession} />
        ) : null}
        <div className="page-container">{page}</div>
      </main>
    </div>
  );
}

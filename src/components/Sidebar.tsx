import {
  Beaker,
  CalendarDays,
  ContactRound,
  FileStack,
  IdCard,
  LayoutDashboard,
  PenLine,
  ScanLine,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

export type PageKey =
  | 'dashboard'
  | 'event'
  | 'mycard'
  | 'scan'
  | 'address'
  | 'compose'
  | 'connections'
  | 'campaigns'
  | 'settings';

interface SidebarProps {
  activePage: PageKey;
  profileName: string;
  profileAvatarUrl?: string;
  onNavigate: (page: PageKey) => void;
}

const coreItems = [
  { key: 'dashboard' as const, label: 'Home', icon: LayoutDashboard },
  { key: 'event' as const, label: 'Events & Calendar', icon: CalendarDays },
  { key: 'mycard' as const, label: 'My QR cards', icon: IdCard },
  { key: 'scan' as const, label: 'Exchange cards', icon: ScanLine },
  { key: 'address' as const, label: 'Contacts', icon: ContactRound },
];

const betaItems = [
  { key: 'compose' as const, label: 'Post Studio', icon: PenLine },
  { key: 'campaigns' as const, label: 'Campaigns', icon: FileStack },
  { key: 'connections' as const, label: 'Social accounts', icon: Share2 },
  { key: 'settings' as const, label: 'Brand settings', icon: Settings },
];

export function Sidebar({ activePage, profileName, profileAvatarUrl, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => onNavigate('dashboard')}>
        <span className="brand-glyph"><Sparkles size={18} /></span>
        <span>
          <strong>TagOnce</strong>
          <small>Meet once. Remember the moment.</small>
        </span>
      </button>

      <div className="workspace-card">
        <ProfileAvatar name={profileName || 'TagOnce user'} src={profileAvatarUrl} className="workspace-avatar" />
        <span><small>My profile</small><strong>{profileName || 'Continue with Google'}</strong></span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <div className="nav-label">Event contact exchange</div>
        {coreItems.map(({ key, label, icon: Icon }) => (
          <button className={activePage === key ? 'nav-item active' : 'nav-item'} key={key} onClick={() => onNavigate(key)}>
            <Icon size={18} />
            {label}
          </button>
        ))}

        <div className="nav-label beta-nav-label"><Beaker size={13} /> Beta Studio</div>
        {betaItems.map(({ key, label, icon: Icon }) => (
          <button className={activePage === key ? 'nav-item beta-nav-item active' : 'nav-item beta-nav-item'} key={key} onClick={() => onNavigate(key)}>
            <Icon size={18} />
            {label}
            <span className="soon-pill">Beta</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="beta-note core-note">
          <strong>QR exchange first</strong>
          <span>Create event cards, share contact context and remember where you met.</span>
        </div>
      </div>
    </aside>
  );
}
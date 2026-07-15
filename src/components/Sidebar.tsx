import {
  CalendarDays,
  ContactRound,
  FileStack,
  IdCard,
  LayoutDashboard,
  PenLine,
  ScanLine,
  Settings,
  Sparkles,
} from 'lucide-react';

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
  onNavigate: (page: PageKey) => void;
}

const items = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'event' as const, label: 'Live event', icon: CalendarDays },
  { key: 'mycard' as const, label: 'My QR cards', icon: IdCard },
  { key: 'scan' as const, label: 'Receive card', icon: ScanLine },
  { key: 'address' as const, label: 'Address book', icon: ContactRound },
  { key: 'compose' as const, label: 'Create post', icon: PenLine },
  { key: 'campaigns' as const, label: 'Campaigns', icon: FileStack },
  { key: 'settings' as const, label: 'Brand settings', icon: Settings },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => onNavigate('dashboard')}>
        <span className="brand-glyph"><Sparkles size={18} /></span>
        <span>
          <strong>TagOnce</strong>
          <small>Share right. Remember more. Tag everywhere.</small>
        </span>
      </button>

      <div className="workspace-card">
        <span className="workspace-avatar">PT</span>
        <span><small>Workspace</small><strong>Patrick's Studio</strong></span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <div className="nav-label">Identity workspace</div>
        {items.map(({ key, label, icon: Icon }) => (
          <button className={activePage === key ? 'nav-item active' : 'nav-item'} key={key} onClick={() => onNavigate(key)}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="beta-note">
          <strong>Context cards live</strong>
          <span>Calendar-powered event cards, QR exchange, vCards, memories and tag-ready contacts.</span>
        </div>
      </div>
    </aside>
  );
}

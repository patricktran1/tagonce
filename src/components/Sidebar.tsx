import {
  AtSign,
  CalendarDays,
  FileStack,
  LayoutDashboard,
  Link2,
  PenLine,
  Settings,
  Sparkles,
} from 'lucide-react';

export type PageKey =
  | 'dashboard'
  | 'compose'
  | 'connections'
  | 'mentions'
  | 'campaigns'
  | 'calendar'
  | 'settings';

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const items = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'compose' as const, label: 'Create', icon: PenLine },
  { key: 'connections' as const, label: 'Connect socials', icon: Link2 },
  { key: 'mentions' as const, label: 'Identity book', icon: AtSign },
  { key: 'campaigns' as const, label: 'Campaigns', icon: FileStack },
  { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  { key: 'settings' as const, label: 'Brand settings', icon: Settings },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => onNavigate('dashboard')}>
        <span className="brand-glyph">
          <Sparkles size={18} />
        </span>
        <span>
          <strong>TagOnce</strong>
          <small>Connect once. Tag everywhere.</small>
        </span>
      </button>

      <div className="workspace-card">
        <span className="workspace-avatar">PT</span>
        <span>
          <small>Workspace</small>
          <strong>Patrick's Studio</strong>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <div className="nav-label">Workspace</div>
        {items.map(({ key, label, icon: Icon }) => (
          <button
            className={activePage === key ? 'nav-item active' : 'nav-item'}
            key={key}
            onClick={() => onNavigate(key)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="beta-note">
          <strong>Identity layer beta</strong>
          <span>Manual linking now. Secure OAuth connections next.</span>
        </div>
      </div>
    </aside>
  );
}

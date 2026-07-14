import {
  AtSign,
  CalendarDays,
  FileStack,
  LayoutDashboard,
  PenLine,
  Settings,
  Sparkles,
} from 'lucide-react';

export type PageKey = 'compose' | 'mentions' | 'campaigns' | 'settings';

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const items = [
  { key: 'compose' as const, label: 'Create', icon: PenLine },
  { key: 'mentions' as const, label: 'Mentions', icon: AtSign },
  { key: 'campaigns' as const, label: 'Campaigns', icon: FileStack },
  { key: 'settings' as const, label: 'Brand settings', icon: Settings },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => onNavigate('compose')}>
        <span className="brand-glyph">
          <Sparkles size={18} />
        </span>
        <span>
          <strong>TagOnce</strong>
          <small>Mention once. Publish everywhere.</small>
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
        <button className="nav-disabled" disabled>
          <LayoutDashboard size={18} />
          Dashboard
          <span className="soon-pill">Soon</span>
        </button>
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
        <button className="nav-disabled" disabled>
          <CalendarDays size={18} />
          Calendar
          <span className="soon-pill">Soon</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="beta-note">
          <strong>Local MVP</strong>
          <span>No paid API keys required.</span>
        </div>
      </div>
    </aside>
  );
}

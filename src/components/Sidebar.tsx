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
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
  { key: 'compose' as const, label: 'Post Studio', description: 'Adapt one post for multiple platforms', icon: PenLine },
  { key: 'campaigns' as const, label: 'Campaigns', description: 'Review saved Beta Studio drafts', icon: FileStack },
  { key: 'connections' as const, label: 'Social accounts', description: 'Manage publishing identities', icon: Share2 },
  { key: 'settings' as const, label: 'Brand settings', description: 'Set Beta Studio defaults', icon: Settings },
];

export function Sidebar({ activePage, profileName, profileAvatarUrl, onNavigate }: SidebarProps) {
  const [betaOpen, setBetaOpen] = useState(false);
  const betaActive = betaItems.some(({ key }) => key === activePage);

  useEffect(() => {
    if (!betaOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setBetaOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [betaOpen]);

  function navigate(page: PageKey) {
    setBetaOpen(false);
    onNavigate(page);
  }

  return (
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => navigate('dashboard')}>
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
          <button className={activePage === key ? 'nav-item active' : 'nav-item'} key={key} onClick={() => navigate(key)}>
            <Icon size={18} />
            {label}
          </button>
        ))}

        <div className="desktop-beta-nav">
          <div className="nav-label beta-nav-label"><Beaker size={13} /> Beta Studio</div>
          {betaItems.map(({ key, label, icon: Icon }) => (
            <button className={activePage === key ? 'nav-item beta-nav-item active' : 'nav-item beta-nav-item'} key={key} onClick={() => navigate(key)}>
              <Icon size={18} />
              {label}
              <span className="soon-pill">Beta</span>
            </button>
          ))}
        </div>
      </nav>

      <button
        className={`mobile-beta-launcher${betaActive ? ' active' : ''}`}
        type="button"
        aria-expanded={betaOpen}
        aria-controls="mobile-beta-studio"
        onClick={() => setBetaOpen(true)}
      >
        <Beaker size={16} />
        <span>Beta</span>
      </button>

      {betaOpen && (
        <div className="mobile-beta-backdrop" role="presentation" onClick={() => setBetaOpen(false)}>
          <section
            id="mobile-beta-studio"
            className="mobile-beta-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-beta-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-beta-sheet-heading">
              <span>
                <small>SECONDARY TOOLS</small>
                <strong id="mobile-beta-title">Beta Studio</strong>
              </span>
              <button type="button" onClick={() => setBetaOpen(false)} aria-label="Close Beta Studio">
                <X size={19} />
              </button>
            </div>
            <div className="mobile-beta-grid">
              {betaItems.map(({ key, label, description, icon: Icon }) => (
                <button className={activePage === key ? 'active' : ''} type="button" key={key} onClick={() => navigate(key)}>
                  <span className="mobile-beta-icon"><Icon size={20} /></span>
                  <span><strong>{label}</strong><small>{description}</small></span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="beta-note core-note">
          <strong>QR exchange first</strong>
          <span>Create event cards, share contact context and remember where you met.</span>
        </div>
      </div>
    </aside>
  );
}

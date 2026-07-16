import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  IdCard,
  LogIn,
  LogOut,
  Repeat2,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface HeaderProps {
  title: string;
  eyebrow: string;
  profileName: string;
  profileEmail?: string;
  googleAccount?: string;
  onOpenProfile: () => void;
  onOpenCalendar: () => void;
  onConnectGoogle: () => void;
  onSwitchGoogle: () => Promise<void>;
  onLogout: () => Promise<void>;
  onEraseWorkspace: () => Promise<void>;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TO';
}

export function Header({
  title,
  eyebrow,
  profileName,
  profileEmail,
  googleAccount,
  onOpenProfile,
  onOpenCalendar,
  onConnectGoogle,
  onSwitchGoogle,
  onLogout,
  onEraseWorkspace,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'switch' | 'logout' | 'erase' | ''>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = initialsFor(profileName);
  const connected = Boolean(googleAccount);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function navigate(action: () => void) {
    setOpen(false);
    action();
  }

  async function run(action: 'switch' | 'logout' | 'erase', callback: () => Promise<void>) {
    setBusy(action);
    try {
      await callback();
      setOpen(false);
    } finally {
      setBusy('');
    }
  }

  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <label className="global-search">
          <Search size={17} />
          <input placeholder="Search TagOnce" aria-label="Search TagOnce" />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button" type="button" aria-label="Help">
          <CircleHelp size={19} />
        </button>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <div className="account-menu-wrap" ref={menuRef}>
          <button
            className={`account-menu-trigger${open ? ' open' : ''}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="user-avatar">{initials}</span>
            <ChevronDown size={14} />
          </button>

          {open && (
            <div className="account-menu" role="menu">
              <div className="account-menu-summary">
                <span className="user-avatar account-menu-avatar">{initials}</span>
                <span>
                  <strong>{profileName || 'TagOnce user'}</strong>
                  <small>{googleAccount || profileEmail || 'Local workspace on this browser'}</small>
                </span>
                <span className={`account-status-pill${connected ? ' connected' : ''}`}>
                  {connected ? 'Google connected' : 'Local only'}
                </span>
              </div>

              <div className="account-menu-section" role="none">
                <button type="button" role="menuitem" onClick={() => navigate(onOpenProfile)}>
                  <IdCard size={17} />
                  <span><strong>My profile and QR cards</strong><small>Edit identity and sharing presets</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => navigate(onOpenCalendar)}>
                  <CalendarDays size={17} />
                  <span><strong>Event launcher</strong><small>Links, invites and Google Calendar</small></span>
                </button>
              </div>

              <div className="account-menu-section" role="none">
                {connected ? (
                  <>
                    <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('switch', onSwitchGoogle)}>
                      <Repeat2 size={17} />
                      <span><strong>{busy === 'switch' ? 'Opening Google…' : 'Switch Google account'}</strong><small>Choose another signed-in Google user</small></span>
                    </button>
                    <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('logout', onLogout)}>
                      <LogOut size={17} />
                      <span><strong>{busy === 'logout' ? 'Logging out…' : 'Log out'}</strong><small>Disconnect Google; keep local TagOnce data</small></span>
                    </button>
                  </>
                ) : (
                  <button type="button" role="menuitem" onClick={() => navigate(onConnectGoogle)}>
                    <LogIn size={17} />
                    <span><strong>Connect Google</strong><small>Enable account identity and Calendar</small></span>
                  </button>
                )}
              </div>

              <div className="account-menu-section account-menu-danger" role="none">
                <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('erase', onEraseWorkspace)}>
                  <Trash2 size={17} />
                  <span><strong>{busy === 'erase' ? 'Clearing workspace…' : 'Erase local workspace'}</strong><small>Delete cards, contacts and campaigns from this browser</small></span>
                </button>
              </div>

              <p className="account-menu-footnote">TagOnce data is currently stored on this browser. Cloud accounts and cross-device sync are not enabled yet.</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

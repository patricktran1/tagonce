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
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GoogleAccountIdentity } from '../types';
import { ProfileAvatar } from './ProfileAvatar';

interface HeaderProps {
  title: string;
  eyebrow: string;
  profileName: string;
  profileEmail?: string;
  profileAvatarUrl?: string;
  googleIdentity?: GoogleAccountIdentity | null;
  onOpenProfile: () => void;
  onOpenCalendar: () => void;
  onConnectGoogle: () => void;
  onSwitchGoogle: () => Promise<void>;
  onLogout: () => Promise<void>;
  onEraseWorkspace?: () => Promise<void>;
}

export function Header({
  title,
  eyebrow,
  profileName,
  profileEmail,
  profileAvatarUrl,
  googleIdentity,
  onOpenProfile,
  onOpenCalendar,
  onConnectGoogle,
  onSwitchGoogle,
  onLogout,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'switch' | 'logout' | ''>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const connected = Boolean(googleIdentity?.email);
  const avatarUrl = profileAvatarUrl || googleIdentity?.picture;
  const displayName = profileName || googleIdentity?.displayName || 'TagOnce user';
  const accountEmail = googleIdentity?.email || profileEmail;

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

  async function run(action: 'switch' | 'logout', callback: () => Promise<void>) {
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
            <ProfileAvatar name={displayName} src={avatarUrl} className="user-avatar" />
            <ChevronDown size={14} />
          </button>

          {open && (
            <div className="account-menu" role="menu">
              <div className="account-menu-summary">
                <ProfileAvatar name={displayName} src={avatarUrl} className="user-avatar account-menu-avatar" />
                <span>
                  <strong>{displayName}</strong>
                  <small>{accountEmail || 'Create your profile with Google'}</small>
                </span>
                <span className={`account-status-pill${connected ? ' connected' : ''}`}>
                  {connected ? 'Google profile' : 'Not signed in'}
                </span>
              </div>

              {!connected && (
                <div className="account-menu-section account-menu-google-first" role="none">
                  <button type="button" role="menuitem" onClick={() => navigate(onConnectGoogle)}>
                    <LogIn size={17} />
                    <span><strong>Continue with Google</strong><small>Create your profile and connect Calendar</small></span>
                  </button>
                </div>
              )}

              <div className="account-menu-section" role="none">
                <button type="button" role="menuitem" onClick={() => navigate(onOpenProfile)}>
                  <IdCard size={17} />
                  <span><strong>My profile and QR cards</strong><small>Edit your identity and sharing choices</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => navigate(onOpenCalendar)}>
                  <CalendarDays size={17} />
                  <span><strong>Events & Calendar</strong><small>Choose a calendar event or paste an event link</small></span>
                </button>
              </div>

              {connected && (
                <div className="account-menu-section" role="none">
                  <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('switch', onSwitchGoogle)}>
                    <Repeat2 size={17} />
                    <span><strong>{busy === 'switch' ? 'Opening Google…' : 'Switch Google account'}</strong><small>Use another Google profile and Calendar</small></span>
                  </button>
                  <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('logout', onLogout)}>
                    <LogOut size={17} />
                    <span><strong>{busy === 'logout' ? 'Signing out…' : 'Sign out'}</strong><small>Disconnect Google on this device</small></span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

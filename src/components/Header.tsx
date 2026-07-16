import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Cloud,
  CloudOff,
  IdCard,
  Loader2,
  LogIn,
  LogOut,
  Repeat2,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GoogleAccountIdentity } from '../types';
import type { WorkspaceSyncState } from '../lib/workspaceSync';
import { ProfileAvatar } from './ProfileAvatar';

interface HeaderProps {
  title: string;
  eyebrow: string;
  profileName: string;
  profileEmail?: string;
  profileAvatarUrl?: string;
  googleAccount?: string;
  googleIdentity?: GoogleAccountIdentity | null;
  syncState: WorkspaceSyncState;
  syncMessage?: string;
  onOpenProfile: () => void;
  onOpenCalendar: () => void;
  onConnectGoogle: () => void;
  onEnableSync: () => void;
  onSwitchGoogle: () => Promise<void>;
  onLogout: () => Promise<void>;
  onEraseWorkspace: () => Promise<void>;
}

export function Header({
  title,
  eyebrow,
  profileName,
  profileEmail,
  profileAvatarUrl,
  googleAccount,
  googleIdentity,
  syncState,
  syncMessage,
  onOpenProfile,
  onOpenCalendar,
  onConnectGoogle,
  onEnableSync,
  onSwitchGoogle,
  onLogout,
  onEraseWorkspace,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'switch' | 'logout' | 'erase' | ''>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const connected = Boolean(googleAccount || googleIdentity?.email);
  const avatarUrl = profileAvatarUrl || googleIdentity?.picture;
  const displayName = profileName || googleIdentity?.displayName || 'TagOnce user';
  const accountEmail = googleIdentity?.email || googleAccount || profileEmail;
  const cloudActive = syncState === 'synced' || syncState === 'syncing';

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

  const statusLabel = cloudActive
    ? syncState === 'syncing' ? 'Syncing' : 'Cloud synced'
    : connected ? 'Google connected' : 'Local only';

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
                  <small>{accountEmail || 'Local workspace on this browser'}</small>
                </span>
                <span className={`account-status-pill${cloudActive ? ' synced' : connected ? ' connected' : ''}`}>
                  {syncState === 'syncing' && <Loader2 className="spin" size={11} />}
                  {statusLabel}
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
                    {!cloudActive && (
                      <button type="button" role="menuitem" onClick={() => navigate(onEnableSync)}>
                        <Cloud size={17} />
                        <span>
                          <strong>Enable cross-device sync</strong>
                          <small>Store this workspace privately in Google Drive app data</small>
                        </span>
                      </button>
                    )}
                    <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('switch', onSwitchGoogle)}>
                      <Repeat2 size={17} />
                      <span><strong>{busy === 'switch' ? 'Opening Google…' : 'Switch Google account'}</strong><small>Choose another signed-in Google user</small></span>
                    </button>
                    <button type="button" role="menuitem" disabled={Boolean(busy)} onClick={() => void run('logout', onLogout)}>
                      <LogOut size={17} />
                      <span><strong>{busy === 'logout' ? 'Logging out…' : 'Log out'}</strong><small>Disconnect Google; keep this browser’s local copy</small></span>
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

              <p className={`account-menu-footnote${cloudActive ? ' synced' : ''}`}>
                {cloudActive
                  ? <><Cloud size={13} /> TagOnce is syncing this workspace across devices through your private Google Drive app data.</>
                  : connected
                    ? <><CloudOff size={13} /> Google identity and Calendar are connected. Enable sync to share TagOnce data across devices.</>
                    : <><CloudOff size={13} /> This workspace is stored only on this browser until Google sync is enabled.</>}
                {syncMessage && <span>{syncMessage}</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { Bell, CircleHelp, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  eyebrow: string;
}

export function Header({ title, eyebrow }: HeaderProps) {
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
        <button className="icon-button" aria-label="Help">
          <CircleHelp size={19} />
        </button>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>
        <span className="user-avatar">PT</span>
      </div>
    </header>
  );
}

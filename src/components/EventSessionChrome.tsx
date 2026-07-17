import {
  CalendarDays,
  ContactRound,
  MapPin,
  Play,
  QrCode,
  Radio,
  ScanLine,
  Square,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  activeEventDurationLabel,
  activeEventSessionStats,
  type ActiveEventSession,
} from '../lib/eventSession';
import type { MentionEntity, MyProfile } from '../types';

interface EventSessionPromptProps {
  profile: MyProfile;
  onStart: () => void;
}

interface ActiveEventSessionBarProps {
  session: ActiveEventSession;
  entities: MentionEntity[];
  onScan: () => void;
  onShowQr: () => void;
  onOpenContacts: () => void;
  onEnd: () => void;
}

function eventTimeLabel(profile: MyProfile) {
  if (!profile.eventStartAt) return '';
  const start = new Date(profile.eventStartAt);
  if (Number.isNaN(start.getTime())) return '';
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day.format(start)} · ${time.format(start)}`;
}

export function EventSessionPrompt({ profile, onStart }: EventSessionPromptProps) {
  const time = eventTimeLabel(profile);
  return (
    <section className="event-session-prompt" aria-label="Start live event session">
      <span className="event-session-prompt-icon"><Radio size={20} /></span>
      <span className="event-session-prompt-copy">
        <small>EVENT QR READY</small>
        <strong>{profile.eventName}</strong>
        <span>
          {time && <small><CalendarDays size={13} /> {time}</small>}
          {profile.eventLocation && <small><MapPin size={13} /> {profile.eventLocation}</small>}
        </span>
      </span>
      <button className="button primary" type="button" onClick={onStart}><Play size={16} /> Start live session</button>
    </section>
  );
}

export function ActiveEventSessionBar({
  session,
  entities,
  onScan,
  onShowQr,
  onOpenContacts,
  onEnd,
}: ActiveEventSessionBarProps) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => activeEventSessionStats(session, entities), [entities, session]);

  return (
    <section className="active-event-session-bar" aria-label={`${session.eventName} live session`}>
      <span className="active-event-live-mark"><span aria-hidden="true" /><Radio size={17} /></span>
      <span className="active-event-session-copy">
        <small>LIVE EVENT · {activeEventDurationLabel(session, clock)}</small>
        <strong>{session.eventName}</strong>
        {session.eventLocation && <span><MapPin size={12} /> {session.eventLocation}</span>}
      </span>
      <span className="active-event-session-metrics">
        <button type="button" onClick={onOpenContacts}><UsersRound size={15} /><strong>{stats.peopleCount}</strong><small>people</small></button>
        <span><ContactRound size={15} /><strong>{stats.encounterCount}</strong><small>encounters</small></span>
      </span>
      <span className="active-event-session-actions">
        <button className="active-event-scan-action" type="button" onClick={onScan}><ScanLine size={16} /> Scan next</button>
        <button type="button" onClick={onShowQr}><QrCode size={16} /> Show QR</button>
        <button className="active-event-end-action" type="button" onClick={onEnd}><Square size={14} /> End</button>
      </span>
    </section>
  );
}

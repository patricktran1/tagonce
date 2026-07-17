import {
  ArrowRight,
  Beaker,
  CalendarCheck,
  CalendarPlus,
  ContactRound,
  IdCard,
  LogIn,
  QrCode,
  ScanLine,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { Campaign, GoogleAccountIdentity, MentionEntity, MyProfile } from '../types';
import { FollowUpPreview } from './FollowUpPreview';
import { ProfileAvatar } from './ProfileAvatar';

interface DashboardPageProps {
  profile: MyProfile;
  googleIdentity: GoogleAccountIdentity | null;
  calendarConnected: boolean;
  campaigns: Campaign[];
  entities: MentionEntity[];
  onConnectGoogle: () => void;
  onOpenEvents: () => void;
  onOpenCards: () => void;
  onExchange: () => void;
  onOpenContacts: () => void;
  onOpenBeta: () => void;
}

export function DashboardPage({
  profile,
  googleIdentity,
  calendarConnected,
  campaigns,
  entities,
  onConnectGoogle,
  onOpenEvents,
  onOpenCards,
  onExchange,
  onOpenContacts,
  onOpenBeta,
}: DashboardPageProps) {
  const profileReady = Boolean(googleIdentity?.email);
  const displayName = profile.displayName || googleIdentity?.displayName || '';
  const avatar = profile.avatarUrl || googleIdentity?.picture;

  return (
    <div className="page-stack qr-home-page">
      <section className={`hero-panel qr-home-hero${profileReady ? ' connected' : ''}`}>
        <div className="qr-home-hero-copy">
          <span className="hero-kicker">Event contact exchange</span>
          <h2>{profileReady ? `Ready when you are, ${displayName.split(/\s+/)[0] || 'there'}.` : 'Meet someone. Exchange the whole moment.'}</h2>
          <p>Create a QR for an event, share the contact details you choose, and remember who you met, where, and why it mattered.</p>
          <div className="qr-home-hero-actions">
            {profileReady ? (
              <>
                <button className="button primary large-button" onClick={onOpenEvents}><CalendarPlus size={18} /> Create Event QR</button>
                <button className="button secondary large-button" onClick={onOpenCards}><QrCode size={18} /> Show my QR</button>
              </>
            ) : (
              <button className="button primary google-home-button" onClick={onConnectGoogle}><LogIn size={18} /> Continue with Google</button>
            )}
          </div>
          {!profileReady && <small className="google-home-note">One Google step creates your profile from your verified name, photo and email, and connects read-only Calendar.</small>}
        </div>

        <div className="qr-home-profile-card">
          <ProfileAvatar name={displayName || 'TagOnce user'} src={avatar} className="qr-home-avatar" />
          <span>
            <small>{profileReady ? 'GOOGLE PROFILE READY' : 'YOUR PROFILE'}</small>
            <strong>{displayName || 'Created after Google sign-in'}</strong>
            <p>{profile.email || googleIdentity?.email || 'Name, photo and email auto-fill'}</p>
          </span>
          <span className={`qr-home-status${calendarConnected ? ' connected' : ''}`}>
            {calendarConnected ? <CalendarCheck size={14} /> : <Sparkles size={14} />}
            {calendarConnected ? 'Calendar connected' : profileReady ? 'Profile ready' : 'One-step setup'}
          </span>
        </div>
      </section>

      <section className="qr-home-action-grid" aria-label="Main TagOnce actions">
        <button className="qr-home-action-card primary-action" onClick={onOpenEvents}>
          <span><CalendarPlus size={22} /></span>
          <strong>Create an Event QR</strong>
          <p>Choose a Google Calendar event, paste a Luma link, upload an invite, or type one manually.</p>
          <small>Start here <ArrowRight size={13} /></small>
        </button>
        <button className="qr-home-action-card" onClick={onOpenCards}>
          <span><IdCard size={22} /></span>
          <strong>My QR cards</strong>
          <p>Show, download or share your Personal, Event and Custom contact cards.</p>
          <small>Open cards <ArrowRight size={13} /></small>
        </button>
        <button className="qr-home-action-card" onClick={onExchange}>
          <span><ScanLine size={22} /></span>
          <strong>Exchange cards</strong>
          <p>Open a scanned card, save the encounter, then share your own card back.</p>
          <small>Exchange now <ArrowRight size={13} /></small>
        </button>
        <button className="qr-home-action-card" onClick={onOpenContacts}>
          <span><ContactRound size={22} /></span>
          <strong>Contacts and memories</strong>
          <p>{entities.length ? `${entities.length} saved ${entities.length === 1 ? 'contact' : 'contacts'} with meeting context.` : 'Your saved contacts and where you met will live here.'}</p>
          <small>Open contacts <ArrowRight size={13} /></small>
        </button>
      </section>

      <FollowUpPreview entities={entities} onOpenContacts={onOpenContacts} />

      <section className={`panel calendar-front-door${calendarConnected ? ' connected' : ''}`}>
        <div className="calendar-front-door-icon">{calendarConnected ? <CalendarCheck size={24} /> : <CalendarPlus size={24} />}</div>
        <div>
          <span className="eyebrow">Google Calendar</span>
          <h3>{calendarConnected ? 'Calendar is connected and ready' : 'Connect Google to find the event automatically'}</h3>
          <p>{calendarConnected ? 'TagOnce can suggest what is happening now or starting soon, using read-only access.' : 'One Google setup creates your personal profile and gives TagOnce read-only event access.'}</p>
        </div>
        <button className={`button ${calendarConnected ? 'secondary' : 'primary'}`} onClick={calendarConnected ? onOpenEvents : onConnectGoogle}>
          {calendarConnected ? 'View events' : 'Continue with Google'} <ArrowRight size={15} />
        </button>
      </section>

      <section className="panel beta-studio-card">
        <div className="beta-studio-icon"><Beaker size={22} /></div>
        <div>
          <span className="eyebrow">Separate beta mode</span>
          <h3>Post Studio</h3>
          <p>The original “write once, adapt and tag across platforms” concept still exists, but it no longer competes with the QR exchange product.</p>
          <span className="beta-studio-stats"><UsersRound size={14} /> {entities.length} saved identities · {campaigns.length} beta campaigns</span>
        </div>
        <button className="button secondary" onClick={onOpenBeta}>Open Beta Studio <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}

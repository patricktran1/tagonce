import {
  CalendarDays,
  ContactRound,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import { socialPlatformMeta, socialProfileUrl } from '../data/socials';
import { downloadVCard } from '../lib/cardExchange';
import type { ShareCardPayload, SharedSocialIdentity, SocialPlatform } from '../types';
import { PlatformMark } from './PlatformMark';
import { ProfileAvatar } from './ProfileAvatar';

interface RecipientProfileCardProps {
  payload: ShareCardPayload;
}

function safeHttpUrl(value?: string) {
  if (!value) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function whatsappUrl(value?: string) {
  if (!value) return '';
  const directUrl = safeHttpUrl(value);
  if (/^https?:\/\//i.test(value) && directUrl) return directUrl;
  const digits = value.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function eventTimeSummary(payload: ShareCardPayload) {
  if (!payload.eventStartAt) return '';
  const start = new Date(payload.eventStartAt);
  if (Number.isNaN(start.getTime())) return '';
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = payload.eventEndAt ? new Date(payload.eventEndAt) : null;
  return end && !Number.isNaN(end.getTime())
    ? `${day.format(start)} · ${time.format(start)}–${time.format(end)}`
    : `${day.format(start)} · ${time.format(start)}`;
}

function closeCard() {
  const url = new URL(window.location.href);
  url.searchParams.delete('card');
  window.location.assign(url.toString());
}

export function RecipientProfileCard({ payload }: RecipientProfileCardProps) {
  const { profile } = payload;
  const company = profile.company?.trim() || 'Company name';
  const website = safeHttpUrl(profile.website);
  const whatsapp = whatsappUrl(profile.whatsapp);
  const phone = profile.phone?.trim() || '';
  const eventUrl = safeHttpUrl(payload.eventUrl);
  const eventTime = eventTimeSummary(payload);
  const socialEntries = (Object.entries(payload.socials) as Array<[SocialPlatform, SharedSocialIdentity]>)
    .map(([platform, identity]) => ({
      platform,
      url: socialProfileUrl(platform, identity),
      label: socialPlatformMeta[platform].label,
    }))
    .filter((entry) => Boolean(entry.url));

  return (
    <section id="tagonce-recipient-card" className="recipient-profile-card" aria-label={`${profile.displayName} contact card`}>
      <span className="recipient-company-watermark" aria-hidden="true">{company}</span>
      <div className="recipient-profile-topline">
        <ProfileAvatar
          name={profile.displayName}
          src={profile.avatarUrl}
          className="recipient-profile-photo"
          alt={`${profile.displayName} profile photo`}
        />
        <button className="recipient-card-close" type="button" onClick={closeCard} aria-label="Close card">
          <X size={21} />
        </button>
      </div>

      <div className="recipient-profile-identity">
        <small>TagOnce contact</small>
        <h2>{profile.displayName}</h2>
        <p>{[profile.title, profile.company].filter(Boolean).join(' · ') || 'Contact card'}</p>
      </div>

      <div className="recipient-connect-actions" aria-label="Ways to connect">
        {profile.email && (
          <a href={`mailto:${profile.email}`}><Mail size={20} /><span>Email</span></a>
        )}
        {phone && (
          <a href={`tel:${phone}`}><Phone size={20} /><span>Call</span></a>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={20} /><span>WhatsApp</span></a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noreferrer"><Globe2 size={20} /><span>Website</span></a>
        )}
        {socialEntries.map(({ platform, url, label }) => (
          <a href={url} target="_blank" rel="noreferrer" key={platform}>
            <PlatformMark platform={platform} size="sm" />
            <span>{label}</span>
          </a>
        ))}
        <button type="button" onClick={() => downloadVCard(payload)}>
          <ContactRound size={20} /><span>Save contact</span>
        </button>
      </div>

      {payload.eventName && (
        <div className="recipient-event-panel">
          <span className="recipient-event-title"><CalendarDays size={18} /><strong>{payload.eventName}</strong></span>
          {eventTime && <span><CalendarDays size={15} /> {eventTime}</span>}
          {payload.eventLocation && <span><MapPin size={15} /> {payload.eventLocation}</span>}
          {eventUrl && <a href={eventUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open event page</a>}
        </div>
      )}
    </section>
  );
}

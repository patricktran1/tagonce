import { ArrowRight, BellRing, CalendarClock, Mail, MessageCircle } from 'lucide-react';
import { useMemo } from 'react';
import {
  followUpDateLabel,
  followUpEmailUrl,
  followUpWhatsappUrl,
  pendingFollowUps,
} from '../lib/followUps';
import type { MentionEntity } from '../types';
import { ProfileAvatar } from './ProfileAvatar';

interface FollowUpPreviewProps {
  entities: MentionEntity[];
  onOpenContacts: () => void;
}

export function FollowUpPreview({ entities, onOpenContacts }: FollowUpPreviewProps) {
  const followUps = useMemo(() => pendingFollowUps(entities), [entities]);
  if (!followUps.length) return null;

  const urgent = followUps.filter((item) => item.state === 'overdue' || item.state === 'today').length;

  return (
    <section className="panel home-follow-up-panel">
      <div className="home-follow-up-heading">
        <span className="home-follow-up-icon"><BellRing size={21} /></span>
        <div>
          <span className="eyebrow">Next conversations</span>
          <h3>{urgent ? `${urgent} ${urgent === 1 ? 'follow-up needs' : 'follow-ups need'} attention` : `${followUps.length} follow-ups scheduled`}</h3>
          <p>Your contact history is useful when it nudges the relationship forward.</p>
        </div>
        <button className="button secondary" type="button" onClick={onOpenContacts}>Open queue <ArrowRight size={15} /></button>
      </div>

      <div className="home-follow-up-list">
        {followUps.slice(0, 3).map(({ entity, encounter, state }) => {
          const emailUrl = followUpEmailUrl(entity, encounter);
          const whatsappUrl = followUpWhatsappUrl(entity, encounter);
          return (
            <article className={`home-follow-up-item state-${state}`} key={`${entity.id}:${encounter.id}`}>
              <ProfileAvatar name={entity.displayName} src={entity.avatarUrl} className="home-follow-up-avatar" />
              <span>
                <strong>{entity.displayName}</strong>
                <small>{encounter.followUpNote || 'Follow up on your conversation'}</small>
                <em><CalendarClock size={12} /> {followUpDateLabel(encounter.followUpAt)}</em>
              </span>
              <div>
                {emailUrl && <a href={emailUrl} aria-label={`Email ${entity.displayName}`}><Mail size={16} /></a>}
                {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${entity.displayName}`}><MessageCircle size={16} /></a>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

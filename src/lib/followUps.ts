import { contactEncounters } from './contactHistory';
import type { ContactEncounter, MentionEntity } from '../types';

export type FollowUpState = 'overdue' | 'today' | 'upcoming' | 'completed';

export interface ContactFollowUp {
  entity: MentionEntity;
  encounter: ContactEncounter;
  dueAt: string;
  state: FollowUpState;
}

function validTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function dayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function followUpState(encounter: ContactEncounter, now = new Date()): FollowUpState {
  if (encounter.followUpCompletedAt) return 'completed';
  const due = validTime(encounter.followUpAt);
  if (!due) return 'upcoming';
  const dueDay = dayStart(new Date(due));
  const today = dayStart(now);
  if (dueDay < today) return 'overdue';
  if (dueDay === today) return 'today';
  return 'upcoming';
}

export function pendingFollowUps(entities: MentionEntity[], now = new Date()) {
  return entities
    .flatMap((entity) => contactEncounters(entity)
      .filter((encounter) => Boolean(encounter.followUpAt && !encounter.followUpCompletedAt))
      .map<ContactFollowUp>((encounter) => ({
        entity,
        encounter,
        dueAt: encounter.followUpAt || '',
        state: followUpState(encounter, now),
      })))
    .sort((left, right) => validTime(left.dueAt) - validTime(right.dueAt));
}

export function followUpDateLabel(value?: string, now = new Date()) {
  const time = validTime(value);
  if (!time) return 'No date';
  const due = new Date(time);
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000);
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(due);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return `Today · ${timeLabel}`;
  if (days === 1) return `Tomorrow · ${timeLabel}`;
  if (days < 7) return new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(due);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(due);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function followUpMessage(entity: MentionEntity, encounter: ContactEncounter) {
  const meeting = encounter.metAt?.trim();
  const nextStep = encounter.followUpNote?.trim();
  const greeting = `Hi ${firstName(entity.displayName)},`;
  const context = meeting ? `It was great meeting you at ${meeting}.` : 'It was great meeting you.';
  return [greeting, '', context, nextStep ? `I wanted to follow up about ${nextStep}.` : 'I wanted to follow up on our conversation.', '', 'Best,'].join('\n');
}

export function followUpEmailUrl(entity: MentionEntity, encounter: ContactEncounter) {
  if (!entity.email) return '';
  const subjectContext = encounter.metAt?.trim() || 'our conversation';
  const params = new URLSearchParams({
    subject: `Following up after ${subjectContext}`,
    body: followUpMessage(entity, encounter),
  });
  return `mailto:${entity.email}?${params.toString()}`;
}

export function followUpWhatsappUrl(entity: MentionEntity, encounter: ContactEncounter) {
  const value = entity.whatsapp || entity.phone;
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(followUpMessage(entity, encounter))}`;
}

export function followUpLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function followUpIsoFromLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function followUpFromNow(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

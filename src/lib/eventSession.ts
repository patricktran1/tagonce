import { contactEncounters, inferEncounterEventName } from './contactHistory';
import { loadExchangeReceipts } from './eventRecaps';
import type { MentionEntity, MyProfile } from '../types';

export const ACTIVE_EVENT_SESSION_KEY = 'tagonce.active-event-session.v1';

export interface ActiveEventSession {
  id: string;
  eventName: string;
  eventLocation?: string;
  eventStartAt?: string;
  eventEndAt?: string;
  eventUrl?: string;
  startedAt: string;
}

export interface ActiveEventSessionStats {
  peopleCount: number;
  encounterCount: number;
  sharedBackCount: number;
  pendingFollowUpCount: number;
  photoCount: number;
}

function normalize(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}

function validTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sessionId(eventName: string) {
  const slug = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'event';
  return `session_${slug}_${Date.now()}`;
}

export function eventSessionFromProfile(profile: MyProfile): ActiveEventSession | null {
  const eventName = profile.eventName.trim();
  if (!eventName) return null;
  return {
    id: sessionId(eventName),
    eventName,
    eventLocation: profile.eventLocation?.trim() || undefined,
    eventStartAt: profile.eventStartAt || undefined,
    eventEndAt: profile.eventEndAt || undefined,
    eventUrl: profile.eventUrl?.trim() || undefined,
    startedAt: new Date().toISOString(),
  };
}

export function loadActiveEventSession(): ActiveEventSession | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_EVENT_SESSION_KEY) || 'null') as ActiveEventSession | null;
    return parsed?.eventName && parsed?.startedAt ? parsed : null;
  } catch {
    return null;
  }
}

export function saveActiveEventSession(session: ActiveEventSession | null) {
  if (!session) {
    window.localStorage.removeItem(ACTIVE_EVENT_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_EVENT_SESSION_KEY, JSON.stringify(session));
}

export function sessionMeetingContext(session: ActiveEventSession) {
  return [session.eventName, session.eventLocation].filter(Boolean).join(' · ');
}

export function attachEventSessionToContact(
  entity: MentionEntity,
  session: ActiveEventSession | null,
): MentionEntity {
  if (!session) return entity;
  const context = sessionMeetingContext(session);
  const encounters = entity.encounters?.length
    ? entity.encounters.map((encounter, index) => index === 0
      ? {
          ...encounter,
          eventName: session.eventName,
          metAt: context,
          sourceCardMode: 'event' as const,
        }
      : encounter)
    : entity.encounters;
  return {
    ...entity,
    eventName: session.eventName,
    metAt: context,
    sourceCardMode: 'event',
    encounters,
  };
}

export function activeEventSessionStats(
  session: ActiveEventSession,
  entities: MentionEntity[],
): ActiveEventSessionStats {
  const sessionStart = validTime(session.startedAt);
  const eventKey = normalize(session.eventName);
  const people = new Map<string, MentionEntity>();
  const encounters = entities.flatMap((entity) => contactEncounters(entity)
    .filter((encounter) => normalize(inferEncounterEventName(encounter)) === eventKey)
    .filter((encounter) => !sessionStart || validTime(encounter.metOn) >= sessionStart)
    .map((encounter) => {
      people.set(entity.id, entity);
      return { entity, encounter };
    }));

  const personNames = new Set(Array.from(people.values()).map((entity) => normalize(entity.displayName)));
  const sharedBackNames = new Set(
    loadExchangeReceipts()
      .filter((receipt) => normalize(receipt.eventName) === eventKey)
      .filter((receipt) => !sessionStart || validTime(receipt.sharedAt) >= sessionStart)
      .map((receipt) => normalize(receipt.incomingName))
      .filter((name) => personNames.has(name)),
  );

  return {
    peopleCount: people.size,
    encounterCount: encounters.length,
    sharedBackCount: sharedBackNames.size,
    pendingFollowUpCount: encounters.filter(({ encounter }) => Boolean(encounter.followUpAt && !encounter.followUpCompletedAt)).length,
    photoCount: encounters.filter(({ encounter }) => Boolean(encounter.memoryPhotoDataUrl)).length,
  };
}

export function activeEventDurationLabel(session: ActiveEventSession, now = new Date()) {
  const startedAt = validTime(session.startedAt);
  if (!startedAt) return 'Live now';
  const minutes = Math.max(0, Math.floor((now.getTime() - startedAt) / 60_000));
  if (minutes < 1) return 'Just started';
  if (minutes < 60) return `${minutes} min live`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m live` : `${hours}h live`;
}

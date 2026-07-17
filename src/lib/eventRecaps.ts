import { contactEncounters, inferEncounterEventName } from './contactHistory';
import type { ContactEncounter, MentionEntity } from '../types';

const RECEIPT_KEY = 'tagonce.exchange.receipts.v1';

interface ExchangeReceipt {
  incomingName: string;
  eventName?: string;
  sharedAt: string;
}

export interface EventRecapPerson {
  entity: MentionEntity;
  encounters: ContactEncounter[];
  latestEncounter: ContactEncounter;
  sharedBack: boolean;
  pendingFollowUps: number;
  completedFollowUps: number;
}

export interface EventRecap {
  id: string;
  name: string;
  latestAt: string;
  people: EventRecapPerson[];
  encounterCount: number;
  sharedBackCount: number;
  pendingFollowUpCount: number;
  completedFollowUpCount: number;
  photoCount: number;
  noteCount: number;
}

function normalize(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}

function validTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function loadExchangeReceipts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECEIPT_KEY) || '{}') as Record<string, ExchangeReceipt>;
    return Object.values(parsed).filter((receipt) => Boolean(receipt?.incomingName && receipt?.sharedAt));
  } catch {
    return [];
  }
}

function receiptMatches(receipt: ExchangeReceipt, eventName: string, entity: MentionEntity) {
  return normalize(receipt.eventName) === normalize(eventName)
    && normalize(receipt.incomingName) === normalize(entity.displayName);
}

export function buildEventRecaps(
  entities: MentionEntity[],
  receipts: ExchangeReceipt[] = typeof window === 'undefined' ? [] : loadExchangeReceipts(),
) {
  const groups = new Map<string, {
    name: string;
    latestAt: string;
    people: Map<string, { entity: MentionEntity; encounters: ContactEncounter[] }>;
  }>();

  entities.forEach((entity) => {
    contactEncounters(entity).forEach((encounter) => {
      const eventName = inferEncounterEventName(encounter);
      if (!eventName) return;
      const key = normalize(eventName);
      if (!key) return;
      const existing = groups.get(key) || {
        name: eventName,
        latestAt: encounter.metOn,
        people: new Map<string, { entity: MentionEntity; encounters: ContactEncounter[] }>(),
      };
      if (validTime(encounter.metOn) > validTime(existing.latestAt)) {
        existing.latestAt = encounter.metOn;
        existing.name = eventName;
      }
      const person = existing.people.get(entity.id) || { entity, encounters: [] };
      person.encounters.push(encounter);
      person.encounters.sort((left, right) => validTime(right.metOn) - validTime(left.metOn));
      existing.people.set(entity.id, person);
      groups.set(key, existing);
    });
  });

  return Array.from(groups.entries())
    .map<EventRecap>(([id, group]) => {
      const people = Array.from(group.people.values())
        .map<EventRecapPerson>(({ entity, encounters }) => {
          const pendingFollowUps = encounters.filter((encounter) => Boolean(encounter.followUpAt && !encounter.followUpCompletedAt)).length;
          const completedFollowUps = encounters.filter((encounter) => Boolean(encounter.followUpCompletedAt)).length;
          return {
            entity,
            encounters,
            latestEncounter: encounters[0],
            sharedBack: receipts.some((receipt) => receiptMatches(receipt, group.name, entity)),
            pendingFollowUps,
            completedFollowUps,
          };
        })
        .sort((left, right) => validTime(right.latestEncounter.metOn) - validTime(left.latestEncounter.metOn));
      const allEncounters = people.flatMap((person) => person.encounters);
      return {
        id,
        name: group.name,
        latestAt: group.latestAt,
        people,
        encounterCount: allEncounters.length,
        sharedBackCount: people.filter((person) => person.sharedBack).length,
        pendingFollowUpCount: people.reduce((total, person) => total + person.pendingFollowUps, 0),
        completedFollowUpCount: people.reduce((total, person) => total + person.completedFollowUps, 0),
        photoCount: allEncounters.filter((encounter) => Boolean(encounter.memoryPhotoDataUrl)).length,
        noteCount: allEncounters.filter((encounter) => Boolean(encounter.notes?.trim())).length,
      };
    })
    .sort((left, right) => validTime(right.latestAt) - validTime(left.latestAt));
}

export function eventRecapText(recap: EventRecap) {
  const heading = `${recap.name} recap`;
  const summary = `${recap.people.length} ${recap.people.length === 1 ? 'person' : 'people'} met · ${recap.sharedBackCount} shared back · ${recap.pendingFollowUpCount} follow-ups pending`;
  const people = recap.people.map((person) => {
    const detail = person.entity.company || person.entity.title || person.latestEncounter.notes || 'TagOnce contact';
    const states = [
      person.sharedBack ? 'shared back' : '',
      person.pendingFollowUps ? `${person.pendingFollowUps} follow-up pending` : '',
      person.completedFollowUps ? `${person.completedFollowUps} completed` : '',
    ].filter(Boolean).join(', ');
    return `• ${person.entity.displayName} — ${detail}${states ? ` (${states})` : ''}`;
  });
  return [heading, summary, '', ...people].join('\n');
}

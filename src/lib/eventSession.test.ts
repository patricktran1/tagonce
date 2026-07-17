// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { MentionEntity, MyProfile } from '../types';
import {
  activeEventSessionStats,
  attachEventSessionToContact,
  eventSessionFromProfile,
  sessionMeetingContext,
  type ActiveEventSession,
} from './eventSession';

const profile: MyProfile = {
  displayName: 'Patrick Tran',
  title: 'Founder',
  company: 'TagOnce',
  email: 'patrick@example.com',
  phone: '',
  whatsapp: '',
  website: '',
  avatarUrl: '',
  eventName: 'AGI Summit',
  eventEndsAt: '2026-07-18',
  eventStartAt: '2026-07-18T17:00:00.000Z',
  eventEndAt: '2026-07-18T23:00:00.000Z',
  eventLocation: 'San Francisco',
  eventUrl: '',
  eventDescription: '',
};

const session: ActiveEventSession = {
  id: 'session_agi',
  eventName: 'AGI Summit',
  eventLocation: 'San Francisco',
  startedAt: '2026-07-18T17:00:00.000Z',
};

function contact(id: string, name: string, metOn: string): MentionEntity {
  return {
    id,
    displayName: name,
    type: 'person',
    initials: name.split(' ').map((part) => part[0]).join(''),
    mappings: {},
    usageCount: 0,
    createdAt: metOn,
    metOn,
    sourceCardMode: 'personal',
  };
}

describe('live event sessions', () => {
  beforeEach(() => window.localStorage.clear());

  it('creates a session from the prepared Event QR profile', () => {
    const created = eventSessionFromProfile(profile);
    expect(created?.eventName).toBe('AGI Summit');
    expect(created?.eventLocation).toBe('San Francisco');
    expect(sessionMeetingContext(created!)).toBe('AGI Summit · San Francisco');
  });

  it('attributes a scanned personal card to the active event', () => {
    const attached = attachEventSessionToContact(
      contact('contact_1', 'Melly Liu', '2026-07-18T18:00:00.000Z'),
      session,
    );
    expect(attached.eventName).toBe('AGI Summit');
    expect(attached.metAt).toBe('AGI Summit · San Francisco');
    expect(attached.sourceCardMode).toBe('event');
  });

  it('counts only encounters created during the active session', () => {
    const current = attachEventSessionToContact(
      contact('contact_1', 'Melly Liu', '2026-07-18T18:00:00.000Z'),
      session,
    );
    const old = {
      ...attachEventSessionToContact(
        contact('contact_2', 'Old Contact', '2026-07-17T18:00:00.000Z'),
        session,
      ),
      metOn: '2026-07-17T18:00:00.000Z',
    };
    const otherEvent = {
      ...contact('contact_3', 'Other Event', '2026-07-18T18:30:00.000Z'),
      eventName: 'Founders Bay',
      metAt: 'Founders Bay',
      sourceCardMode: 'event' as const,
    };

    const stats = activeEventSessionStats(session, [current, old, otherEvent]);
    expect(stats.peopleCount).toBe(1);
    expect(stats.encounterCount).toBe(1);
  });
});

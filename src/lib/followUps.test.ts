// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { MentionEntity } from '../types';
import {
  followUpDateLabel,
  followUpEmailUrl,
  followUpState,
  followUpWhatsappUrl,
  pendingFollowUps,
} from './followUps';

const now = new Date('2026-07-17T12:00:00.000Z');

function contact(overrides: Partial<MentionEntity> = {}): MentionEntity {
  return {
    id: 'contact_1',
    displayName: 'Melly Liu',
    type: 'person',
    email: 'melly@example.com',
    whatsapp: '+1 415 555 0100',
    initials: 'ML',
    mappings: {},
    usageCount: 0,
    createdAt: '2026-07-16T18:00:00.000Z',
    encounters: [{
      id: 'encounter_1',
      metAt: 'AGI Summit',
      metOn: '2026-07-16T18:00:00.000Z',
      followUpAt: '2026-07-17T17:00:00.000Z',
      followUpNote: 'send the hackathon details',
    }],
    ...overrides,
  };
}

describe('TagOnce follow-ups', () => {
  it('classifies and sorts pending follow-ups by due time', () => {
    const later = contact({
      id: 'contact_2',
      displayName: 'Later Person',
      encounters: [{
        id: 'encounter_2',
        metOn: '2026-07-16T18:00:00.000Z',
        followUpAt: '2026-07-20T17:00:00.000Z',
      }],
    });
    const items = pendingFollowUps([later, contact()], now);

    expect(items.map((item) => item.entity.id)).toEqual(['contact_1', 'contact_2']);
    expect(items[0].state).toBe('today');
    expect(followUpState(items[1].encounter, now)).toBe('upcoming');
  });

  it('excludes completed follow-ups', () => {
    const completed = contact({
      encounters: [{
        id: 'encounter_1',
        metOn: '2026-07-16T18:00:00.000Z',
        followUpAt: '2026-07-17T17:00:00.000Z',
        followUpCompletedAt: '2026-07-17T16:00:00.000Z',
      }],
    });
    expect(pendingFollowUps([completed], now)).toHaveLength(0);
  });

  it('builds contextual email and WhatsApp outreach links', () => {
    const entity = contact();
    const encounter = entity.encounters?.[0];
    expect(encounter).toBeDefined();
    if (!encounter) return;

    expect(followUpEmailUrl(entity, encounter)).toContain('mailto:melly@example.com');
    expect(followUpEmailUrl(entity, encounter)).toContain('AGI+Summit');
    expect(followUpWhatsappUrl(entity, encounter)).toContain('wa.me/14155550100');
    expect(followUpWhatsappUrl(entity, encounter)).toContain('hackathon%20details');
    expect(followUpDateLabel(encounter.followUpAt, now)).toContain('Today');
  });
});

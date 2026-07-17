import { describe, expect, it } from 'vitest';
import type { MentionEntity } from '../types';
import { buildEventRecaps, eventRecapText } from './eventRecaps';

function contact(overrides: Partial<MentionEntity>): MentionEntity {
  return {
    id: 'contact_1',
    displayName: 'Melly Liu',
    type: 'person',
    initials: 'ML',
    mappings: {},
    usageCount: 0,
    createdAt: '2026-07-17T18:00:00.000Z',
    ...overrides,
  };
}

describe('event recaps', () => {
  it('groups event encounters, exchange receipts and follow-ups into one session', () => {
    const entities = [
      contact({
        company: 'Founder Bay',
        encounters: [
          {
            id: 'encounter_1',
            metOn: '2026-07-17T18:00:00.000Z',
            metAt: 'Founders Bay · San Francisco',
            sourceCardMode: 'event',
            notes: 'Discussed her hackathon.',
            followUpAt: '2026-07-19T17:00:00.000Z',
          },
        ],
      }),
      contact({
        id: 'contact_2',
        displayName: 'Alex Chen',
        initials: 'AC',
        encounters: [
          {
            id: 'encounter_2',
            metOn: '2026-07-17T19:00:00.000Z',
            eventName: 'Founders Bay',
            metAt: 'Founders Bay',
            sourceCardMode: 'event',
            followUpCompletedAt: '2026-07-18T19:00:00.000Z',
          },
        ],
      }),
    ];

    const recaps = buildEventRecaps(entities, [
      { incomingName: 'Melly Liu', eventName: 'Founders Bay', sharedAt: '2026-07-17T18:05:00.000Z' },
    ]);

    expect(recaps).toHaveLength(1);
    expect(recaps[0].name).toBe('Founders Bay');
    expect(recaps[0].people).toHaveLength(2);
    expect(recaps[0].sharedBackCount).toBe(1);
    expect(recaps[0].pendingFollowUpCount).toBe(1);
    expect(recaps[0].completedFollowUpCount).toBe(1);
    expect(recaps[0].noteCount).toBe(1);
    expect(eventRecapText(recaps[0])).toContain('Melly Liu');
  });

  it('keeps separate events separate and orders the newest event first', () => {
    const entities = [contact({
      encounters: [
        { id: 'older', metOn: '2026-07-10T18:00:00.000Z', eventName: 'Older Event', sourceCardMode: 'event' },
        { id: 'newer', metOn: '2026-07-20T18:00:00.000Z', eventName: 'Newer Event', sourceCardMode: 'event' },
      ],
    })];

    const recaps = buildEventRecaps(entities, []);
    expect(recaps.map((recap) => recap.name)).toEqual(['Newer Event', 'Older Event']);
  });
});

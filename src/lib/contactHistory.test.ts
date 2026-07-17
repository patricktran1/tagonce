import { describe, expect, it } from 'vitest';
import type { MentionEntity } from '../types';
import { contactEncounters, contactsMatch, mergeContactRecords, prepareContactRecord } from './contactHistory';

function contact(overrides: Partial<MentionEntity> = {}): MentionEntity {
  return {
    id: overrides.id || 'contact_1',
    displayName: 'Alex Kim',
    type: 'person',
    initials: 'AK',
    mappings: {},
    usageCount: 0,
    createdAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('contact encounter history', () => {
  it('migrates a legacy single-memory contact into an encounter timeline', () => {
    const prepared = prepareContactRecord(contact({
      metAt: 'AGI Summit',
      metOn: '2026-07-10T18:00:00.000Z',
      notes: 'Discussed agent infrastructure.',
    }));

    expect(prepared.encounters).toHaveLength(1);
    expect(prepared.encounters?.[0].metAt).toBe('AGI Summit');
  });

  it('adds a new meeting without losing the earlier encounter', () => {
    const existing = prepareContactRecord(contact({
      metAt: 'Founders Bay',
      metOn: '2026-07-10T18:00:00.000Z',
      notes: 'Met after the workshop.',
    }));
    const incoming = contact({
      id: 'contact_2',
      metAt: 'AGI Summit',
      metOn: '2026-07-17T18:00:00.000Z',
      notes: 'Follow up about the demo.',
    });

    const merged = mergeContactRecords(existing, incoming);

    expect(contactEncounters(merged)).toHaveLength(2);
    expect(merged.metAt).toBe('AGI Summit');
    expect(merged.notes).toBe('Follow up about the demo.');
  });

  it('matches stable identifiers before names', () => {
    expect(contactsMatch(
      contact({ email: 'alex@example.com' }),
      contact({ id: 'contact_2', displayName: 'Alexander Kim', email: 'ALEX@example.com' }),
    )).toBe(true);
  });

  it('does not merge same-name people with conflicting stable identifiers', () => {
    expect(contactsMatch(
      contact({ email: 'alex.one@example.com' }),
      contact({ id: 'contact_2', email: 'alex.two@example.com' }),
    )).toBe(false);
  });
});

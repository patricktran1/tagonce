// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { BrandSettings, MentionEntity, MyProfile, SocialConnection } from '../types';
import {
  applyWorkspaceBackup,
  createWorkspaceBackup,
  parseWorkspaceBackupText,
  summarizeWorkspaceBackup,
} from './workspaceTransfer';

const profile: MyProfile = {
  displayName: 'Patrick Tran',
  title: 'Founder',
  company: 'TagOnce',
  email: 'patrick@example.com',
  phone: '',
  whatsapp: '',
  website: 'https://tagonce.vercel.app',
  avatarUrl: '',
  eventName: 'AGI Summit',
  eventEndsAt: '2026-07-18',
  eventStartAt: '2026-07-18T17:00:00.000Z',
  eventEndAt: '2026-07-18T23:00:00.000Z',
  eventLocation: 'San Francisco',
  eventUrl: '',
  eventDescription: '',
  cardSelections: { event: ['email', 'eventName', 'social:linkedin'] },
  socialProfiles: { linkedin: { handle: 'drpatricktran' } },
};

const contact: MentionEntity = {
  id: 'contact_1',
  displayName: 'Melly Liu',
  type: 'person',
  email: 'melly@example.com',
  initials: 'ML',
  mappings: {},
  usageCount: 0,
  createdAt: '2026-07-17T18:00:00.000Z',
  encounters: [
    { id: 'encounter_1', metAt: 'Founders Bay', metOn: '2026-07-17T18:00:00.000Z', notes: 'Follow up after the summit.' },
    { id: 'encounter_2', metAt: 'AGI Summit', metOn: '2026-07-18T18:00:00.000Z' },
  ],
};

const brand: BrandSettings = {
  brandName: 'TagOnce',
  audience: 'Event attendees',
  voice: 'Direct',
  defaultCta: 'Connect',
  preferredHashtags: '#TagOnce',
};

const connections: SocialConnection[] = [
  { platform: 'linkedin', connected: true, handle: 'drpatricktran' },
];

describe('TagOnce workspace transfer', () => {
  beforeEach(() => window.localStorage.clear());

  it('exports profile, contacts, encounters and settings in a versioned backup', () => {
    window.localStorage.setItem('tagonce.profile.v1', JSON.stringify(profile));
    window.localStorage.setItem('tagonce.entities.v1', JSON.stringify([contact]));
    window.localStorage.setItem('tagonce.brand.v1', JSON.stringify(brand));
    window.localStorage.setItem('tagonce.connections.v1', JSON.stringify(connections));

    const backup = createWorkspaceBackup();
    const summary = summarizeWorkspaceBackup(backup);

    expect(backup.format).toBe('tagonce-workspace');
    expect(backup.version).toBe(1);
    expect(backup.data.profile?.displayName).toBe('Patrick Tran');
    expect(summary.contacts).toBe(1);
    expect(summary.encounters).toBe(2);
  });

  it('rejects unrelated JSON files', () => {
    expect(() => parseWorkspaceBackupText('{"hello":"world"}')).toThrow('supported TagOnce backup');
  });

  it('merges imported records by stable ids and platforms', () => {
    window.localStorage.setItem('tagonce.entities.v1', JSON.stringify([{ ...contact, id: 'current_contact', displayName: 'Current Person' }]));
    window.localStorage.setItem('tagonce.connections.v1', JSON.stringify([{ platform: 'instagram', connected: true, handle: 'current' }]));

    const backup = {
      ...createWorkspaceBackup(),
      data: {
        profile,
        entities: [contact],
        campaigns: [],
        brand,
        connections,
        exchangeReceipts: { receipt_1: { completed: true } },
      },
    };

    applyWorkspaceBackup(backup, 'merge');

    const mergedContacts = JSON.parse(window.localStorage.getItem('tagonce.entities.v1') || '[]') as MentionEntity[];
    const mergedConnections = JSON.parse(window.localStorage.getItem('tagonce.connections.v1') || '[]') as SocialConnection[];
    expect(mergedContacts.map((entity) => entity.id).sort()).toEqual(['contact_1', 'current_contact']);
    expect(mergedConnections.map((connection) => connection.platform).sort()).toEqual(['instagram', 'linkedin']);
    expect(JSON.parse(window.localStorage.getItem('tagonce.profile.v1') || '{}').displayName).toBe('Patrick Tran');
  });
});

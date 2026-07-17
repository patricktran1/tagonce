// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { ShareCardPayload } from '../types';
import { decodeCardPayload, encodeCardPayload } from './cardExchange';

const payload: ShareCardPayload = {
  version: 1,
  mode: 'event',
  createdAt: '2026-07-17T16:00:00.000Z',
  eventName: 'Founders Bay Virtual Workshop: Investing in AI: Moats & the AI Workforce',
  eventStartAt: '2026-07-16T18:00:00.000Z',
  eventEndAt: '2026-07-16T19:00:00.000Z',
  eventLocation: 'https://luma.com/join/g-QUR9ejAFbXDUQHD',
  eventUrl: 'https://www.google.com/calendar/event?eid=example-event-identifier',
  profile: {
    displayName: 'Patrick Trần',
    avatarUrl: 'https://lh3.googleusercontent.com/a/long-google-profile-photo-url-that-travels-with-the-card',
    title: 'Founder',
    company: 'TagOnce',
    email: 'patrick@example.com',
    phone: '+1 415 555 0100',
    whatsapp: '+1 415 555 0100',
    website: 'https://tagonce.vercel.app',
  },
  socials: {
    linkedin: { handle: 'drpatricktran', profileUrl: 'https://www.linkedin.com/in/drpatricktran/' },
    github: { handle: 'patricktran1', profileUrl: 'https://github.com/patricktran1' },
    x: { handle: 'nrg_kundalini', profileUrl: 'https://x.com/nrg_kundalini' },
  },
};

function legacyTokenFor(value: ShareCardPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('TagOnce QR card encoding', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips a compressed card without losing shared fields', () => {
    const token = encodeCardPayload(payload);

    expect(token.startsWith('z1~')).toBe(true);
    expect(decodeCardPayload(token)).toEqual(payload);
  });

  it('creates a materially shorter token than the legacy raw JSON encoding', () => {
    const token = encodeCardPayload(payload);
    const legacyToken = legacyTokenFor(payload);

    expect(token.length).toBeLessThan(legacyToken.length * 0.75);
  });

  it('continues to open previously issued legacy cards and removes expiration', () => {
    const legacyPayload: ShareCardPayload = {
      ...payload,
      expiresAt: '2026-07-16T19:00:00.000Z',
    };

    const decoded = decodeCardPayload(legacyTokenFor(legacyPayload));

    expect(decoded.profile.displayName).toBe(payload.profile.displayName);
    expect(decoded.eventName).toBe(payload.eventName);
    expect(decoded.expiresAt).toBeUndefined();
  });
});

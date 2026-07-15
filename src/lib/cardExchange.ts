import type { ShareCardPayload } from '../types';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeCardPayload(payload: ShareCardPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeCardPayload(encoded: string): ShareCardPayload {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = new TextDecoder().decode(base64ToBytes(padded));
  const payload = JSON.parse(decoded) as ShareCardPayload;
  if (payload.version !== 1 || !payload.profile?.displayName || !payload.mode) {
    throw new Error('This is not a valid TagOnce card.');
  }
  return payload;
}

export function extractCardToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get('card') ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function createShareUrl(payload: ShareCardPayload) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('card', encodeCardPayload(payload));
  return url.toString();
}

function escapeVCard(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function createVCard(payload: ShareCardPayload) {
  const { profile, socials } = payload;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(profile.displayName)}`,
  ];

  if (profile.company) lines.push(`ORG:${escapeVCard(profile.company)}`);
  if (profile.title) lines.push(`TITLE:${escapeVCard(profile.title)}`);
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}`);
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(profile.phone)}`);
  if (profile.website) lines.push(`URL:${escapeVCard(profile.website)}`);
  if (profile.whatsapp) lines.push(`X-WHATSAPP:${escapeVCard(profile.whatsapp)}`);

  Object.entries(socials).forEach(([platform, identity]) => {
    const profileUrl = identity?.profileUrl;
    const handle = identity?.handle;
    if (profileUrl) {
      lines.push(`X-SOCIALPROFILE;TYPE=${platform}:${escapeVCard(profileUrl)}`);
    } else if (handle) {
      lines.push(`X-SOCIALPROFILE;TYPE=${platform}:${escapeVCard(handle)}`);
    }
  });

  const context = payload.mode === 'event' && payload.eventName
    ? `Shared through TagOnce at ${payload.eventName}`
    : 'Shared through TagOnce';
  lines.push(`NOTE:${escapeVCard(context)}`, 'END:VCARD');
  return lines.join('\r\n');
}

export function downloadVCard(payload: ShareCardPayload) {
  const blob = new Blob([createVCard(payload)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = payload.profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  anchor.href = url;
  anchor.download = `${safeName || 'tagonce-contact'}.vcf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function compressImage(file: File, maxDimension = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The photo could not be loaded.'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Photo processing is unavailable.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

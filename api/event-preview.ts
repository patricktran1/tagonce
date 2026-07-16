type EventPreview = {
  ok: boolean;
  url: string;
  sourceHost: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  description: string;
  imageUrl: string;
  confidence: 'high' | 'medium' | 'low';
  sourceKind: 'json-ld' | 'embedded-json' | 'metadata';
  warnings: string[];
  error?: string;
};

type EventCandidate = {
  title?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  location?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  url?: unknown;
  score: number;
  sourceKind: EventPreview['sourceKind'];
};

const MAX_HTML_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

function safeUrl(raw: string, base?: URL) {
  const parsed = base ? new URL(raw, base) : new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only public http or https event links are supported.');
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname === '::1'
    || hostname.startsWith('fc')
    || hostname.startsWith('fd')
    || hostname.startsWith('fe80:')
    || isPrivateIpv4(hostname)
  ) {
    throw new Error('That address is not a public event page.');
  }
  parsed.hash = '';
  return parsed;
}

async function fetchPublicPage(initialUrl: URL) {
  let current = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.6',
        'User-Agent': 'Mozilla/5.0 (compatible; TagOnceEventPreview/1.0; +https://tagonce.vercel.app)',
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The event page returned an incomplete redirect.');
      current = safeUrl(location, current);
      continue;
    }

    if (!response.ok) throw new Error(`The event page returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('That link did not return an HTML event page.');
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error('That event page is too large to preview safely.');
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { html, finalUrl: current };
  }
  throw new Error('The event link redirected too many times.');
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function cleanText(value: unknown, max = 1200) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return decodeEntities(String(value))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function dateValue(value: unknown) {
  if (typeof value === 'number') {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function imageValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return imageValue(value[0]);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return cleanText(object.url || object.contentUrl, 1000);
  }
  return '';
}

function locationValue(value: unknown): string {
  if (typeof value === 'string') return cleanText(value, 500);
  if (!value || typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  const address = object.address;
  const pieces = [
    object.name,
    object.venue_name,
    object.description,
    object.full_address,
    typeof address === 'string' ? address : undefined,
  ];
  if (address && typeof address === 'object') {
    const addressObject = address as Record<string, unknown>;
    pieces.push(
      addressObject.streetAddress,
      addressObject.addressLocality,
      addressObject.addressRegion,
      addressObject.postalCode,
      addressObject.addressCountry,
    );
  }
  const geoAddress = object.geo_address_info;
  if (geoAddress && typeof geoAddress === 'object') {
    const geo = geoAddress as Record<string, unknown>;
    pieces.push(geo.name, geo.address, geo.full_address, geo.city, geo.region);
  }
  const unique = pieces.map((piece) => cleanText(piece, 300)).filter((piece, index, all) => piece && all.indexOf(piece) === index);
  return unique.slice(0, 4).join(', ');
}

function eventType(value: unknown) {
  if (typeof value === 'string') return value.toLowerCase().includes('event');
  if (Array.isArray(value)) return value.some(eventType);
  return false;
}

function objectCandidate(object: Record<string, unknown>, sourceKind: EventPreview['sourceKind']): EventCandidate | null {
  const typedEvent = eventType(object['@type'] || object.type || object.objectType);
  const title = object.name || object.title || object.event_name || object.eventName || object.summary;
  const startAt = object.startDate || object.start_at || object.startAt || object.start_time || object.startTime || object.datetime;
  const endAt = object.endDate || object.end_at || object.endAt || object.end_time || object.endTime;
  const location = object.location || object.venue || object.geo_address_info || object.address;
  const hasEventShape = Boolean(title && (startAt || endAt || location));
  if (!typedEvent && !hasEventShape) return null;
  let score = typedEvent ? 50 : 18;
  if (title) score += 18;
  if (startAt) score += 22;
  if (endAt) score += 8;
  if (location) score += 12;
  if (object.description) score += 4;
  return {
    title,
    startAt,
    endAt,
    location,
    description: object.description || object.event_description || object.eventDescription,
    imageUrl: object.image || object.cover_url || object.coverUrl || object.photo,
    url: object.url || object.event_url || object.eventUrl,
    score,
    sourceKind,
  };
}

function collectCandidates(root: unknown, sourceKind: EventPreview['sourceKind']) {
  const candidates: EventCandidate[] = [];
  const seen = new WeakSet<object>();
  function walk(value: unknown, depth: number) {
    if (!value || depth > 9) return;
    if (Array.isArray(value)) {
      value.slice(0, 300).forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    const object = value as Record<string, unknown>;
    const candidate = objectCandidate(object, sourceKind);
    if (candidate) candidates.push(candidate);
    Object.values(object).slice(0, 350).forEach((item) => walk(item, depth + 1));
  }
  walk(root, 0);
  return candidates;
}

function tagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) attributes.set(match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  return attributes;
}

function metadata(html: string) {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0]);
    const key = (attributes.get('property') || attributes.get('name') || attributes.get('itemprop') || '').toLowerCase();
    const content = attributes.get('content') || '';
    if (key && content && !values.has(key)) values.set(key, content);
  }
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '', 300);
  const canonicalTag = html.match(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0] || '';
  const canonical = canonicalTag ? tagAttributes(canonicalTag).get('href') || '' : '';
  return { values, title, canonical };
}

function parsedScriptJson(html: string) {
  const results: Array<{ value: unknown; sourceKind: EventPreview['sourceKind'] }> = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = scriptPattern.exec(html)) && count < 80) {
    count += 1;
    const attributes = tagAttributes(`<script ${match[1]}>`);
    const type = (attributes.get('type') || '').toLowerCase();
    const id = (attributes.get('id') || '').toLowerCase();
    if (!type.includes('json') && id !== '__next_data__') continue;
    const raw = decodeEntities(match[2].trim()).replace(/^<!--|-->$/g, '').trim();
    if (!raw || raw.length > 1_500_000) continue;
    try {
      results.push({ value: JSON.parse(raw), sourceKind: type.includes('ld+json') ? 'json-ld' : 'embedded-json' });
    } catch {
      // Invalid or JavaScript-shaped data is ignored; metadata remains available as a fallback.
    }
  }
  return results;
}

function absoluteUrl(raw: string, pageUrl: URL) {
  if (!raw) return '';
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return '';
  }
}

function buildPreview(html: string, pageUrl: URL): EventPreview {
  const meta = metadata(html);
  const candidates = parsedScriptJson(html).flatMap(({ value, sourceKind }) => collectCandidates(value, sourceKind));
  candidates.sort((left, right) => right.score - left.score);
  const winner = candidates[0];
  const values = meta.values;
  const title = cleanText(winner?.title || values.get('og:title') || values.get('twitter:title') || meta.title, 300);
  const startAt = dateValue(winner?.startAt || values.get('event:start_time') || values.get('event:start') || values.get('startdate'));
  const endAt = dateValue(winner?.endAt || values.get('event:end_time') || values.get('event:end') || values.get('enddate'));
  const location = locationValue(winner?.location || values.get('event:location') || values.get('place:location'));
  const description = cleanText(winner?.description || values.get('og:description') || values.get('description') || values.get('twitter:description'), 1600);
  const imageUrl = absoluteUrl(imageValue(winner?.imageUrl) || values.get('og:image') || values.get('twitter:image') || '', pageUrl);
  const canonicalUrl = absoluteUrl(cleanText(winner?.url, 1000) || values.get('og:url') || meta.canonical, pageUrl) || pageUrl.toString();
  const warnings: string[] = [];
  if (!title) warnings.push('Event name was not found.');
  if (!startAt) warnings.push('Start time was not found.');
  if (!location) warnings.push('Venue was not found.');
  const confidence: EventPreview['confidence'] = winner?.score && winner.score >= 80
    ? 'high'
    : title && (startAt || location)
      ? 'medium'
      : 'low';
  return {
    ok: Boolean(title || startAt || location),
    url: canonicalUrl,
    sourceHost: pageUrl.hostname,
    title,
    startAt,
    endAt,
    location,
    description,
    imageUrl,
    confidence,
    sourceKind: winner?.sourceKind || 'metadata',
    warnings,
  };
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const raw = new URL(request.url).searchParams.get('url')?.trim() || '';
    if (!raw) return json({ ok: false, error: 'Paste an event link first.' }, 400);
    try {
      const initialUrl = safeUrl(raw);
      const { html, finalUrl } = await fetchPublicPage(initialUrl);
      const preview = buildPreview(html, finalUrl);
      if (!preview.ok) {
        return json({ ...preview, error: 'The page opened, but TagOnce could not identify event details. Enter them manually below.' }, 422);
      }
      return json(preview);
    } catch (error) {
      return json({
        ok: false,
        url: raw,
        sourceHost: '',
        title: '',
        startAt: '',
        endAt: '',
        location: '',
        description: '',
        imageUrl: '',
        confidence: 'low',
        sourceKind: 'metadata',
        warnings: [],
        error: error instanceof Error ? error.message : 'The event page could not be previewed.',
      }, 400);
    }
  },
};

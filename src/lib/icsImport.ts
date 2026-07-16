export interface ImportedCalendarEvent {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  description: string;
  url: string;
  allDay: boolean;
  sourceFile: string;
  warnings: string[];
}

interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface CalendarEventCandidate {
  fields: ContentLine[];
}

const MAX_ICS_BYTES = 2_000_000;

function unfoldLines(text: string) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function parseContentLine(line: string): ContentLine | null {
  const separator = line.indexOf(':');
  if (separator < 1) return null;
  const left = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const [rawName, ...rawParams] = left.split(';');
  const params: Record<string, string> = {};
  rawParams.forEach((entry) => {
    const equals = entry.indexOf('=');
    if (equals < 1) return;
    params[entry.slice(0, equals).toUpperCase()] = entry.slice(equals + 1).replace(/^"|"$/g, '');
  });
  return { name: rawName.toUpperCase(), params, value };
}

function decodeIcsText(value = '') {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function numericParts(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
    utc: Boolean(match[7]),
    hasTime: Boolean(match[4]),
  };
}

function zonedWallTimeToDate(parts: NonNullable<ReturnType<typeof numericParts>>, timeZone: string) {
  let timestamp = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const formatted = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
    );
    const represented = Date.UTC(
      Number(formatted.year),
      Number(formatted.month) - 1,
      Number(formatted.day),
      Number(formatted.hour),
      Number(formatted.minute),
      Number(formatted.second),
    );
    const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    timestamp += desired - represented;
  }
  return new Date(timestamp);
}

function parseDate(line: ContentLine | undefined, warnings: string[]) {
  if (!line) return { iso: '', allDay: false };
  const raw = line.value.trim();
  const parts = numericParts(raw);
  if (!parts) {
    warnings.push(`${line.name} used an unsupported date format.`);
    return { iso: '', allDay: false };
  }
  const allDay = line.params.VALUE?.toUpperCase() === 'DATE' || !parts.hasTime;
  let date: Date;

  if (parts.utc) {
    date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  } else if (line.params.TZID) {
    try {
      date = zonedWallTimeToDate(parts, line.params.TZID);
    } catch {
      warnings.push(`The time zone ${line.params.TZID} was not recognized; your device time zone was used.`);
      date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    }
  } else {
    date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  }

  return Number.isNaN(date.getTime())
    ? { iso: '', allDay }
    : { iso: date.toISOString(), allDay };
}

function parseDuration(value = '') {
  const match = value.trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 0;
  const weeks = Number(match[1] || 0);
  const days = Number(match[2] || 0);
  const hours = Number(match[3] || 0);
  const minutes = Number(match[4] || 0);
  const seconds = Number(match[5] || 0);
  return (((weeks * 7 + days) * 24 + hours) * 60 * 60 + minutes * 60 + seconds) * 1000;
}

function firstField(fields: ContentLine[], name: string) {
  return fields.find((field) => field.name === name);
}

function eventFromCandidate(candidate: CalendarEventCandidate, sourceFile: string): ImportedCalendarEvent | null {
  const warnings: string[] = [];
  const start = parseDate(firstField(candidate.fields, 'DTSTART'), warnings);
  const explicitEnd = parseDate(firstField(candidate.fields, 'DTEND'), warnings);
  const duration = parseDuration(firstField(candidate.fields, 'DURATION')?.value);
  let endAt = explicitEnd.iso;
  if (!endAt && start.iso && duration > 0) endAt = new Date(new Date(start.iso).getTime() + duration).toISOString();
  if (!endAt && start.iso) {
    endAt = new Date(new Date(start.iso).getTime() + (start.allDay ? 86_400_000 : 60 * 60 * 1000)).toISOString();
    warnings.push(start.allDay ? 'No end date was listed; TagOnce assumed one day.' : 'No end time was listed; TagOnce assumed one hour.');
  }

  const title = decodeIcsText(firstField(candidate.fields, 'SUMMARY')?.value || '');
  const location = decodeIcsText(firstField(candidate.fields, 'LOCATION')?.value || '');
  const description = decodeIcsText(firstField(candidate.fields, 'DESCRIPTION')?.value || firstField(candidate.fields, 'X-ALT-DESC')?.value || '');
  const url = decodeIcsText(firstField(candidate.fields, 'URL')?.value || '');
  if (!title && !start.iso && !location) return null;
  if (!title) warnings.push('The invite did not include an event name.');
  if (!start.iso) warnings.push('The invite did not include a readable start time.');

  return {
    title,
    startAt: start.iso,
    endAt,
    location,
    description,
    url,
    allDay: start.allDay,
    sourceFile,
    warnings,
  };
}

function chooseBestEvent(events: ImportedCalendarEvent[]) {
  const now = Date.now();
  return [...events].sort((left, right) => {
    const leftStart = left.startAt ? new Date(left.startAt).getTime() : Number.POSITIVE_INFINITY;
    const rightStart = right.startAt ? new Date(right.startAt).getTime() : Number.POSITIVE_INFINITY;
    const leftFuture = leftStart >= now ? 0 : 1;
    const rightFuture = rightStart >= now ? 0 : 1;
    if (leftFuture !== rightFuture) return leftFuture - rightFuture;
    if (leftFuture === 0) return leftStart - rightStart;
    return rightStart - leftStart;
  })[0];
}

export async function importCalendarFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.ics') && file.type !== 'text/calendar') {
    throw new Error('Choose an .ics calendar invite.');
  }
  if (file.size > MAX_ICS_BYTES) throw new Error('That calendar file is too large to import safely.');
  const text = await file.text();
  const lines = unfoldLines(text);
  const candidates: CalendarEventCandidate[] = [];
  let active: CalendarEventCandidate | null = null;

  lines.forEach((rawLine) => {
    const line = parseContentLine(rawLine);
    if (!line) return;
    if (line.name === 'BEGIN' && line.value.toUpperCase() === 'VEVENT') {
      active = { fields: [] };
      return;
    }
    if (line.name === 'END' && line.value.toUpperCase() === 'VEVENT') {
      if (active) candidates.push(active);
      active = null;
      return;
    }
    if (active) active.fields.push(line);
  });

  const events = candidates
    .map((candidate) => eventFromCandidate(candidate, file.name))
    .filter((event): event is ImportedCalendarEvent => Boolean(event));
  if (!events.length) throw new Error('No readable event was found in that calendar invite.');
  const selected = chooseBestEvent(events);
  return { selected, eventCount: events.length };
}

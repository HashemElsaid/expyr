import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { postJson } from '@/lib/http';

/**
 * How to renew something, where the app has no hand-checked guide.
 *
 * Fetched from Expyr's service, which searches the live web once per
 * jurisdiction and serves the same answer to everybody who asks. This file is
 * the phone's half: ask once, keep it, and never ask again until it is stale.
 *
 * The on-device copy is not a duplicate of the server's cache — it does a
 * different job. The server's stops the same jurisdiction being researched
 * twice; this one stops the phone making a network request at all to draw a
 * screen the person has already opened. Which matters here more than usual,
 * because the moment somebody most wants renewal steps is standing in a
 * service centre on a bad connection.
 */

const FOLDER = 'guidance';
const TIMEOUT_MS = 90_000;

/**
 * How long the phone trusts its copy. Shorter than the service's ninety days,
 * so a corrected fee reaches people within a month of being corrected without
 * the phone having to be told.
 */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type GuidanceSource = { title: string; url: string; official: boolean };

export type Guidance = {
  summary: string;
  where: string;
  steps: string[];
  typicalCost: string;
  lateFee: string;
  processingTime: string;
  needed: string[];
  /**
   * How much the search actually established. `thin` means it found little —
   * the app says so differently, and more loudly.
   */
  standing: 'good' | 'thin';
  sources: GuidanceSource[];
  /** ISO date it was generated, shown so a person can judge its age. */
  checkedOn: string;
};

export type GuidanceQuery = {
  typeId: string;
  /** What this document is called where the user is. */
  label: string;
  /** ISO-3166 alpha-2. */
  country: string;
  countryName: string;
  /** Emirate, state or province. Empty when unknown. */
  region: string;
};

/** The same key the service uses, so the two caches agree about what is what. */
export function guidanceKey(query: GuidanceQuery): string {
  const region = query.region.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return [query.typeId, query.country.toLowerCase(), region].filter(Boolean).join('.');
}

/* ---------------------------------------------------------------- storage -- */

type Stored = { value: Guidance; at: number };

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

function fileFor(key: string): File {
  return new File(folder(), `${key.replace(/[^a-z0-9.-]/gi, '_')}.json`);
}

function read(key: string): Stored | null {
  if (Platform.OS === 'web') return null;
  try {
    const file = fileFor(key);
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync()) as Partial<Stored>;
    if (typeof parsed.at !== 'number' || !parsed.value) return null;
    return { value: parsed.value, at: parsed.at };
  } catch {
    // An unreadable copy is a copy we do not have.
    return null;
  }
}

function write(key: string, value: Guidance) {
  if (Platform.OS === 'web') return;
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ value, at: Date.now() } satisfies Stored));
  } catch {
    // A cache that cannot be written costs one request next time. Not an error.
  }
}

/** Everything kept, dropped when somebody clears their data. */
export function deleteAllGuidance() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Stranded guidance is a few kilobytes about a jurisdiction, not about a person.
  }
}

/* ----------------------------------------------------------------- asking -- */

/** What this phone already holds, however old. Drawn immediately, then refreshed. */
export function cachedGuidance(query: GuidanceQuery): Guidance | null {
  return read(guidanceKey(query))?.value ?? null;
}

/** Whether the copy on this phone is worth keeping rather than refreshing. */
export function guidanceIsFresh(query: GuidanceQuery, now = Date.now()): boolean {
  const stored = read(guidanceKey(query));
  return stored !== null && now - stored.at < MAX_AGE_MS;
}

/**
 * Two screens can want the same guidance at once, and the request takes the
 * better part of a minute. The second joins the first rather than paying again.
 */
const inFlight = new Map<string, Promise<Guidance>>();

/**
 * The guidance for this document type here, from the phone if it has a fresh
 * copy and from the service otherwise.
 *
 * Throws only when there is nothing at all to show. A stale copy beats an
 * error: renewal steps do not change in the hour a connection is bad.
 */
export async function fetchGuidance(query: GuidanceQuery): Promise<Guidance> {
  const key = guidanceKey(query);

  const stored = read(key);
  if (stored && Date.now() - stored.at < MAX_AGE_MS) return stored.value;

  const running = inFlight.get(key);
  if (running) return running;

  const work = postJson<Guidance>(
    '/guidance',
    {
      typeId: query.typeId,
      label: query.label,
      country: query.country,
      countryName: query.countryName,
      region: query.region,
    },
    {
      timeoutMs: TIMEOUT_MS,
      messages: {
        rateLimited: 'Expyr has looked up a lot of these recently. Try again shortly.',
        refused: 'Expyr could not look that up just now.',
        timedOut:
          'Looking that up took too long. It is usually quicker the second time, once someone else has asked.',
        unreachable: 'Could not reach Expyr to look that up. Check your connection.',
      },
    }
  )
    .then((value) => {
      write(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, work);

  try {
    return await work;
  } catch (error) {
    // Anything we already had is better than nothing, however old it is.
    if (stored) return stored.value;
    throw error;
  }
}

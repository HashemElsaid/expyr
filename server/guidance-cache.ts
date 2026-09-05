import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Where generated renewal guidance is kept between requests.
 *
 * This is the one piece of state the service legitimately wants, and it is
 * worth being precise about why it does not contradict "Expyr stores nothing".
 * What is cached here is a public fact about a jurisdiction — how a residence
 * visa is renewed in Dubai — keyed by document type and region. It is identical
 * for every person who asks, it says nothing about anybody, and nothing that
 * identifies a caller is written with it. Two thousand users share one entry.
 *
 * Which is also the point. A web search costs real money and takes twenty
 * seconds; doing it once per jurisdiction rather than once per user is the
 * difference between this feature being affordable and being a bill.
 *
 * Behind an interface because the honest answer about persistence depends on
 * where this runs. In memory it is lost on every restart, which on a sleeping
 * free-tier host is often. On disk it survives restarts but not a deploy on
 * hosts with an ephemeral filesystem. Neither is wrong — a miss costs one
 * regeneration — but a shared store is what this wants eventually, and that is
 * a new class rather than a change anywhere else.
 */

export type CacheEntry<T> = {
  value: T;
  /** When it was generated, as epoch milliseconds. */
  at: number;
};

export interface GuidanceStore<T> {
  get(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, value: T): Promise<void>;
}

/**
 * How long an entry is served before it is generated again.
 *
 * Renewal rules change, but they change on the timescale of government
 * announcements rather than of web pages. Ninety days is short enough that a
 * fee change is picked up within a quarter and long enough that a jurisdiction
 * nobody has asked about since spring costs nothing to keep.
 */
export const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function isFresh<T>(entry: CacheEntry<T> | null, now = Date.now()): entry is CacheEntry<T> {
  return entry !== null && now - entry.at < MAX_AGE_MS;
}

/** Bounded, so a long-running process cannot grow without limit. */
const MAX_IN_MEMORY = 500;

export class MemoryGuidanceStore<T> implements GuidanceStore<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  async get(key: string): Promise<CacheEntry<T> | null> {
    return this.entries.get(key) ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    if (this.entries.size >= MAX_IN_MEMORY) {
      // Oldest insertion first, which for this access pattern is close enough
      // to least-recently-useful and costs nothing to maintain.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, at: Date.now() });
  }
}

/**
 * One JSON file per key, under a directory the host may or may not keep.
 *
 * Deliberately forgiving: every failure here is a cache miss, and a cache miss
 * costs one regeneration. Nothing about a failed read or write is worth
 * failing a request over.
 */
export class FileGuidanceStore<T> implements GuidanceStore<T> {
  private readonly directory: string;
  private ready: Promise<void> | null = null;

  constructor(directory: string) {
    this.directory = directory;
  }

  /** Keys are already validated upstream; this keeps the filename sane anyway. */
  private fileFor(key: string): string {
    return join(this.directory, `${key.replace(/[^a-z0-9._-]/gi, '_')}.json`);
  }

  private async ensure(): Promise<void> {
    this.ready ??= mkdir(this.directory, { recursive: true }).then(() => undefined);
    await this.ready;
  }

  async get(key: string): Promise<CacheEntry<T> | null> {
    try {
      const raw = await readFile(this.fileFor(key), 'utf8');
      const parsed = JSON.parse(raw) as Partial<CacheEntry<T>>;
      if (typeof parsed.at !== 'number' || parsed.value === undefined) return null;
      return { value: parsed.value as T, at: parsed.at };
    } catch {
      return null;
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await this.ensure();
      const entry: CacheEntry<T> = { value, at: Date.now() };
      await writeFile(this.fileFor(key), JSON.stringify(entry), 'utf8');
    } catch {
      // A cache that cannot be written is a cache that misses. Not an error.
    }
  }

  /** How many entries are on disk. Reported by /health, useful when deploying. */
  async size(): Promise<number> {
    try {
      const names = await readdir(this.directory);
      return names.filter((name) => name.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /** Whether the directory is actually usable, for the same reason. */
  async writable(): Promise<boolean> {
    try {
      await this.ensure();
      await stat(this.directory);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Memory in front of disk, with one generation shared by everyone waiting.
 *
 * The single-flight map is the part that matters. Guidance takes the better
 * part of a minute to produce, so without it the first ten phones to ask about
 * Dubai residence visas on a cold cache each start their own web search and pay
 * for it. With it, the first starts one and the other nine wait on the same
 * promise.
 */
/**
 * How long a jurisdiction that failed to generate is left alone.
 *
 * This exists because of how the route is polled. A phone asks every few
 * seconds until an answer appears, so a key that fails reliably — a search that
 * finds nothing, a jurisdiction with no authority to find — would start a fresh
 * web search on every single ask. The daily ceiling would eventually stop it,
 * having spent the whole day's budget on one question nobody can answer.
 *
 * Ten minutes is long enough to break that loop and short enough that a
 * genuinely transient failure costs one wait rather than an afternoon.
 */
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;

/** Raised when a key failed recently and is not being retried yet. */
export class RecentlyFailed extends Error {
  constructor() {
    super('That look-up failed recently and is not being retried yet.');
    this.name = 'RecentlyFailed';
  }
}

export class LayeredGuidanceStore<T> implements GuidanceStore<T> {
  private readonly memory: MemoryGuidanceStore<T>;
  private readonly disk: GuidanceStore<T> | null;
  private readonly inFlight = new Map<string, Promise<T>>();
  /** Keys whose last generation threw, and when. See FAILURE_COOLDOWN_MS. */
  private readonly failures = new Map<string, number>();

  constructor(disk: GuidanceStore<T> | null) {
    this.memory = new MemoryGuidanceStore<T>();
    this.disk = disk;
  }

  async get(key: string): Promise<CacheEntry<T> | null> {
    const hot = await this.memory.get(key);
    if (hot) return hot;

    const cold = this.disk ? await this.disk.get(key) : null;
    // Promoted so the next reader does not touch the filesystem.
    if (cold) this.memory.set(key, cold.value).catch(() => {});
    return cold;
  }

  async set(key: string, value: T): Promise<void> {
    await this.memory.set(key, value);
    if (this.disk) await this.disk.set(key, value);
  }

  /**
   * The cached value if it is fresh, otherwise `produce()` — run once however
   * many callers arrive while it is running.
   */
  /** Whether this key failed recently enough that it should be left alone. */
  failedRecently(key: string, now = Date.now()): boolean {
    const at = this.failures.get(key);
    if (at === undefined) return false;
    if (now - at < FAILURE_COOLDOWN_MS) return true;
    this.failures.delete(key);
    return false;
  }

  async fetch(key: string, produce: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const existing = await this.get(key);
    /*
     * Held separately because `isFresh` narrows `existing` to null for the rest
     * of the function, and the recovery below needs the stale entry it just
     * decided not to serve.
     */
    const stale: CacheEntry<T> | null = existing;
    if (isFresh(existing)) return { value: existing.value, cached: true };

    const running = this.inFlight.get(key);
    if (running) return { value: await running, cached: true };

    /*
     * Nothing fresh, nothing running, and it failed a moment ago. Producing
     * again is how a polled route turns one unanswerable question into a day's
     * worth of web searches.
     */
    if (this.failedRecently(key)) {
      if (stale) return { value: stale.value, cached: true };
      throw new RecentlyFailed();
    }

    /*
     * Deliberately not tied to the request that started it. A phone that gives
     * up waiting — a slow connection, a cold host, an app backgrounded — leaves
     * this running, and the answer still lands in the cache. So the retry that
     * person taps a moment later is served in a millisecond rather than paying
     * for the same three searches again.
     */
    const work = produce()
      .then(async (value) => {
        await this.set(key, value);
        this.failures.delete(key);
        return value;
      })
      .catch((reason: unknown) => {
        this.failures.set(key, Date.now());
        throw reason;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, work);

    try {
      return { value: await work, cached: false };
    } catch (error) {
      /*
       * A stale answer beats no answer. Renewal steps do not change in the
       * hour a search happens to be failing, and somebody standing in a
       * service centre would rather have last quarter's fee than an error.
       */
      if (stale) return { value: stale.value, cached: true };
      throw error;
    }
  }
}

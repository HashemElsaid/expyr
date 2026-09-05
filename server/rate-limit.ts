/**
 * The ceilings that stand between a leaked app token and the bill.
 *
 * Not a defence against a determined attacker — it exists so that a bug, a
 * retry loop, or somebody who pulled the token out of the bundle cannot quietly
 * drain the API credits. Three layers, each closing the hole the one above
 * leaves open: a burst limit per caller, a daily budget per install, and a
 * ceiling for the whole service.
 *
 * Everything is behind the `RateLimiter` interface for one reason: the counters
 * below live in this process's memory. One instance on Render is fine — the
 * numbers are ceilings for abuse rather than meters for honest use, and a
 * restart forgiving everyone is the right way round for that. A second instance
 * is not fine: each would get its own counters and every limit would silently
 * double. When that day comes, the fix is a class implementing this interface
 * against Redis, and nothing else in the service changes.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export type Bucket = { windowMs: number; max: number; label: string };

/*
 * One bucket per endpoint, because they do not cost the same thing. Scanning a
 * date off a photo is cheap and happens in bursts while somebody empties their
 * drawer. Reading a contract in full is the expensive one. Questions sit in
 * between, and the cached transcript makes a run of them cheaper than the
 * first, which is why an hour of them is allowed rather than ten minutes.
 *
 * These are ceilings for abuse, not budgets for use: every number here is far
 * above what the app itself can ask for in normal hands.
 */
export const BUCKETS: Record<string, Bucket> = {
  '/extract': { windowMs: 10 * MINUTE, max: 20, label: 'scans' },
  '/read': { windowMs: HOUR, max: 12, label: 'documents read' },
  '/brief': { windowMs: HOUR, max: 12, label: 'summaries' },
  '/ask': { windowMs: HOUR, max: 30, label: 'questions' },
  '/subscriptions': { windowMs: HOUR, max: 20, label: 'screenshots read' },
  /*
   * Nearly always a cache lookup, and a phone now polls while a jurisdiction is
   * being researched — so this counts a dozen cheap asks per real one. Generous
   * for that reason; the ceiling that meters actual spend is the one on new
   * jurisdictions in routes.ts, which polling does not touch.
   */
  '/guidance': { windowMs: HOUR, max: 200, label: 'renewal look-ups' },
  /*
   * Icons are cheap, cached, and fetched in a burst the first time somebody
   * adds their subscriptions — so this is generous. It is here at all because
   * the route needs no credential (on the web it is an <img> src, and an image
   * tag cannot carry a header), which without a limit makes it free bandwidth
   * for anyone who finds it.
   */
  '/icon': { windowMs: 10 * MINUTE, max: 120, label: 'icons' },
  /*
   * Handing out install credentials is the one thing the bundled app token can
   * do, so this is the ceiling on how fast a leaked one can mint them. A real
   * phone asks for exactly one, once, and then never again.
   */
  '/register': { windowMs: 24 * HOUR, max: 5, label: 'registrations' },
};

/**
 * What one install may do in a day, whatever address it arrives from. The
 * buckets above stop a burst; this stops a slow drip, and it is the reason a
 * stolen credential is worth so much less than a stolen bundle.
 */
export const DAILY_PER_INSTALL: Record<string, number> = {
  '/extract': 60,
  '/read': 30,
  '/brief': 30,
  '/ask': 80,
  '/subscriptions': 40,
  '/guidance': 400,
};

/**
 * The ceiling on the whole service for one day, sized well above a real day's
 * traffic and well below a bill worth panicking about.
 */
const DAILY_TOTAL = Number(process.env.EXPYR_DAILY_BUDGET ?? 2000);

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };
export type BudgetResult = { ok: boolean; used: number; max: number };

export interface RateLimiter {
  /** Whether this caller may make this request now. */
  check(client: string, route: string, now?: number): RateLimitResult;
  /** Whether this install has any of today's allowance left for this route. */
  installBudget(installId: string, route: string, now?: number): BudgetResult;
  /** Whether the service as a whole has done less today than it is allowed. */
  dailyBudget(now?: number): BudgetResult;
}

/** Stops the maps growing without bound on a long-running server. */
const SWEEP_EVERY_MS = 30 * MINUTE;
/** Yesterday's installs are not worth remembering once a new day is counting. */
const MAX_TRACKED_INSTALLS = 5000;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly installDays = new Map<string, { day: string; counts: Record<string, number> }>();
  private lastSweep = 0;
  private dayStamp = '';
  private dayCount = 0;

  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    const longest = Math.max(...Object.values(BUCKETS).map((b) => b.windowMs));
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => now - t < longest);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }

  check(client: string, route: string, now = Date.now()): RateLimitResult {
    this.sweep(now);

    const bucket = BUCKETS[route] ?? BUCKETS['/extract'];
    const key = `${route}:${client}`;
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < bucket.windowMs);

    if (recent.length >= bucket.max) {
      this.hits.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.windowMs - (now - recent[0])) / 1000)
        ),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true };
  }

  installBudget(installId: string, route: string, now = Date.now()): BudgetResult {
    const max = DAILY_PER_INSTALL[route];
    if (max === undefined) return { ok: true, used: 0, max: 0 };

    const day = new Date(now).toISOString().slice(0, 10);
    const record = this.installDays.get(installId);
    const counts = record && record.day === day ? record.counts : {};
    const used = counts[route] ?? 0;

    if (used >= max) return { ok: false, used, max };

    counts[route] = used + 1;
    this.installDays.set(installId, { day, counts });

    if (this.installDays.size > MAX_TRACKED_INSTALLS) {
      for (const [key, value] of this.installDays) {
        if (value.day !== day) this.installDays.delete(key);
      }
    }
    return { ok: true, used: used + 1, max };
  }

  dailyBudget(now = Date.now()): BudgetResult {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== this.dayStamp) {
      this.dayStamp = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= DAILY_TOTAL) {
      return { ok: false, used: this.dayCount, max: DAILY_TOTAL };
    }
    this.dayCount += 1;
    return { ok: true, used: this.dayCount, max: DAILY_TOTAL };
  }
}

/** The one the service uses. Swap this line for a Redis-backed one to scale out. */
export const limiter: RateLimiter = new InMemoryRateLimiter();

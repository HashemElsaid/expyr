/**
 * A deliberately small in-memory limiter. It is not a defence against a
 * determined attacker — it exists so a bug, a loop, or someone who pulled the
 * app token out of the bundle cannot quietly drain the API credits.
 *
 * Running more than one instance means each gets its own counter; move to a
 * shared store (Redis, Upstash) if this is ever scaled horizontally.
 */

/** Stops the map growing without bound on a long-running server. */
const SWEEP_EVERY_MS = 30 * 60 * 1000;

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
};

/**
 * The backstop that matters. Every route above is per address, and addresses
 * are free — a stolen token driven from a hundred of them would pass all of
 * them. This is the ceiling on the whole service for one day, sized well above
 * a real day's traffic and well below a bill worth panicking about.
 */
const DAILY_TOTAL = Number(process.env.EXPYR_DAILY_BUDGET ?? 2000);

const hits = new Map<string, number[]>();
let lastSweep = 0;

let dayStamp = '';
let dayCount = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  const longest = Math.max(...Object.values(BUCKETS).map((b) => b.windowMs));
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < longest);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(address: string, route: string, now = Date.now()): RateLimitResult {
  sweep(now);

  const bucket = BUCKETS[route] ?? BUCKETS['/extract'];
  const key = `${route}:${address}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < bucket.windowMs);

  if (recent.length >= bucket.max) {
    const oldest = recent[0];
    hits.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

/**
 * Counts everything that reaches the model, for the day. Returns false once the
 * service has done more work in a day than it has any business doing, at which
 * point the honest answer to everyone is "not right now".
 */
export function withinDailyBudget(now = Date.now()): { ok: boolean; used: number; max: number } {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dayStamp) {
    dayStamp = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_TOTAL) return { ok: false, used: dayCount, max: DAILY_TOTAL };
  dayCount += 1;
  return { ok: true, used: dayCount, max: DAILY_TOTAL };
}

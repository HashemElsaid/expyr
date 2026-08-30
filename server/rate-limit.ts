/**
 * A deliberately small in-memory limiter. It is not a defence against a
 * determined attacker — it exists so a bug, a loop, or someone who pulled the
 * app token out of the bundle cannot quietly drain the API credits.
 *
 * Running more than one instance means each gets its own counter; move to a
 * shared store (Redis, Upstash) if this is ever scaled horizontally.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
/** Stops the map growing without bound on a long-running server. */
const SWEEP_EVERY_MS = 30 * 60 * 1000;

const hits = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  sweep(now);

  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    hits.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

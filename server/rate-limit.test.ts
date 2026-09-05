import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { BUCKETS, InMemoryRateLimiter } from './rate-limit.ts';

/**
 * These are the ceilings that keep a leaked token from becoming a bill. Every
 * function here takes `now` as an argument precisely so it can be tested
 * without waiting an hour, and this is what that was for.
 */

const HOUR = 60 * 60 * 1000;
let seq = 0;

/** A limiter of its own per test, so no test can be affected by another. */
let limiter: InMemoryRateLimiter;
beforeEach(() => {
  limiter = new InMemoryRateLimiter();
});

/** A key nothing else in the suite has used, since the counters are module state. */
function fresh(): string {
  seq += 1;
  return `install:test-${seq}`;
}

describe('per-address rate limiting', () => {
  it('allows a burst up to the bucket and refuses the one after', () => {
    const key = fresh();
    const max = BUCKETS['/extract'].max;
    const now = Date.now();

    for (let i = 0; i < max; i += 1) {
      assert.equal(limiter.check(key, '/extract', now).allowed, true, `call ${i + 1}`);
    }

    const refused = limiter.check(key, '/extract', now);
    assert.equal(refused.allowed, false);
  });

  it('tells the caller how long to wait, and means it', () => {
    const key = fresh();
    const now = Date.now();
    const { windowMs, max } = BUCKETS['/extract'];

    for (let i = 0; i < max; i += 1) limiter.check(key, '/extract', now);
    const refused = limiter.check(key, '/extract', now);
    assert.equal(refused.allowed, false);
    if (refused.allowed) return;

    // Still refused a second before the window is up, allowed a second after.
    const justBefore = now + refused.retryAfterSeconds * 1000 - 2000;
    assert.equal(limiter.check(key, '/extract', justBefore).allowed, false);
    assert.equal(limiter.check(key, '/extract', now + windowMs + 1000).allowed, true);
  });

  it('counts each route separately', () => {
    const key = fresh();
    const now = Date.now();

    for (let i = 0; i < BUCKETS['/extract'].max; i += 1) limiter.check(key, '/extract', now);

    assert.equal(limiter.check(key, '/extract', now).allowed, false);
    // Scanning a drawerful of documents must not cost you your questions.
    assert.equal(limiter.check(key, '/ask', now).allowed, true);
  });

  it('counts each caller separately', () => {
    const one = fresh();
    const two = fresh();
    const now = Date.now();

    for (let i = 0; i < BUCKETS['/extract'].max; i += 1) limiter.check(one, '/extract', now);

    assert.equal(limiter.check(one, '/extract', now).allowed, false);
    assert.equal(limiter.check(two, '/extract', now).allowed, true);
  });

  /*
   * Minting install credentials is the one thing the bundled app token can do,
   * so this is the ceiling on how fast a leaked one can spread. A real phone
   * asks once, ever.
   */
  it('holds registrations to a handful a day', () => {
    assert.equal(BUCKETS['/register'].max, 5);
    assert.equal(BUCKETS['/register'].windowMs, 24 * HOUR);
  });
});

describe('per-install daily budget', () => {
  /*
   * The clock is pinned rather than taken from `Date.now()`, because the day is
   * counted in UTC and a run that happened to start late in the evening would
   * spread its calls across the boundary and reset the counter halfway. That is
   * fine for an abuse ceiling — it resets at 4am in Dubai, which nobody
   * notices — but it makes for a test that fails on some evenings and not
   * others, which is worse than no test.
   */
  it('stops a slow drip that never trips the burst limit', () => {
    const id = `install-${(seq += 1)}`;
    const start = Date.parse('2026-09-05T01:00:00Z');

    // /read allows 30 a day. Spread over ten hours, no burst limit ever fires.
    for (let i = 0; i < 30; i += 1) {
      const spread = start + i * 20 * 60 * 1000;
      assert.equal(limiter.installBudget(id, '/read', spread).ok, true, `read ${i + 1}`);
    }

    assert.equal(limiter.installBudget(id, '/read', start + 30 * 20 * 60 * 1000).ok, false);
  });

  it('starts again the next day', () => {
    const id = `install-${(seq += 1)}`;
    const now = Date.parse('2026-09-05T10:00:00Z');

    for (let i = 0; i < 30; i += 1) limiter.installBudget(id, '/read', now);
    assert.equal(limiter.installBudget(id, '/read', now).ok, false);

    assert.equal(limiter.installBudget(id, '/read', now + 24 * HOUR).ok, true);
  });

  it('leaves routes with no budget alone', () => {
    const id = `install-${(seq += 1)}`;
    // /register has a bucket but no daily budget; it must not be refused here.
    assert.equal(limiter.installBudget(id, '/register').ok, true);
  });
});

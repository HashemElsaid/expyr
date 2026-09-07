import { describe, expect, it } from 'vitest';

import { isDefiniteMiss, MISS_TTL_MS, shouldAskAgain } from '@/domain/icon-retry';

const NOW = Date.UTC(2026, 8, 7, 9, 0, 0);

describe('whether to ask for an icon again', () => {
  it('asks when it has never asked', () => {
    expect(shouldAskAgain(null, NOW)).toBe(true);
  });

  /*
   * The case this exists for. "My gym" is guessed as mygym.com, nothing comes
   * back, and without a memory the phone asks a stranger about somebody's
   * private list on every launch for as long as the app is installed.
   */
  it('does not ask again straight after a definite no', () => {
    expect(shouldAskAgain(NOW - 1000, NOW)).toBe(false);
    expect(shouldAskAgain(NOW - MISS_TTL_MS + 1, NOW)).toBe(false);
  });

  /*
   * A service with no favicon in September may have one by March, and a
   * permanent no is how a row keeps a blank tile years after the reason went.
   */
  it('asks again once the memory is old enough', () => {
    expect(shouldAskAgain(NOW - MISS_TTL_MS, NOW)).toBe(true);
    expect(shouldAskAgain(NOW - MISS_TTL_MS * 2, NOW)).toBe(true);
  });

  it('asks when the stored time makes no sense', () => {
    expect(shouldAskAgain(Number.NaN, NOW)).toBe(true);
    expect(shouldAskAgain(Number.POSITIVE_INFINITY, NOW)).toBe(true);
    // A clock that has gone backwards is not a reason to stop asking.
    expect(shouldAskAgain(NOW + 60_000, NOW)).toBe(true);
  });
});

describe('which failures are worth remembering', () => {
  it('remembers only the service saying there is nothing there', () => {
    expect(isDefiniteMiss(404)).toBe(true);
  });

  /*
   * A timeout, a bad gateway, a rate limit and a phone on a plane are all
   * about the moment rather than the domain. Remembering any of them would
   * turn one bad minute into a blank tile for a month.
   */
  it('forgets everything about the moment', () => {
    for (const status of [0, 200, 429, 500, 502, 503, 504]) {
      expect(isDefiniteMiss(status)).toBe(false);
    }
  });
});

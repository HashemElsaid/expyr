import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countdownLabel,
  countdownShort,
  countWord,
  daysUntil,
  dueIn,
  formatTime,
  toISODate,
  urgencyFor,
  verdictPhrase,
} from '@/lib/dates';

/**
 * The whole suite runs in Asia/Dubai — see vitest.config.ts. That is not
 * decoration: the only date bugs this app has shipped were UTC conversions
 * that behave perfectly in London and return yesterday in Dubai.
 */

describe('toISODate', () => {
  /*
   * The regression that started this. `toISOString().slice(0, 10)` converts to
   * UTC first, so local midnight in a +04 timezone is 20:00 the previous day,
   * and a subscription that renewed on the 31st was written down as the 30th.
   */
  it('uses the local calendar day, not UTC', () => {
    expect(toISODate(new Date(2026, 0, 31, 0, 0, 0))).toBe('2026-01-31');
  });

  it('is stable at the very end of a local day', () => {
    expect(toISODate(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('daysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mid-afternoon on purpose: the answer must not depend on the time of day.
    vi.setSystemTime(new Date(2026, 8, 5, 15, 30));
  });
  afterEach(() => vi.useRealTimers());

  it('counts whole days forward', () => {
    expect(daysUntil('2026-09-12')).toBe(7);
  });

  it('returns zero on the day itself, whatever the hour', () => {
    expect(daysUntil('2026-09-05')).toBe(0);
  });

  it('goes negative once the date has passed', () => {
    expect(daysUntil('2026-09-01')).toBe(-4);
  });

  /*
   * The Gulf does not observe daylight saving, but a traveller's phone does.
   * Rounding rather than flooring is what keeps a 23- or 25-hour day from
   * showing up as an off-by-one countdown.
   */
  it('survives a span containing a daylight-saving change', () => {
    expect(daysUntil('2027-03-05')).toBe(181);
  });
});

describe('urgencyFor', () => {
  it('names the four bands at their boundaries', () => {
    expect(urgencyFor(-1)).toBe('expired');
    expect(urgencyFor(0)).toBe('critical');
    expect(urgencyFor(7)).toBe('critical');
    expect(urgencyFor(8)).toBe('soon');
    expect(urgencyFor(30)).toBe('soon');
    expect(urgencyFor(31)).toBe('ok');
  });
});

describe('countdownShort', () => {
  it('switches from days to months at sixty', () => {
    expect(countdownShort(59)).toBe('59 days');
    expect(countdownShort(60)).toBe('2 months');
  });

  // Months are rounded, so the hand-over happens at 23.5 months, not at 730 days.
  it('switches from months to years rather than saying "24 months"', () => {
    expect(countdownShort(704)).toBe('23 months');
    expect(countdownShort(705)).toBe('2 years');
    expect(countdownShort(1826)).toBe('5 years');
  });

  it('says something useful about a date already gone', () => {
    expect(countdownShort(-3)).toBe('3d over');
    expect(countdownShort(0)).toBe('Today');
  });
});

describe('verdictPhrase', () => {
  it('reads as a sentence in all three directions', () => {
    expect(verdictPhrase(-1)).toBe('1 day late.');
    expect(verdictPhrase(-9)).toBe('9 days late.');
    expect(verdictPhrase(0)).toBe('Today.');
    expect(verdictPhrase(11)).toBe('11 days.');
  });
});

describe('dueIn', () => {
  it('sits after the word "expires" without reading oddly', () => {
    expect(dueIn(0)).toBe('today');
    expect(dueIn(1)).toBe('tomorrow');
    expect(dueIn(30)).toBe('in 30 days');
    expect(dueIn(60)).toBe('in 2 months');
  });

  // A snoozed reminder can be booked for a lead day already behind the date.
  it('does not say "in -3 days"', () => {
    expect(dueIn(-3)).toBe('today');
  });
});

describe('formatTime', () => {
  it('uses the names the two special hours have', () => {
    expect(formatTime(0)).toBe('midnight');
    expect(formatTime(12)).toBe('noon');
  });

  it('writes ordinary times the way a person says them', () => {
    expect(formatTime(9)).toBe('9am');
    expect(formatTime(9, 30)).toBe('9:30am');
    expect(formatTime(21, 5)).toBe('9:05pm');
  });
});

describe('countWord', () => {
  it('spells out up to ten and gives up after', () => {
    expect(countWord(0)).toBe('No');
    expect(countWord(3)).toBe('Three');
    expect(countWord(10)).toBe('Ten');
    expect(countWord(11)).toBe('11');
  });
});

/*
 * Netflix said "Expires tomorrow", which is the opposite of what happens
 * tomorrow: nothing lapses, money leaves. The one thing somebody wants from a
 * subscription reminder is the chance to cancel before being billed.
 */
describe('countdownLabel', () => {
  it('talks about expiry for anything that expires', () => {
    expect(countdownLabel(1)).toBe('Expires tomorrow');
    expect(countdownLabel(0)).toBe('Expires today');
    expect(countdownLabel(3)).toBe('3 days left');
    expect(countdownLabel(-1)).toBe('Expired yesterday');
  });

  it('talks about renewal for anything that renews itself', () => {
    expect(countdownLabel(1, true)).toBe('Renews tomorrow');
    expect(countdownLabel(0, true)).toBe('Renews today');
    expect(countdownLabel(3, true)).toBe('Renews in 3 days');
  });

  /* A subscription rolls its own date forward, so this is a backstop. */
  it('does not say a subscription expired', () => {
    expect(countdownLabel(-4, true)).toBe('Renewed 4 days ago');
    expect(countdownLabel(-4, true)).not.toContain('Expired');
  });
});

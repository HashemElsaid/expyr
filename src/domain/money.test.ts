import { describe, expect, it } from 'vitest';

import { formatYearly, parseMoney, yearlyAmount, yearlyTotal } from './money';
import type { Money, Recurrence, TrackedDocument } from '@/types';

// `null` rather than `undefined` for 'does not recur': passing undefined to a
// parameter with a default uses the default, which is how this helper first
// made the one test that mattered pass for the wrong reason.
function sub(price: Money | undefined, every: Recurrence | null = 'monthly'): TrackedDocument {
  return {
    id: Math.random().toString(),
    typeId: 'membership',
    title: 'Something',
    expiryDate: '2027-01-01',
    files: [],
    leadDays: [3],
    visibility: 'private',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(every ? { renewsEvery: every } : {}),
    ...(price ? { price } : {}),
  };
}

describe('reading a price out of what was printed', () => {
  it('reads a currency code and a figure', () => {
    expect(parseMoney('USD 24.99 a month')).toEqual({ amount: 24.99, currency: 'USD' });
    expect(parseMoney('Premium, USD 1,480')).toEqual({ amount: 1480, currency: 'USD' });
    expect(parseMoney('AED 39')).toEqual({ amount: 39, currency: 'AED' });
  });

  it('reads the common symbols', () => {
    expect(parseMoney('$9.99/mo')).toEqual({ amount: 9.99, currency: 'USD' });
    expect(parseMoney('£12.50')).toEqual({ amount: 12.5, currency: 'GBP' });
    expect(parseMoney('€8')).toEqual({ amount: 8, currency: 'EUR' });
  });

  /*
   * Declining is the whole point. A price with no currency added to a total
   * would be added as whatever the total already was, silently.
   */
  it('declines rather than guessing', () => {
    expect(parseMoney('24.99')).toBeNull();
    expect(parseMoney('Free')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('USD 0')).toBeNull();
  });

  /** A code wins over a symbol, since "USD $5" means dollars either way. */
  it('prefers an explicit code', () => {
    expect(parseMoney('USD 5 (about £4)')).toEqual({ amount: 5, currency: 'USD' });
  });
});

describe('what a year of it costs', () => {
  it('annualises each cadence', () => {
    expect(yearlyAmount({ amount: 10, currency: 'USD', every: 'weekly' })).toBe(520);
    expect(yearlyAmount({ amount: 10, currency: 'USD', every: 'monthly' })).toBe(120);
    expect(yearlyAmount({ amount: 10, currency: 'USD', every: 'quarterly' })).toBe(40);
    expect(yearlyAmount({ amount: 10, currency: 'USD', every: 'yearly' })).toBe(10);
  });

  it('adds up everything that charges on a schedule', () => {
    const total = yearlyTotal([
      sub({ amount: 24.99, currency: 'USD', every: 'monthly' }),
      sub({ amount: 415, currency: 'USD', every: 'yearly' }, 'yearly'),
      sub({ amount: 1250, currency: 'USD', every: 'quarterly' }, 'quarterly'),
    ]);
    expect(total).toEqual({ kind: 'one', currency: 'USD', amount: 24.99 * 12 + 415 + 5000 });
  });

  it('says nothing when nothing has a price', () => {
    expect(yearlyTotal([sub(undefined), sub(undefined)])).toEqual({ kind: 'none' });
    expect(formatYearly({ kind: 'none' })).toBeNull();
  });

  /*
   * A one-off fee is real money and is not what a year costs. Folding it in
   * would make the figure move for reasons nobody could trace.
   */
  it('ignores anything that does not recur, even with a price on it', () => {
    const oneOff = sub({ amount: 812, currency: 'USD', every: 'yearly' }, null);
    expect(yearlyTotal([oneOff])).toEqual({ kind: 'none' });
  });

  it('ignores what has been archived', () => {
    const gone = { ...sub({ amount: 100, currency: 'USD', every: 'monthly' }), archivedAt: 'x' };
    expect(yearlyTotal([gone])).toEqual({ kind: 'none' });
  });

  /*
   * The one thing this must never do. Two currencies have no single yearly
   * figure, and picking a rate would be a number nobody could check on the one
   * screen that exists to be checked.
   */
  it('refuses to add two currencies together', () => {
    const total = yearlyTotal([
      sub({ amount: 100, currency: 'USD', every: 'monthly' }),
      sub({ amount: 39, currency: 'AED', every: 'monthly' }),
    ]);
    expect(total).toEqual({ kind: 'mixed', currency: 'USD', amount: 1200, others: 1 });
    expect(formatYearly(total)).toBe('USD 1,200 a year, plus 1 other currency');
  });

  it('names the largest currency when they are mixed', () => {
    const total = yearlyTotal([
      sub({ amount: 1, currency: 'USD', every: 'monthly' }),
      sub({ amount: 500, currency: 'AED', every: 'monthly' }),
      sub({ amount: 5, currency: 'GBP', every: 'monthly' }),
    ]);
    expect(total).toMatchObject({ kind: 'mixed', currency: 'AED', others: 2 });
    expect(formatYearly(total)).toBe('AED 6,000 a year, plus 2 other currencies');
  });

  /** Cents on a yearly total of thousands are noise pretending to be precision. */
  it('reads as a round figure', () => {
    expect(formatYearly({ kind: 'one', currency: 'USD', amount: 6899.88 })).toBe(
      'USD 6,900 a year'
    );
  });
});

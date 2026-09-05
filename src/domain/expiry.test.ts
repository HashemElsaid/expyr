import { describe, expect, it } from 'vitest';

import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { defaultExpiry, startingExpiry } from '@/domain/expiry';
import { toISODate } from '@/lib/dates';
import { makeDocument } from '@/test/factories';

const NOW = new Date(2026, 8, 5);

describe('defaultExpiry', () => {
  it('lands six months out', () => {
    expect(toISODate(defaultExpiry(NOW))).toBe('2027-03-05');
  });

  it('does not overflow off the end of a short month', () => {
    // 31 August plus six months has no 31st to land on.
    expect(toISODate(defaultExpiry(new Date(2026, 7, 31)))).toBe('2027-03-03');
  });
});

describe('startingExpiry', () => {
  it('opens on the date the document already has, when not renewing', () => {
    const doc = makeDocument('passport', { expiryDate: '2027-04-01' });
    expect(toISODate(startingExpiry(doc, false, NOW))).toBe('2027-04-01');
  });

  /*
   * The case worth writing a test for. Renewing early should not throw away the
   * time you were early by — a visa renewed a fortnight before it lapses is
   * valid from the old date, not from the day you got round to it.
   */
  it('counts a renewal from the old date when it is still ahead', () => {
    const doc = makeDocument('residence-visa', { expiryDate: '2026-10-05' });
    const period = RENEWAL_PERIOD_DAYS['residence-visa'] ?? 365;

    const expected = new Date(2026, 9, 5);
    expected.setDate(expected.getDate() + period);
    expect(toISODate(startingExpiry(doc, true, NOW))).toBe(toISODate(expected));
  });

  it('counts from today when the old date has already gone', () => {
    const doc = makeDocument('residence-visa', { expiryDate: '2026-01-01' });
    const period = RENEWAL_PERIOD_DAYS['residence-visa'] ?? 365;

    const expected = new Date(NOW);
    expected.setDate(expected.getDate() + period);
    expect(toISODate(startingExpiry(doc, true, NOW))).toBe(toISODate(expected));
  });

  it('falls back to a year for a category with no verified period', () => {
    const doc = makeDocument('other', { expiryDate: '2026-01-01' });
    expect(RENEWAL_PERIOD_DAYS.other).toBeUndefined();

    const expected = new Date(NOW);
    expected.setDate(expected.getDate() + 365);
    expect(toISODate(startingExpiry(doc, true, NOW))).toBe(toISODate(expected));
  });
});

import { describe, expect, it } from 'vitest';

import { DOCUMENT_TYPES } from '@/data/document-types';
import { runningLateFee } from '@/domain/late-fee';

/**
 * The only figure in Expyr about somebody's money, so the tests are about the
 * ways it could be wrong in their favour or against them — and particularly
 * about the grace period, which is the easy one to forget.
 */

const rate = { lateFeeRate: { graceDays: 30, perDay: 20, cap: 1000, currency: 'AED' } };

describe('runningLateFee', () => {
  it('says nothing about a document that has not expired', () => {
    expect(runningLateFee(45, rate)).toBeNull();
  });

  it('says nothing on the day it expires', () => {
    expect(runningLateFee(0, rate)).toBeNull();
  });

  // A fine that has not started is not a debt.
  it('says nothing while the grace period is still running', () => {
    expect(runningLateFee(-1, rate)).toBeNull();
    expect(runningLateFee(-30, rate)).toBeNull();
  });

  it('starts counting on the first day past the grace period', () => {
    expect(runningLateFee(-31, rate)).toEqual({
      owed: 20,
      capped: false,
      currency: 'AED',
      lateDays: 1,
    });
  });

  it('grows a day at a time', () => {
    expect(runningLateFee(-40, rate)?.owed).toBe(200);
  });

  it('stops at the cap, and says that it has', () => {
    const long = runningLateFee(-400, rate);
    expect(long?.owed).toBe(1000);
    expect(long?.capped).toBe(true);
  });

  it('reports the cap as reached exactly at the cap, not past it', () => {
    // 50 days of fine at 20 a day is exactly 1000.
    const exact = runningLateFee(-80, rate);
    expect(exact?.owed).toBe(1000);
    expect(exact?.capped).toBe(true);
  });

  /*
   * Most categories state their penalty as a sentence — "no fine, but an
   * expired passport invalidates travel". Those must show the sentence, never a
   * number arrived at by guesswork.
   */
  it('says nothing for a category whose fine is not a verified daily rate', () => {
    expect(runningLateFee(-500, { lateFeeRate: undefined })).toBeNull();
  });

  it('every rate the app carries is internally sensible', () => {
    for (const type of DOCUMENT_TYPES) {
      const found = type.guide.lateFeeRate;
      if (!found) continue;

      expect(found.perDay, type.id).toBeGreaterThan(0);
      expect(found.graceDays, type.id).toBeGreaterThanOrEqual(0);
      // A cap below one day's fine would mean the fine started already capped.
      expect(found.cap, type.id).toBeGreaterThanOrEqual(found.perDay);
      expect(found.currency, type.id).toMatch(/^[A-Z]{3}$/);
    }
  });
});

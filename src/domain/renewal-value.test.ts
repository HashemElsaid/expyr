import { describe, expect, it } from 'vitest';

import { DOCUMENT_TYPES } from '@/data/document-types';
import { feeFrom, renewalWorth, totalOf, trackedSentence } from '@/domain/renewal-value';
import type { DocumentTypeId } from '@/types';

function holding(...typeIds: DocumentTypeId[]) {
  return typeIds.map((typeId) => ({ typeId }));
}

/*
 * Read against the real strings in the catalogue rather than invented ones,
 * because the parser's whole job is surviving prose somebody wrote for a
 * human: ranges, tildes, a second fee bolted on the end, and a word before
 * the currency.
 */
describe('reading a fee out of a sentence', () => {
  it('takes the low end of a range', () => {
    expect(feeFrom('AED 300-1,200 in government fees (varies by visa type)')).toEqual({
      currency: 'AED',
      amount: 300,
    });
  });

  it('ignores a second fee added on the end', () => {
    expect(feeFrom('AED 100 per year of validity + ~AED 70 service fees')).toEqual({
      currency: 'AED',
      amount: 100,
    });
  });

  it('finds a figure in the middle of a sentence', () => {
    expect(feeFrom('Varies by nationality (typically AED 200-1,000)')).toEqual({
      currency: 'AED',
      amount: 200,
    });
  });

  it('is not thrown by a word in front of the money', () => {
    expect(feeFrom('Ejari registration ~AED 120-220 + rent per your contract')).toEqual({
      currency: 'AED',
      amount: 120,
    });
  });

  it('reads a thousands comma as one number', () => {
    expect(feeFrom('AED 1,000-3,500+ depending on car value')).toEqual({
      currency: 'AED',
      amount: 1000,
    });
  });

  /*
   * Both of these are real entries. Nothing is a better answer than a guess:
   * the labour card genuinely costs the holder nothing.
   */
  it('finds nothing where there is no figure', () => {
    expect(feeFrom('')).toBeNull();
    expect(feeFrom('Paid by the employer by law')).toBeNull();
  });

  it('does not mistake a word for a currency', () => {
    expect(feeFrom('VAT applies')).toBeNull();
    expect(feeFrom('Free')).toBeNull();
  });
});

describe('adding fees up', () => {
  it('sums what is known and skips what is not', () => {
    expect(
      totalOf([
        { currency: 'AED', amount: 300 },
        null,
        { currency: 'AED', amount: 120 },
      ])
    ).toEqual({ currency: 'AED', amount: 420 });
  });

  it('has no total when nothing is known', () => {
    expect(totalOf([null, null])).toBeNull();
  });

  /*
   * A total is only a total if every part is in the same money. This cannot
   * happen while the UAE is the only checked jurisdiction, and it is the first
   * thing that would go wrong when a second one is written.
   */
  it('refuses to add two currencies together', () => {
    expect(
      totalOf([
        { currency: 'AED', amount: 300 },
        { currency: 'SAR', amount: 180 },
      ])
    ).toBeNull();
  });
});

describe('what a person is holding', () => {
  it('reports the count and the total separately', () => {
    expect(renewalWorth(holding('residence-visa', 'membership'), 'ae')).toEqual({
      items: 2,
      worth: { currency: 'AED', amount: 300 },
    });
  });

  it('counts the items but prices nothing outside the UAE', () => {
    expect(renewalWorth(holding('residence-visa'), 'om')).toEqual({ items: 1, worth: null });
  });
});

describe('the line at the top of the paywall', () => {
  /*
   * A household's own papers, which is who reaches the item ceiling.
   *
   * The totals below are read off the catalogue as it stands. Item 8 on the
   * 1.0.1 list corrects several of those fees against the verified guides, so
   * it will land here as a failing sum rather than a silent change of what the
   * paywall tells somebody their paperwork is worth. That is the intent.
   */
  const HOUSEHOLD = holding(
    'residence-visa',
    'emirates-id',
    'car-registration',
    'car-insurance',
    'tenancy-ejari'
  );

  it('says what they hold and what it costs to keep', () => {
    expect(trackedSentence(HOUSEHOLD, 'ae')).toBe(
      'You are tracking 5 items worth AED 1,870 in renewals'
    );
  });

  it('counts one item as one item', () => {
    expect(trackedSentence(holding('passport'), 'ae')).toBe(
      'You are tracking 1 item worth AED 200 in renewals'
    );
  });

  /*
   * Fees are verified for the UAE and nowhere else, and the app refuses to
   * show renewal costs outside it rather than guessing. A paywall quoting
   * dirhams to somebody in Karachi would be that same invention with a price
   * on it.
   */
  it('quotes no money to somebody the fees were never checked for', () => {
    expect(trackedSentence(HOUSEHOLD, 'pk')).toBe('You are tracking 5 items');
    expect(trackedSentence(HOUSEHOLD, null)).toBe('You are tracking 5 items');
  });

  it('falls back to the count when no fee is known', () => {
    expect(trackedSentence(holding('membership', 'warranty'), 'ae')).toBe(
      'You are tracking 2 items'
    );
  });

  /* On the screen selling a tracker, "tracking 0 items" argues against it. */
  it('says nothing at all about an empty list', () => {
    expect(trackedSentence([], 'ae')).toBeNull();
  });

  /*
   * Every entry in the catalogue goes through the parser. A fee string that
   * cannot be read is allowed; one that reads as the wrong number is not, so
   * this checks the shape of every answer rather than the answers themselves.
   */
  it('reads every fee in the catalogue as a sane figure or not at all', () => {
    for (const type of DOCUMENT_TYPES) {
      const fee = feeFrom(type.guide.typicalCost);
      if (fee === null) continue;
      expect(fee.currency, type.id).toBe('AED');
      expect(fee.amount, type.id).toBeGreaterThan(0);
      expect(fee.amount, type.id).toBeLessThan(100_000);
    }
  });
});

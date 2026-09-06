import { describe, expect, it } from 'vitest';

import { CREDIT_COST_USD } from '@/domain/credits';
import { costToHonour, PACKS, pagesIn, priceOf, revenueFrom } from '@/lib/credit-packs';

/**
 * These are the tests that stop a price change losing money quietly.
 *
 * A pack is not a markup — credits are meant to be sold at cost — but Apple
 * takes thirty percent of the sale, so "at cost" and "at face value" are
 * different numbers. Getting that wrong does not fail loudly; it just means
 * every top-up is a small donation.
 */

describe('every pack survives Apple taking its share', () => {
  it.each(PACKS)('$id is not sold below what it costs to honour', (pack) => {
    expect(revenueFrom(pack)).toBeGreaterThan(costToHonour(pack));
  });

  it.each(PACKS)('$id holds no more than the price less Apple, in credits', (pack) => {
    // credits <= usd * 0.70 / $0.001
    expect(pack.credits).toBeLessThanOrEqual(pack.usd * 0.7 / CREDIT_COST_USD);
  });
});

describe('bigger packs are better value', () => {
  it('never charges more per credit as the pack grows', () => {
    const rates = PACKS.map((pack) => pack.credits / pack.usd);
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });
});

describe('what a pack is worth in pages', () => {
  /*
   * The number on the screen has to be one the app can keep. It used to say
   * documents, worked out by assuming fourteen pages each — which is a guess,
   * and one that overpromises to exactly the people with long contracts. A
   * credit is a tenth of a page by definition, so this is arithmetic.
   */
  it('is exact, not an estimate', () => {
    expect(pagesIn(PACKS[0])).toBe(150);
    expect(pagesIn(PACKS[1])).toBe(300);
    expect(pagesIn(PACKS[2])).toBe(650);
  });

  it('never promises more pages than the credits cover', () => {
    for (const pack of PACKS) {
      expect(pagesIn(pack) * 10).toBeLessThanOrEqual(pack.credits);
    }
  });
});

describe('the packs themselves', () => {
  it('have distinct ids, since App Store Connect keys on them', () => {
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
  });

  it('are listed cheapest first', () => {
    const prices = PACKS.map((p) => p.usd);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});

describe('the price shown matches the storefront', () => {
  /*
   * The paywall quotes Expyr Pro in AED to somebody in Dubai. Quoting credits
   * in dollars on the next screen makes it look like two different apps.
   */
  it('prices in the local currency where there is one', () => {
    expect(priceOf(PACKS[1], 'AE')).toBe('AED 18.99');
    expect(priceOf(PACKS[1], 'GB')).toBe('£4.99');
    expect(priceOf(PACKS[1], 'US')).toBe('$4.99');
  });

  it('serves every euro storefront from one entry', () => {
    for (const country of ['DE', 'FR', 'ES', 'IT', 'NL', 'IE']) {
      expect(priceOf(PACKS[0], country)).toBe('€2.99');
    }
  });

  it('falls back to dollars rather than showing nothing', () => {
    expect(priceOf(PACKS[2], 'ZZ')).toBe('$9.99');
  });

  it('has a price for every pack in every listed storefront', () => {
    for (const pack of PACKS) {
      for (const country of ['AE', 'SA', 'QA', 'GB', 'EU', 'US']) {
        expect(pack.prices[country]).toBeTruthy();
      }
    }
  });
});

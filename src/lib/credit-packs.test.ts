import { describe, expect, it } from 'vitest';

import { CREDIT_COST_USD } from '@/domain/credits';
import { costToHonour, documentsIn, PACKS, revenueFrom } from '@/lib/credit-packs';

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

describe('what a pack is worth in documents', () => {
  it('counts whole documents of a typical length', () => {
    // 14 pages is 140 credits, so 3,000 covers twenty-one of them.
    expect(documentsIn(PACKS[0])).toBe(21);
  });

  it('rounds down, so the number is never a promise we miss', () => {
    for (const pack of PACKS) {
      expect(Number.isInteger(documentsIn(pack))).toBe(true);
      expect(documentsIn(pack) * 140).toBeLessThanOrEqual(pack.credits);
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

import { describe, expect, it } from 'vitest';

import {
  apply,
  asMoney,
  canAfford,
  chargeForPages,
  chargeForQuestion,
  CREDITS_PER_PAGE,
  CREDITS_PER_QUESTION,
  documentsLeft,
  EMPTY_LEDGER,
  formatCredits,
  MAX_ENTRIES,
  priceOfPages,
  refund,
  topUp,
  type Ledger,
} from '@/domain/credits';

const AT = new Date('2026-09-06T12:00:00Z');

function ledgerWith(balance: number): Ledger {
  return topUp(EMPTY_LEDGER, balance, 'Top-up', AT, 't1');
}

describe('what things cost', () => {
  it('charges by the page', () => {
    expect(priceOfPages(1)).toBe(CREDITS_PER_PAGE);
    expect(priceOfPages(14)).toBe(14 * CREDITS_PER_PAGE);
  });

  it('costs nothing to read nothing', () => {
    expect(priceOfPages(0)).toBe(0);
  });

  /*
   * A negative page count means something upstream is wrong. Refusing to turn
   * it into free credits is the conservative reading, and the only one that
   * cannot be exploited.
   */
  it('never turns a nonsense page count into a payout', () => {
    expect(priceOfPages(-5)).toBe(0);
  });

  it('rounds a fractional page up rather than down', () => {
    expect(priceOfPages(2.1)).toBe(3 * CREDITS_PER_PAGE);
  });
});

describe('spending', () => {
  it('takes the price of the pages that arrived', () => {
    const after = chargeForPages(ledgerWith(1000), 14, 'Tenancy contract · 14 pages', AT, 'e1');
    expect(after.balance).toBe(1000 - 140);
  });

  it('charges a flat price for a question', () => {
    const after = chargeForQuestion(ledgerWith(100), 'What is my notice period?', AT, 'e1');
    expect(after.balance).toBe(100 - CREDITS_PER_QUESTION);
  });

  /*
   * The batching case, which is the one that matters. A fourteen-page contract
   * that got twelve pages through and failed is charged for twelve; the retry
   * adds the last two. The person pays for fourteen pages once, across two
   * attempts, rather than twenty-six across two.
   */
  it('charges a resumed read only for the pages it adds', () => {
    let ledger = ledgerWith(1000);
    ledger = chargeForPages(ledger, 12, 'Tenancy contract · pages 1-12', AT, 'e1');
    ledger = chargeForPages(ledger, 2, 'Tenancy contract · pages 13-14', AT, 'e2');
    expect(ledger.balance).toBe(1000 - 140);
  });

  it('charges nothing when nothing was delivered', () => {
    const before = ledgerWith(500);
    expect(chargeForPages(before, 0, 'nothing arrived', AT, 'e1')).toBe(before);
  });

  it('knows when the balance will not cover something', () => {
    const ledger = ledgerWith(100);
    expect(canAfford(ledger, 100)).toBe(true);
    expect(canAfford(ledger, 101)).toBe(false);
  });
});

describe('the statement', () => {
  it('reads most recent first', () => {
    let ledger = ledgerWith(1000);
    ledger = chargeForPages(ledger, 3, 'first', AT, 'e1');
    ledger = chargeForQuestion(ledger, 'second', AT, 'e2');
    expect(ledger.entries.map((e) => e.detail)).toEqual(['second', 'first', 'Top-up']);
  });

  it('says what each movement was for', () => {
    const ledger = chargeForPages(ledgerWith(1000), 14, 'Tenancy contract · 14 pages', AT, 'e1');
    expect(ledger.entries[0]).toMatchObject({
      kind: 'read',
      detail: 'Tenancy contract · 14 pages',
      delta: -140,
    });
  });

  /*
   * The balance is carried, never recomputed from the entries — and this is
   * why. Once the list is trimmed, a balance derived from it would be wrong,
   * silently, and in our favour, which is the worst direction for a money bug.
   */
  it('keeps the balance right after old entries are trimmed away', () => {
    let ledger = ledgerWith(100_000);
    for (let i = 0; i < MAX_ENTRIES + 50; i += 1) {
      ledger = chargeForQuestion(ledger, `q${i}`, AT, `e${i}`);
    }
    expect(ledger.entries).toHaveLength(MAX_ENTRIES);
    expect(ledger.balance).toBe(100_000 - (MAX_ENTRIES + 50) * CREDITS_PER_QUESTION);
  });
});

describe('giving credits back', () => {
  it('returns what was taken', () => {
    let ledger = ledgerWith(1000);
    ledger = chargeForPages(ledger, 14, 'read', AT, 'e1');
    ledger = refund(ledger, priceOfPages(14), 'read failed', AT, 'e2');
    expect(ledger.balance).toBe(1000);
  });

  it('cannot be made to take credits away by passing a negative', () => {
    const ledger = refund(ledgerWith(100), -50, 'malformed', AT, 'e1');
    expect(ledger.balance).toBe(150);
  });
});

describe('showing it to somebody', () => {
  it('groups a long number', () => {
    expect(formatCredits(1240)).toBe('1,240 credits');
  });

  it('never shows a negative balance as a negative number of credits', () => {
    expect(formatCredits(-10)).toBe('0 credits');
  });

  it('converts to money only where a price is being quoted', () => {
    expect(asMoney(3000)).toBe('$3.00');
    expect(asMoney(140)).toBe('$0.14');
  });

  it('counts whole documents, rounding down', () => {
    const ledger = ledgerWith(1000);
    // 14 pages is 140 credits, so 1000 covers seven of them and change.
    expect(documentsLeft(ledger, 14)).toBe(7);
  });

  it('says none rather than dividing by zero', () => {
    expect(documentsLeft(ledgerWith(1000), 0)).toBe(0);
  });
});

describe('applying a movement', () => {
  it('does not mutate the ledger it was given', () => {
    const before = ledgerWith(100);
    const entries = before.entries.length;
    apply(before, { id: 'x', at: AT.toISOString(), kind: 'question', detail: 'q', delta: -20 });
    expect(before.balance).toBe(100);
    expect(before.entries).toHaveLength(entries);
  });
});

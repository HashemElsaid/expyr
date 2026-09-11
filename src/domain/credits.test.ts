import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CREDITS_PER_PAGE,
  CREDITS_PER_QUESTION,
  EMPTY_LEDGER,
  MAX_ENTRIES,
  apply,
  asMoney,
  canAfford,
  chargeForPages,
  chargeForQuestion,
  formatCredits,
  hasEntry,
  pagesLeft,
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

  /*
   * Pages, not documents. Documents needed an assumed length, which made the
   * number a guess presented as a fact: somebody with a thirty-page contract
   * was told twenty-one documents and would have got ten.
   */
  it('counts pages exactly, since a credit is a tenth of one', () => {
    expect(pagesLeft(ledgerWith(1000))).toBe(100);
    expect(pagesLeft(ledgerWith(1505))).toBe(150);
  });

  it('never reports pages from a balance below zero', () => {
    expect(pagesLeft({ balance: -50, entries: [] })).toBe(0);
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

/*
 * iOS replays every unfinished transaction on each app launch. That is how a
 * purchase survives a crash between paying and being credited, so being asked
 * to add the same one twice is the ordinary course of working rather than an
 * error, and apply() on its own says yes every time.
 */
describe('crediting the same purchase twice', () => {
  const AT = new Date('2026-09-07T10:00:00Z');

  it('adds it once, however many times it arrives', () => {
    let ledger = topUp(EMPTY_LEDGER, 3000, 'credits.medium', AT, 'txn_1');
    expect(ledger.balance).toBe(3000);

    ledger = topUp(ledger, 3000, 'credits.medium', AT, 'txn_1');
    ledger = topUp(ledger, 3000, 'credits.medium', AT, 'txn_1');

    expect(ledger.balance).toBe(3000);
    expect(ledger.entries).toHaveLength(1);
  });

  it('still credits a genuinely different purchase', () => {
    let ledger = topUp(EMPTY_LEDGER, 1500, 'credits.small', AT, 'txn_1');
    ledger = topUp(ledger, 1500, 'credits.small', AT, 'txn_2');

    expect(ledger.balance).toBe(3000);
    expect(ledger.entries).toHaveLength(2);
  });

  it('knows what it has already recorded', () => {
    const ledger = topUp(EMPTY_LEDGER, 1500, 'credits.small', AT, 'txn_1');
    expect(hasEntry(ledger, 'txn_1')).toBe(true);
    expect(hasEntry(ledger, 'txn_2')).toBe(false);
  });

  /* The welcome grant uses a fixed id, so it must not stack on a reinstall. */
  it('does not hand out the welcome credits twice', () => {
    let ledger = topUp(EMPTY_LEDGER, 300, 'Welcome credits', AT, 'welcome');
    ledger = topUp(ledger, 300, 'Welcome credits', AT, 'welcome');
    expect(ledger.balance).toBe(300);
  });
});

/**
 * The phone and the service must agree on what everything costs.
 *
 * The phone draws the balance and decides what to offer; the service decides
 * what is actually taken, because a number in local storage is a number its
 * owner can edit. Two runtimes that cannot import from each other holding the
 * same figures is the pair that drifts, so this reads the service's prices as
 * text and fails the moment they disagree.
 */
describe('the app and the service agree on what things cost', () => {
  const pricing = readFileSync('server/pricing.ts', 'utf8');

  /*
   * Read line by line rather than with a constructed pattern. The first
   * attempt built one inside a template literal, where a backslash is eaten
   * before RegExp ever sees it, so every lookup quietly returned null and the
   * guard would have passed no matter what the service said.
   */
  /**
   * The phone's copy of the same figure, read as text.
   *
   * Not imported, deliberately. `src/store/settings.tsx` pulls in
   * AsyncStorage and expo-constants, and importing it here took expo-modules-
   * core with it and sank this whole file: twenty-eight tests stopped running
   * and the suite still said everything passed, because a file that fails to
   * load reports as a failed file rather than a failed test.
   */
  const phone = readFileSync('src/store/settings.tsx', 'utf8');
  /* Spelled out, because a backslash escape does not survive every editor. */
  const NEWLINE = String.fromCharCode(10);

  function phoneNumber(name: string): number | null {
    const line = phone
      .split(NEWLINE)
      .find((candidate) => candidate.startsWith(`export const ${name} = `));
    if (!line) return null;
    const digits = line.slice(line.indexOf('=') + 1).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function serverNumber(name: string): number | null {
    const line = pricing
      .split('\n')
      .find((candidate) => candidate.startsWith(`export const ${name} = `));
    if (!line) return null;

    const digits = line.slice(line.indexOf('=') + 1).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : null;
  }

  it('charges the same for a page', () => {
    expect(serverNumber('CREDITS_PER_PAGE')).toBe(CREDITS_PER_PAGE);
  });

  it('charges the same for a question', () => {
    expect(serverNumber('CREDITS_PER_QUESTION')).toBe(CREDITS_PER_QUESTION);
  });

  /*
   * Whatever a new install is given, both sides have to give the same amount,
   * or somebody is shown credits that are refused the moment they spend them.
   *
   * That figure is now zero: Expyr AI is a Pro feature and the credits that
   * come with Pro are the opening balance. The assertion is against the
   * phone's own constant rather than a number written here, so this keeps
   * meaning something if it is ever turned back on.
   */
  it('opens a new account with what the app promises', () => {
    expect(serverNumber('WELCOME_CREDITS')).toBe(phoneNumber('WELCOME_CREDITS'));
  });

  /* Proves that reader too, so an unreadable file cannot pass as agreement. */
  it('can read the phone half at all', () => {
    expect(phoneNumber('WELCOME_CREDITS')).not.toBeNull();
    expect(phoneNumber('NOTHING_LIKE_THIS')).toBeNull();
  });

  it('would notice a disagreement', () => {
    expect(serverNumber('CREDITS_PER_PAGE')).not.toBe(CREDITS_PER_PAGE + 1);
    expect(serverNumber('NOTHING_LIKE_THIS')).toBeNull();
  });
});

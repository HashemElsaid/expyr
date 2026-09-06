import { describe, expect, it } from 'vitest';

import { CREDITS_PER_PAGE } from '@/domain/credits';
import { MAX_PAGES_READ, pagesToRead } from '@/domain/reading-limits';

/**
 * A fifty page contract is unbounded in both time and cost, and the pages that
 * answer questions are almost never at the back: contracts, policies and
 * licences put the dates, the parties and the terms at the front and fill the
 * rest with schedules.
 */
describe('how much of a document is read', () => {
  it('reads a short document whole', () => {
    expect(pagesToRead(1)).toBe(1);
    expect(pagesToRead(14)).toBe(14);
    expect(pagesToRead(MAX_PAGES_READ)).toBe(MAX_PAGES_READ);
  });

  it('stops at the cap for a long one', () => {
    expect(pagesToRead(31)).toBe(MAX_PAGES_READ);
    expect(pagesToRead(52)).toBe(MAX_PAGES_READ);
    expect(pagesToRead(500)).toBe(MAX_PAGES_READ);
  });

  /*
   * The number this exists to bound. Ten credits a page means no single
   * document can cost more than this, whatever somebody attaches.
   */
  it('bounds what any one document can cost', () => {
    expect(pagesToRead(10_000) * CREDITS_PER_PAGE).toBe(300);
  });

  it('cannot be talked into a negative or fractional page count', () => {
    expect(pagesToRead(-5)).toBe(0);
    expect(pagesToRead(0)).toBe(0);
    expect(pagesToRead(3.9)).toBe(3);
  });

  it('never returns more pages than the document has', () => {
    for (let total = 0; total <= 60; total += 1) {
      expect(pagesToRead(total)).toBeLessThanOrEqual(total);
    }
  });
});

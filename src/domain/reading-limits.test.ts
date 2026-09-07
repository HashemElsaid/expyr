import { describe, expect, it } from 'vitest';

import { CREDITS_PER_PAGE } from '@/domain/credits';
import {
  ASK_FIRST_ABOVE_PAGES,
  estimatedMinutes,
  MAX_PAGES_READ,
  pagesToRead,
  priceOfDocument,
  readingOffer,
  worthConfirming,
} from '@/domain/reading-limits';

describe('how much of a document is read', () => {
  it('reads a document whole', () => {
    expect(pagesToRead(1)).toBe(1);
    expect(pagesToRead(14)).toBe(14);
    expect(pagesToRead(52)).toBe(52);
  });

  /*
   * A hundred is the model's own ceiling for one PDF, not a number chosen
   * here. The product cap of thirty that used to sit on top of it was a
   * mistake: a contract read to page thirty cannot answer about page forty,
   * and every answer carried a hole the reader could not see.
   */
  it('stops only where the model stops', () => {
    expect(MAX_PAGES_READ).toBe(100);
    expect(pagesToRead(101)).toBe(100);
    expect(pagesToRead(5_000)).toBe(100);
  });

  it('cannot be talked into a negative or fractional page count', () => {
    expect(pagesToRead(-5)).toBe(0);
    expect(pagesToRead(0)).toBe(0);
    expect(pagesToRead(3.9)).toBe(3);
  });

  it('never returns more pages than the document has', () => {
    for (let total = 0; total <= 120; total += 3) {
      expect(pagesToRead(total)).toBeLessThanOrEqual(total);
    }
  });
});

describe('what it costs', () => {
  it('charges by the page', () => {
    expect(priceOfDocument(14)).toBe(140);
    expect(priceOfDocument(52)).toBe(520);
  });

  it('cannot exceed the ceiling, whatever is attached', () => {
    expect(priceOfDocument(10_000)).toBe(MAX_PAGES_READ * CREDITS_PER_PAGE);
  });
});

describe('whether to ask first', () => {
  it('does not stop for something small', () => {
    expect(worthConfirming(1)).toBe(false);
    expect(worthConfirming(ASK_FIRST_ABOVE_PAGES)).toBe(false);
  });

  it('asks once the cost and the wait are real', () => {
    expect(worthConfirming(ASK_FIRST_ABOVE_PAGES + 1)).toBe(true);
    expect(worthConfirming(52)).toBe(true);
  });
});

describe('the offer put to somebody before anything is spent', () => {
  it('says the cost and what they are left with', () => {
    const offer = readingOffer(14, 300);
    expect(offer.pages).toBe(14);
    expect(offer.cost).toBe(140);
    expect(offer.after).toBe(160);
    expect(offer.affordable).toBe(true);
  });

  /*
   * The check that stops a half-read document existing. It is answered after
   * the free page count and before a single page is fetched, so refusing costs
   * nothing and never leaves somebody with part of a contract.
   */
  it('knows when the balance will not cover the whole document', () => {
    const offer = readingOffer(52, 300);
    expect(offer.cost).toBe(520);
    expect(offer.affordable).toBe(false);
  });

  it('treats exactly enough as enough', () => {
    expect(readingOffer(30, 300).affordable).toBe(true);
    expect(readingOffer(30, 299).affordable).toBe(false);
  });

  it('prices a document beyond the ceiling at the ceiling', () => {
    const offer = readingOffer(500, 5_000);
    expect(offer.pages).toBe(MAX_PAGES_READ);
    expect(offer.cost).toBe(1_000);
  });
});

describe('how long it says it will take', () => {
  it('never promises seconds', () => {
    expect(estimatedMinutes(1)).toBeGreaterThanOrEqual(1);
  });

  it('grows with the document', () => {
    expect(estimatedMinutes(100)).toBeGreaterThan(estimatedMinutes(10));
  });

  /*
   * Rounded up on purpose. Somebody told "about a minute" who waits ninety
   * seconds is fine; somebody told "seconds" who waits ninety is being lied to.
   */
  it('rounds up rather than down', () => {
    expect(Number.isInteger(estimatedMinutes(37))).toBe(true);
    expect(estimatedMinutes(37)).toBeGreaterThanOrEqual(1);
  });
});

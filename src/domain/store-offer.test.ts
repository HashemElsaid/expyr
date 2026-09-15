import { describe, expect, it } from 'vitest';

import { canBuy, offerFor } from './store-offer';

const PRO = 'pro.lifetime';

describe('whether a thing is actually for sale', () => {
  /*
   * The bug, exactly. Expyr Pro was never submitted for review, so the
   * storefront has no such product, and this is the case that used to fall
   * through to the written table: the button read "Unlock Expyr Pro for
   * AED 149.00" and failed on tap, for every install since 10 September.
   */
  it('refuses a product the store answered it does not have', () => {
    const offer = offerFor({ 'credits.small': 'AED 19.99' }, PRO, 'AED 149.00');
    expect(offer).toEqual({ kind: 'unavailable' });
    expect(canBuy(offer)).toBe(false);
  });

  it('refuses when the store has nothing at all', () => {
    expect(offerFor({}, PRO, 'AED 149.00')).toEqual({ kind: 'unavailable' });
  });

  /*
   * The middle answer, and the reason there are three. Not hearing back is not
   * the same as being told no: a build with no store in it, Expo Go, a device
   * with no network. Those still show the written price, because the
   * alternative is a blank screen on every build that could never sell anyway.
   */
  it('shows the written price when it never heard back', () => {
    const offer = offerFor(null, PRO, 'AED 149.00');
    expect(offer).toEqual({ kind: 'unknown', price: 'AED 149.00' });
    expect(canBuy(offer)).toBe(true);
  });

  /** Apple's own price wins whenever there is one, which is the ordinary case. */
  it('prefers the storefront price over the written one', () => {
    const offer = offerFor({ [PRO]: 'US$39.99' }, PRO, 'AED 149.00');
    expect(offer).toEqual({ kind: 'available', price: 'US$39.99' });
    expect(canBuy(offer)).toBe(true);
  });

  /*
   * Per product, not per store. The three credit packs are approved and Pro is
   * not, so the same reply has to say yes to one id and no to another.
   */
  it('answers per product from one reply', () => {
    const prices = { 'credits.small': 'AED 19.99' };
    expect(canBuy(offerFor(prices, 'credits.small', 'x'))).toBe(true);
    expect(canBuy(offerFor(prices, PRO, 'x'))).toBe(false);
  });

  /** An empty price string is not a price, whatever StoreKit meant by it. */
  it('does not treat an empty price as a price', () => {
    expect(offerFor({ [PRO]: '' }, PRO, 'AED 149.00')).toEqual({ kind: 'unavailable' });
  });
});

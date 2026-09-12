import { describe, expect, it } from 'vitest';

import { wantsProtectOffer } from './protect-offer';

const BOUGHT = { canSignIn: true, hasAccount: false, creditsGranted: 500 };

describe('offering to protect credits that were just bought', () => {
  it('offers at the one moment there is anything to protect', () => {
    expect(wantsProtectOffer(BOUGHT)).toBe(true);
  });

  /*
   * Their credits already survive a reinstall, so the offer would be asking
   * for something the app already has.
   */
  it('says nothing to somebody who already signed in', () => {
    expect(wantsProtectOffer({ ...BOUGHT, hasAccount: true })).toBe(false);
  });

  /*
   * An offer that cannot be accepted is a dead end, which item 20 rules out.
   * Sign in with Apple is missing in Expo Go and on a device that has no
   * Apple ID, and the button would go nowhere.
   */
  it('says nothing where signing in cannot work', () => {
    expect(wantsProtectOffer({ ...BOUGHT, canSignIn: false })).toBe(false);
  });

  /*
   * Apple replays a non-consumable at every launch, so a phone that already
   * has Pro redeems it again and again and is granted nothing each time. That
   * is not a purchase and not a moment to interrupt.
   */
  it('says nothing when the purchase was a replay that granted nothing', () => {
    expect(wantsProtectOffer({ ...BOUGHT, creditsGranted: 0 })).toBe(false);
  });
});

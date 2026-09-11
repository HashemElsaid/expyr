import { describe, expect, it } from 'vitest';

import { wantsLockOffer } from '@/domain/lock-offer';

/** Somebody who has just photographed their first document. */
const READY = {
  loaded: true,
  onboarded: true,
  alreadyOffered: false,
  lockEnabled: false,
  biometricsAvailable: true,
  holdsSomethingPrivate: true,
};

describe('when the app asks to be locked', () => {
  it('asks the person who has just put a document in it', () => {
    expect(wantsLockOffer(READY)).toBe(true);
  });

  /*
   * Every flag reads false before settings come off disk, so asking then would
   * offer the lock to somebody who already turned it on.
   */
  it('says nothing until it knows what the settings are', () => {
    expect(wantsLockOffer({ ...READY, loaded: false })).toBe(false);
  });

  it('waits for onboarding to be over', () => {
    expect(wantsLockOffer({ ...READY, onboarded: false })).toBe(false);
  });

  /* Once, whatever the answer was. An app that asks twice ignored the first. */
  it('never asks a second time', () => {
    expect(wantsLockOffer({ ...READY, alreadyOffered: true })).toBe(false);
  });

  it('has nothing to offer somebody already locked', () => {
    expect(wantsLockOffer({ ...READY, lockEnabled: true })).toBe(false);
  });

  /* Offering a lock that cannot be turned on is a dead end with a button. */
  it('does not offer what the phone cannot do', () => {
    expect(wantsLockOffer({ ...READY, biometricsAvailable: false })).toBe(false);
  });

  /*
   * A date typed in by hand is not worth interrupting anybody for. The offer is
   * about photographs of passports and ID cards.
   */
  it('waits until there is something worth locking', () => {
    expect(wantsLockOffer({ ...READY, holdsSomethingPrivate: false })).toBe(false);
  });
});

/**
 * Whether to offer the app lock, which is asked once and never again.
 *
 * Pulled out of the component because the rule has six clauses and every one
 * of them is a decision: that it waits for settings to load, that it waits for
 * onboarding to finish, that one answer of either kind ends it for ever, that
 * it is never offered where it cannot work, and that a typed-in date is not
 * worth interrupting anybody for.
 *
 * When to show it is a separate question from whether to, and it does not live
 * here. The moment this turns true is the moment a document was saved, which
 * is also a moment the screen is very likely moving, and presenting a modal
 * into a navigation transition is what froze the app for every first-time
 * user. `LockOffer` waits for the interface to be still.
 */
export function wantsLockOffer(state: {
  /** Settings have been read off disk. Before that every flag is a default. */
  loaded: boolean;
  onboarded: boolean;
  /** Asked already, whatever the answer was. */
  alreadyOffered: boolean;
  /** Already locked, so there is nothing to offer. */
  lockEnabled: boolean;
  /** Face ID, Touch ID or a passcode, enrolled on this phone. */
  biometricsAvailable: boolean;
  /**
   * Something worth locking: a document with a photograph attached. A passport
   * or an ID is what somebody would mind a stranger seeing; an expiry date
   * typed in by hand is not.
   */
  holdsSomethingPrivate: boolean;
}): boolean {
  return (
    state.loaded &&
    state.onboarded &&
    !state.alreadyOffered &&
    !state.lockEnabled &&
    state.biometricsAvailable &&
    state.holdsSomethingPrivate
  );
}

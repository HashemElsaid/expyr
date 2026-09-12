/**
 * Whether a purchase just made is worth offering to protect.
 *
 * Credits live against the install token until somebody signs in, and a
 * reinstall issues a new one. The service will not pay the same Apple purchase
 * twice — that hole is closed — so the honest consequence of deleting the app
 * without an account is that the credits are gone and no later sign-in brings
 * them back. There is no remedy afterwards, only before, which is why the ask
 * belongs at the moment they are bought rather than in a settings screen
 * somebody visits after losing them.
 *
 * Offered, never required. A purchase completes whatever the answer is, and
 * `Not now` is a full answer that is never asked again for that purchase.
 *
 * Separate from the component because each clause is a decision. Nothing is
 * offered to somebody who already has an account, since theirs are already
 * safe. Nothing is offered where Sign in with Apple cannot run, because an
 * offer that cannot be accepted is a dead end. And nothing is offered for a
 * purchase that granted nothing: a replayed entitlement on a phone that
 * already has Pro is not a moment to interrupt.
 */
export function wantsProtectOffer(state: {
  /** Sign in with Apple is available on this phone and this build. */
  canSignIn: boolean;
  /** Already signed in, so the credits already survive a reinstall. */
  hasAccount: boolean;
  /**
   * What the service actually granted for this purchase. Zero means it had
   * been paid before and this was a replay, which buys nothing to protect.
   */
  creditsGranted: number;
}): boolean {
  return state.canSignIn && !state.hasAccount && state.creditsGranted > 0;
}

/**
 * Purchase surface for the paywall.
 *
 * Real in-app purchases need three things Expyr does not have yet: a paid
 * Apple Developer account, products configured in App Store Connect, and a
 * RevenueCat project. Until then this module keeps the entitlement locally so
 * the whole flow can be built and tested.
 *
 * To go live, replace `restore` and `purchase` with RevenueCat calls and read
 * the entitlement from its customer info instead of settings.premium.
 *
 * Both products must be marked Family Shareable in App Store Connect. Apple
 * gives no way to read a family roster — it is hidden by design — so the only
 * lever we have is whether a purchase can be shared at all. Sharing it is the
 * right call: a household that cannot share is a household with a reason to
 * pile everyone's documents onto one phone, which is worse for them and worth
 * nothing to us. Apple caps a family at six and limits how often somebody can
 * switch families, which is a firmer boundary than anything we could enforce.
 */

export type Plan = {
  id: 'lifetime';
  title: string;
  price: string;
  cadence: string;
  footnote?: string;
};

/**
 * One price, paid once. Placeholder until it matches App Store Connect.
 *
 * A subscription was the wrong shape for this app. Expyr is built to be silent
 * — the months where nothing expires are the app working, not failing — and
 * renting something designed to say nothing invites the question "what am I
 * paying for" at every renewal. Every competitor in this category charges once,
 * in the AED 119–150 band.
 *
 * AED 149 sits at the top of that band rather than under it, because the app
 * does more than name a date: it carries the renewal steps, the fees, the fine
 * for lateness and the authority for the user's own emirate.
 *
 * Scanning costs a fraction of a fil per read, so a single payment covers years
 * of it comfortably. The free scan ceiling is there for abuse, not economics.
 */
export const PLANS: Plan[] = [
  {
    id: 'lifetime',
    title: 'Expyr, unlocked',
    price: 'AED 149',
    cadence: 'once',
    footnote: 'Pay once. Nothing renews, nothing to cancel.',
  },
];

/**
 * One tier, not two. Tracking the family is a reason to upgrade, not a separate
 * product — today it is a name on an item, with no per-household cost behind it.
 * Revisit if real cross-device sharing is ever built.
 */
export const PREMIUM_FEATURES = [
  'Track as many items as you like',
  'Scan without counting — no 15-scan ceiling',
  'Everyone in the house, not just you',
  'Shared with your Apple family, up to six people',
  'Back up and restore your whole archive',
];

export type PurchaseOutcome = { ok: true } | { ok: false; message: string };

export async function purchase(_plan: Plan['id']): Promise<PurchaseOutcome> {
  return {
    ok: false,
    message:
      'Payments are not connected yet. This needs an Apple Developer account and products set up in App Store Connect.',
  };
}

export async function restore(): Promise<PurchaseOutcome> {
  return {
    ok: false,
    message: 'There is nothing to restore until payments are connected.',
  };
}

/**
 * Purchase surface for the paywall.
 *
 * Real in-app purchases need three things Renewly does not have yet: a paid
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
  id: 'annual' | 'lifetime';
  title: string;
  price: string;
  cadence: string;
  footnote?: string;
  highlight?: string;
  /** Auto-renewing plans carry disclosure a one-off purchase must not claim. */
  renews: boolean;
};

/**
 * Placeholder pricing — these must match App Store Connect before launch.
 *
 * The yearly price sits just under the utilities category median (about
 * AED 141) and under the one-time price the nearest competitor charges, so we
 * are cheaper in year one and still earning in year two. The one-off is priced
 * at roughly three years because scanning costs us a model call every time —
 * a single payment has to cover the reading somebody does for years afterwards.
 */
export const PLANS: Plan[] = [
  {
    id: 'annual',
    title: 'Yearly',
    price: 'AED 129',
    cadence: 'per year',
    footnote: 'About AED 11 a month',
    highlight: 'Most popular',
    renews: true,
  },
  {
    id: 'lifetime',
    title: 'One payment',
    price: 'AED 399',
    cadence: 'once',
    footnote: 'Yours for good — nothing renews',
    renews: false,
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

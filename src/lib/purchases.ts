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
 */

export type Plan = {
  id: 'monthly' | 'annual';
  title: string;
  price: string;
  cadence: string;
  footnote?: string;
  highlight?: string;
};

/** Placeholder pricing — these must match App Store Connect before launch. */
export const PLANS: Plan[] = [
  {
    id: 'annual',
    title: 'Yearly',
    price: 'AED 79',
    cadence: 'per year',
    footnote: 'Works out at about AED 6.60 a month',
    highlight: 'Best value',
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: 'AED 12',
    cadence: 'per month',
  },
];

export const PREMIUM_FEATURES = [
  'Track as many items as you like',
  'Scan documents without limit',
  'Keep everyone in the family in one app',
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

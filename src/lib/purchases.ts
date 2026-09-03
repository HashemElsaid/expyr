import { getLocales } from 'expo-localization';

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
 * What the purchase costs, per storefront.
 *
 * Nobody converts currency here, and nobody should. Apple charges in the
 * currency of the account's storefront, at the price set for that storefront in
 * App Store Connect — so AED 149 in Dubai is not $149 in New York, it is
 * whatever price point was chosen for the United States. Multiplying by a rate
 * we looked up once would drift the moment rates move, and showing a person a
 * number they are not about to be charged is what Guideline 3.1.2 exists to
 * stop.
 *
 * These are price points rather than conversions: the familiar local shapes of
 * roughly the same money, the way every app on the store is priced. They are
 * the numbers to enter in App Store Connect, and the moment StoreKit is wired
 * this table is deleted — `displayPrice` on the product comes back already
 * localised, formatted and correct, including the storefronts nobody thought
 * to list here.
 */
const PRICE_POINTS: Record<string, string> = {
  AE: 'AED 149',
  SA: 'SAR 149.99',
  QA: 'QAR 149.99',
  KW: 'KWD 12.500',
  BH: 'BHD 14.900',
  OM: 'OMR 15.900',
  EG: 'EGP 1,999',
  US: '$39.99',
  GB: '£34.99',
  CA: 'CA$54.99',
  AU: 'A$59.99',
  IN: '₹3,500',
  PK: 'Rs 10,900',
  PH: '₱2,290',
  DE: '€39.99',
  FR: '€39.99',
  ES: '€39.99',
  IT: '€39.99',
  NL: '€39.99',
};

/** The storefront Apple would bill against: the phone's own region. */
function region(): string {
  try {
    return getLocales()[0]?.regionCode?.toUpperCase() ?? 'AE';
  } catch {
    return 'AE';
  }
}

/**
 * The price to show. Anywhere without a listed point falls back to the dollar
 * price, which is what Apple's own price matrix does with a storefront that has
 * no local currency of its own.
 */
export function localPrice(): string {
  const here = region();
  return PRICE_POINTS[here] ?? PRICE_POINTS.US;
}

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
export function plans(): Plan[] {
  return [
    {
      id: 'lifetime',
      title: 'Expyr Pro',
      price: localPrice(),
      cadence: 'once',
      footnote: 'Pay once. Nothing renews, nothing to cancel.',
    },
  ];
}

/*
 * The feature list that used to live here promised things the free plan
 * already does — household names, backups, family sharing — because it was
 * written as marketing rather than from the code. What Pro actually lifts is
 * the three ceilings, so the comparison is built in the paywall screen from
 * the limits themselves and cannot drift away from them again.
 */

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

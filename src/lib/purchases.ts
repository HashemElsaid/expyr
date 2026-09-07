import { getLocales } from 'expo-localization';

import { PRO_PRODUCT_ID, type CreditPackId } from '@/lib/products';
import { redeemWithService } from '@/lib/redeem';
import { buy, sweep, type Redeemed } from '@/lib/store';

export { PRO_PRODUCT_ID } from '@/lib/products';

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
  /** Ours, internal. Apple's identifier is PRO_PRODUCT_ID. */
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
  /*
   * Read off App Store Connect on 7 September, against a base of AED 149.00.
   * These are what Apple actually generated, not what anybody expected: the
   * Saudi price was twenty per cent low and every euro storefront was five
   * euros out.
   */
  AE: 'AED 149',
  SA: 'SAR 179.99',
  QA: 'QAR 149.99',
  US: '$39.99',
  GB: '£39.99',
  DE: '€44.99',
  FR: '€44.99',
  ES: '€44.99',
  IT: '€44.99',
  NL: '€44.99',

  /*
   * Not yet read off App Store Connect, and therefore wrong until they are.
   *
   * Left in rather than deleted because the alternative is worse: with no
   * entry these storefronts fall back to the dollar price, and quoting dollars
   * to somebody in Cairo is a number in the wrong currency rather than merely
   * the wrong amount. Both are wrong; one of them at least looks local while
   * being close.
   *
   * None of this table is shown once the store answers. `priceList` asks
   * StoreKit for each product's own displayPrice, already localised and
   * formatted for the buyer's storefront and correct by construction, and the
   * screens prefer it. This is what they fall back to when the store cannot be
   * reached, which is the only case where an approximation beats nothing.
   */
  KW: 'KWD 12.500',
  BH: 'BHD 14.900',
  OM: 'OMR 15.900',
  EG: 'EGP 1,999',
  CA: 'CA$54.99',
  AU: 'A$59.99',
  IN: '₹3,500',
  PK: 'Rs 10,900',
  PH: '₱2,290',
};

/**
 * The storefronts whose prices have actually been read off App Store Connect.
 *
 * Kept because "which of these did somebody check" is otherwise a fact that
 * lives only in a chat message, and the answer decides whether a number on
 * screen is a price or a guess.
 */
export const VERIFIED_STOREFRONTS = ['AE', 'SA', 'QA', 'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL'];

/** The storefront Apple would bill against: the phone's own region. */
export function region(): string {
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
      footnote: undefined,
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

export type PurchaseOutcome =
  | { ok: true }
  /** They changed their mind. Not a failure, and not worth an alert. */
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; message: string };

/**
 * Buys Expyr Pro.
 *
 * Nothing is entitled here on the phone's say so. The service asks Apple what
 * the transaction was, and only a confirmed purchase of PRO_PRODUCT_ID comes
 * back with pro set.
 */
export async function purchase(_plan: Plan['id']): Promise<PurchaseOutcome> {
  const outcome = await buy(PRO_PRODUCT_ID, redeemWithService);
  if (!outcome.ok) return outcome;
  return outcome.redeemed.pro === true
    ? { ok: true }
    : { ok: false, message: 'That purchase did not include Expyr Pro.' };
}

/**
 * Buys a credit pack.
 *
 * Returns what the service granted rather than a bare yes, because the caller
 * needs Apple's transaction identifier: it is what keys the phone's copy of
 * the ledger, so the same purchase arriving twice is written once.
 */
export async function purchaseCredits(
  packId: CreditPackId
): Promise<{ ok: true; redeemed: Redeemed } | Exclude<PurchaseOutcome, { ok: true }>> {
  const outcome = await buy(packId, redeemWithService);
  if (!outcome.ok) return outcome;
  if (typeof outcome.redeemed.credits !== 'number') {
    return { ok: false, message: 'That purchase did not include any credits.' };
  }
  return { ok: true, redeemed: outcome.redeemed };
}

/**
 * Restores a previous purchase.
 *
 * On iOS this is the same operation as recovering an interrupted one: Apple
 * hands back everything it is still holding for this Apple Account, and each
 * is put through the same verification a fresh purchase gets. Somebody on a
 * new phone and somebody whose app died mid-purchase are doing the same thing
 * and get the same code.
 */
export async function restore(): Promise<PurchaseOutcome> {
  const redeemed = await sweep(redeemWithService);
  return redeemed.some((item) => item.pro === true)
    ? { ok: true }
    : {
        ok: false,
        message:
          'Apple has no previous purchase of Expyr Pro for this Apple Account. If you bought it with a different one, sign in with that Apple Account and try again.',
      };
}

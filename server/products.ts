/**
 * What each thing on sale is actually worth.
 *
 * This is the authority, and it lives here rather than on the phone for one
 * reason: the phone is not trusted. If a purchase arrived saying "this was
 * credits.large, please add 6,500", a modified build could say 6,500,000 just
 * as easily. The phone reports *which product* Apple sold, Apple confirms that
 * independently, and this file decides what it buys.
 *
 * The identifiers are the ones registered in App Store Connect and cannot be
 * changed afterwards. See LAUNCH.md for the table and the reason.
 */

export type Grant =
  /** The one off purchase. Takes the ceilings off; nothing is added to a balance. */
  | { kind: 'pro' }
  /** A credit pack. */
  | { kind: 'credits'; credits: number };

/**
 * Consumables can be bought again; the non-consumable cannot. Apple needs to be
 * told which, or a credit pack is bought once and never again.
 */
export type ProductKind = 'consumable' | 'nonConsumable';

export type Product = {
  id: string;
  kind: ProductKind;
  grant: Grant;
};

/**
 * The credit figures are duplicated from `src/lib/credit-packs.ts`, which the
 * phone uses to draw the top-up screen. They have to agree, and a test in the
 * app suite reads this file and fails if they ever stop agreeing, because two
 * numbers meaning the same thing in two runtimes is exactly the pair that
 * drifts.
 */
export const PRODUCTS: readonly Product[] = [
  { id: 'pro.lifetime', kind: 'nonConsumable', grant: { kind: 'pro' } },
  { id: 'credits.small', kind: 'consumable', grant: { kind: 'credits', credits: 1_500 } },
  { id: 'credits.medium', kind: 'consumable', grant: { kind: 'credits', credits: 3_000 } },
  { id: 'credits.large', kind: 'consumable', grant: { kind: 'credits', credits: 6_500 } },
];

/**
 * What a product buys, or null when we have never heard of it.
 *
 * Null rather than a throw or a default, because an unknown identifier is not
 * an error to shout about: it is what an older service sees when a newer app
 * sells something it has not been taught yet. The caller refuses the redemption
 * and the purchase stays unfinished with Apple, so it can be redeemed again
 * once this file knows about it. Nothing is lost and nothing is invented.
 */
export function grantFor(productId: string): Grant | null {
  return PRODUCTS.find((product) => product.id === productId)?.grant ?? null;
}

/** How many credits a product is worth, or zero if it is not a credit pack. */
export function creditsFor(productId: string): number {
  const grant = grantFor(productId);
  return grant?.kind === 'credits' ? grant.credits : 0;
}

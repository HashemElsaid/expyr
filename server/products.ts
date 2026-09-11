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
  /** The one off purchase. Takes the ceilings off, and comes with credits. */
  | { kind: 'pro'; credits: number }
  /** A credit pack. */
  | { kind: 'credits'; credits: number };

/**
 * What Expyr Pro includes, beyond taking the ceilings off.
 *
 * Pro used to grant nothing at all: it lifted the item and scan limits and
 * left Expyr AI to the welcome credits, the same three hundred every install
 * gets. So the most expensive thing in the app made no difference to the one
 * feature that costs us money per use, and somebody who had just paid for
 * everything found the good part still metered.
 *
 * Fifty pages. It is worth about fifty cents to honour, against a purchase
 * that clears twenty-eight dollars at Apple's worst rate, and it is granted
 * once against Apple's transaction identifier so a restore or a reinstall
 * replays it without paying twice.
 */
export const PRO_CREDITS = 500;

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
  { id: 'pro.lifetime', kind: 'nonConsumable', grant: { kind: 'pro', credits: PRO_CREDITS } },
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

/** How many credits a product is worth, or zero if we have never heard of it. */
export function creditsFor(productId: string): number {
  return grantFor(productId)?.credits ?? 0;
}

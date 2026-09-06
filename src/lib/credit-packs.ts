import { CREDIT_COST_USD, priceOfPages, type Credits } from '@/domain/credits';

/**
 * What a top-up costs, and what it buys.
 *
 * Credits are meant to be sold at what they cost us, with the profit coming
 * from the one-off purchase. Apple makes that arithmetic less obvious than it
 * sounds: it takes thirty percent of every pack sold (fifteen under the Small
 * Business Program), so a five dollar pack yields three fifty. Sell five
 * dollars of credits for five dollars and every top-up loses a dollar fifty.
 *
 * So each pack holds a little under seventy percent of its price in credits.
 * That is not a markup — it is the price minus Apple's share, which is the
 * money that actually arrives. What is left over covers the summaries and the
 * hosting rather than being profit.
 *
 * The bigger the pack, the better the rate. Somebody committing more should
 * not be quietly penalised for it.
 */
export type Pack = {
  /** Matches the product identifier in App Store Connect. */
  id: 'credits.small' | 'credits.medium' | 'credits.large';
  credits: Credits;
  /** Placeholder until StoreKit returns the storefront's own formatted price. */
  price: string;
  /** USD, for working out the rate. Never shown. */
  usd: number;
};

/**
 * Every pack must satisfy `credits <= usd * 700`, which is the price less
 * Apple's worst-case share, converted at a tenth of a cent per credit. The
 * test suite asserts it so a future price change cannot quietly go underwater.
 */
export const PACKS: Pack[] = [
  { id: 'credits.small', credits: 3_000, price: '$4.99', usd: 4.99 },
  { id: 'credits.medium', credits: 6_500, price: '$9.99', usd: 9.99 },
  { id: 'credits.large', credits: 13_500, price: '$19.99', usd: 19.99 },
];

/** Apple's largest share, and so the one every pack has to survive. */
export const APPLE_SHARE = 0.3;

/** What the credits in a pack cost us to honour, in dollars. */
export function costToHonour(pack: Pack): number {
  return pack.credits * CREDIT_COST_USD;
}

/** What actually arrives after Apple's share. */
export function revenueFrom(pack: Pack): number {
  return pack.usd * (1 - APPLE_SHARE);
}

/**
 * Roughly how many ordinary documents a pack reads.
 *
 * Fourteen pages is the length of the tenancy contract this was all built
 * around, and a fair stand-in for the paperwork people actually keep.
 */
export const TYPICAL_PAGES = 14;

export function documentsIn(pack: Pack): number {
  return Math.floor(pack.credits / priceOfPages(TYPICAL_PAGES));
}

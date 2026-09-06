import { CREDIT_COST_USD, CREDITS_PER_PAGE, type Credits } from '@/domain/credits';

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
  { id: 'credits.small', credits: 1_500, price: '$2.99', usd: 2.99 },
  { id: 'credits.medium', credits: 3_000, price: '$4.99', usd: 4.99 },
  { id: 'credits.large', credits: 6_500, price: '$9.99', usd: 9.99 },
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
 * How many pages a pack reads, which is a fact rather than a guess.
 *
 * This used to say documents, worked out by assuming every document is
 * fourteen pages. It reads better and it is not true: somebody whose tenancy
 * contract runs to thirty pages was told twenty-one documents and would have
 * got ten. A number the app cannot keep is worse than a duller one it can.
 *
 * A credit is a tenth of a page by definition, so this is arithmetic. And a
 * page is a thing anybody can count before they buy.
 */
export function pagesIn(pack: Pack): number {
  return Math.floor(pack.credits / CREDITS_PER_PAGE);
}

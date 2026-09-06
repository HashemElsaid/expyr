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
  /**
   * Apple's price points for this pack, by storefront. Placeholders until
   * StoreKit hands back the storefront's own formatted price, and the same
   * arrangement `purchases.ts` uses for Expyr Pro: nobody converts currency
   * here, because Apple charges the price set for that storefront and a figure
   * we worked out is a figure nobody is about to be charged.
   */
  prices: Record<string, string>;
  /** USD, which is what the economics are worked out against. Never shown. */
  usd: number;
};

/**
 * Every pack must satisfy `credits <= usd * 700`, which is the price less
 * Apple's worst-case share, converted at a tenth of a cent per credit. The
 * test suite asserts it so a future price change cannot quietly go underwater.
 */
export const PACKS: Pack[] = [
  {
    id: 'credits.small',
    credits: 1_500,
    usd: 2.99,
    prices: { AE: 'AED 10.99', SA: 'SAR 12.99', QA: 'QAR 12.99', GB: '£2.99', EU: '€2.99', US: '$2.99' },
  },
  {
    id: 'credits.medium',
    credits: 3_000,
    usd: 4.99,
    prices: { AE: 'AED 18.99', SA: 'SAR 22.99', QA: 'QAR 21.99', GB: '£4.99', EU: '€4.99', US: '$4.99' },
  },
  {
    id: 'credits.large',
    credits: 6_500,
    usd: 9.99,
    prices: { AE: 'AED 36.99', SA: 'SAR 44.99', QA: 'QAR 42.99', GB: '£9.99', EU: '€9.99', US: '$9.99' },
  },
];

/** Storefronts billed in euros, so one entry can serve all of them. */
const EURO = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'BE', 'AT', 'PT', 'FI', 'GR']);

/**
 * The price to show, for the phone's own storefront.
 *
 * Falls back to dollars, which is what Apple's own matrix does with a
 * storefront that has no local price of its own. The important part is that it
 * never shows a number in one currency next to Expyr Pro in another.
 */
export function priceOf(pack: Pack, region: string): string {
  if (pack.prices[region]) return pack.prices[region];
  if (EURO.has(region)) return pack.prices.EU;
  return pack.prices.US;
}

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

/**
 * What the four things on sale are called in App Store Connect.
 *
 * Its own module, with no imports, for two reasons. `purchases.ts` pulls in
 * expo-localization to read the storefront, so anything defined there cannot
 * be reached from a test without a native module present, which is a trap this
 * repository has walked into more than once. And these identifiers are needed
 * by the top-up screen, the paywall and the test that checks the service
 * agrees with us, none of which want the rest of the purchase machinery.
 *
 * Apple does not allow a product identifier to be renamed, reused or deleted
 * once it has been created. Changing a string here means abandoning a product
 * in App Store Connect. The service keeps its own copy in server/products.ts,
 * which is the authority on what each one is worth; this is only what they are
 * called. See LAUNCH.md for the table.
 */

/** The one off purchase. Non-consumable, family shareable. */
export const PRO_PRODUCT_ID = 'pro.lifetime';

/** The credit packs. Consumable, so each can be bought again. */
export type CreditPackId = 'credits.small' | 'credits.medium' | 'credits.large';

export const CREDIT_PACK_IDS: readonly CreditPackId[] = [
  'credits.small',
  'credits.medium',
  'credits.large',
];

/** Everything Expyr sells, which is everything App Store Connect must hold. */
export const PRODUCT_IDS: readonly string[] = [PRO_PRODUCT_ID, ...CREDIT_PACK_IDS];

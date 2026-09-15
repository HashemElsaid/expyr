/**
 * Whether a thing is actually for sale, and at what price.
 *
 * The paywall used to read `storePrices[PRO_PRODUCT_ID] ?? plan.price`, which
 * cannot tell the difference between "the store has not answered yet" and "the
 * store has no such product". Both came back as an empty record, so both fell
 * through to the written table and the button read "Unlock Expyr Pro for
 * AED 149.00" either way.
 *
 * For Expyr Pro that was not hypothetical. The product was never submitted for
 * review, so it has never existed on the storefront, and every install since
 * the tenth of September has been offered it at a price nothing could honour.
 * Tapping it failed. A missing product must not look purchasable.
 *
 * So three answers rather than two, and the middle one is the whole point: a
 * price we are unsure of is still worth showing, because the alternative is a
 * blank screen on every build with no store in it. A price we know does not
 * exist is not.
 */
export type Offer =
  /** StoreKit has not answered, or there is no store here. Show the table. */
  | { kind: 'unknown'; price: string }
  /** Apple's own price for this storefront, which is correct by construction. */
  | { kind: 'available'; price: string }
  /** The store answered and has nothing under this id. Do not offer it. */
  | { kind: 'unavailable' };

export function offerFor(
  /** Null when nothing was heard back. A record means StoreKit actually replied. */
  prices: Record<string, string> | null,
  id: string,
  written: string
): Offer {
  if (prices === null) return { kind: 'unknown', price: written };
  const price = prices[id];
  if (price) return { kind: 'available', price };
  return { kind: 'unavailable' };
}

/** Whether an offer can be bought, which is the only question a button asks. */
export function canBuy(offer: Offer): boolean {
  return offer.kind !== 'unavailable';
}

import { useEffect, useState } from 'react';

import { priceList } from '@/lib/store';

/**
 * What Apple says each product costs, in the buyer's own storefront.
 *
 * Every price written into this app by hand is a guess until somebody reads it
 * off App Store Connect, and the guesses have been wrong: the Saudi price was
 * twenty per cent low and every euro storefront was five euros out, for months,
 * silently. Eight storefronts are still unread.
 *
 * StoreKit already knows. Each product comes back with a displayPrice that is
 * localised, formatted and correct for whichever of the 175 storefronts the
 * buyer is in, and it stays correct when prices change without anybody editing
 * a file. So the tables in purchases.ts and credit-packs.ts stop being what the
 * screens show and become what they fall back to.
 *
 * Null until the store answers, and null for ever on a build with no store in
 * it, which is every build made before payments were added. Callers must fall
 * back rather than wait: a screen that showed nothing until StoreKit replied
 * would be blank on exactly the builds that cannot sell anyway.
 *
 * Null rather than an empty record, because a record is an answer. StoreKit
 * replying with no products means the storefront has none of them, which is
 * what has to stop a screen offering one. See `offerFor`.
 */
export function useStorePrices(): Record<string, string> | null {
  const [prices, setPrices] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let live = true;
    priceList()
      .then((found) => {
        if (live) setPrices(found);
      })
      .catch(() => {
        // The written prices are the fallback. Nothing to say about it here.
      });
    return () => {
      live = false;
    };
  }, []);

  return prices;
}

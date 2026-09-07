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
 * Empty until the store answers, and empty for ever on a build with no store
 * in it, which is every build made before payments were added. Callers must
 * fall back rather than wait: a screen that showed nothing until StoreKit
 * replied would be blank on exactly the builds that cannot sell anyway.
 */
export function useStorePrices(): Record<string, string> {
  const [prices, setPrices] = useState<Record<string, string>>({});

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

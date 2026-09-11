import { PRODUCT_IDS, PRO_PRODUCT_ID } from '@/lib/products';

/**
 * Buying things, and the order the steps have to happen in.
 *
 * Three facts about StoreKit shape everything here, and all three were read
 * out of expo-iap's own declarations rather than remembered.
 *
 * The outcome of a purchase does not come back from the call that starts it.
 * `requestPurchase` returns as soon as the sheet is dispatched; the result
 * arrives later on a listener. So a purchase is a promise this module builds by
 * hand around an event.
 *
 * A transaction must be finished, and only after it has been redeemed with the
 * service. Finish first and a crash between the two loses something somebody
 * paid for, with no way back. Redeem first and the worst case is redeeming
 * twice, which the ledger already refuses by transaction id.
 *
 * And an unfinished transaction replays on every launch. That is not a fault
 * to be defended against, it is the recovery mechanism: it is what carries a
 * purchase across a crash, a lost network, or an app that was killed while the
 * sheet was open. `sweep` is the other half of it.
 */

/** What a purchase turned into, once the service has confirmed it. */
export type Redeemed = {
  /** Apple's transaction identifier. The ledger's idempotency key. */
  transactionId: string;
  productId: string;
  /** Present for a credit pack. */
  credits?: number;
  /** True when this was the one off purchase. */
  pro?: boolean;
  /**
   * The balance the service holds after granting, which is the one that
   * counts. The phone keeps a copy so it can show a number without asking.
   */
  balance?: number;
};

export type StoreOutcome =
  | { ok: true; redeemed: Redeemed }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; message: string };

/**
 * Redeems a purchase with the service, which is the only thing that decides
 * what it is worth. Injected so the flow can be exercised without a store.
 */
export type Redeemer = (purchase: {
  transactionId: string;
  productId: string;
  token: string | null;
  sandbox: boolean;
}) => Promise<Redeemed>;

/**
 * expo-iap is a native module and is not in Expo Go, nor in any build made
 * before it was added. Loaded on demand and behind a catch so the rest of the
 * app keeps working on a build that has no store in it, which is every build
 * on a phone right now.
 */
type Iap = typeof import('expo-iap');
let loading: Promise<Iap | null> | null = null;

function iap(): Promise<Iap | null> {
  loading ??= import('expo-iap').catch(() => null);
  return loading;
}

/** Whether this build can sell anything at all. */
export async function storeAvailable(): Promise<boolean> {
  return (await connect()) !== null;
}

let connected = false;

/**
 * Opens the store, or answers that there is not one.
 *
 * The guard above this was written believing that importing expo-iap in a
 * runtime without it would fail, so `iap()` catching the import was the whole
 * of the check. It is not: expo-iap resolves its native module lazily, behind
 * a Proxy, on the first property anybody touches. So in Expo Go the import
 * succeeds, `iap()` hands back a module, every caller believes there is a
 * store, and the failure arrives later as "Cannot find native module 'ExpoIap'"
 * thrown from whichever line first used it.
 *
 * Which is how somebody tapping Top up in Expo Go got a red rejection toast
 * instead of the sentence written for exactly that case, three functions away.
 *
 * initConnection is the first property touched, so it is the honest place to
 * find out. A failure here means this runtime has no store, which is a fact
 * about the build rather than an error to report: every caller already has a
 * path for it.
 */
async function connect(): Promise<Iap | null> {
  const store = await iap();
  if (!store) return null;
  if (connected) return store;

  try {
    await store.initConnection();
    connected = true;
    return store;
  } catch {
    return null;
  }
}

/**
 * The store's own prices, formatted for the buyer's storefront.
 *
 * Worth having rather than the tables in credit-packs.ts and purchases.ts,
 * which are placeholders written from memory. Apple charges the price set for
 * that storefront, so a figure worked out here is a figure nobody is about to
 * be charged, and Guideline 3.1.2 exists because of exactly that.
 */
export async function priceList(): Promise<Record<string, string>> {
  const store = await connect();
  if (!store) return {};
  try {
    const products = await store.fetchProducts({ skus: [...PRODUCT_IDS], type: 'in-app' });
    const prices: Record<string, string> = {};
    for (const product of Array.isArray(products) ? products : []) {
      const id = (product as { id?: string }).id;
      const shown = (product as { displayPrice?: string }).displayPrice;
      if (id && shown) prices[id] = shown;
    }
    return prices;
  } catch {
    // A price we could not fetch is one the screen falls back to its table for.
    return {};
  }
}

/** Consumables can be bought again; the one off purchase cannot. */
function isConsumable(productId: string): boolean {
  return productId !== PRO_PRODUCT_ID;
}

/**
 * Takes one purchase all the way: redeem with the service, then finish with
 * Apple. Never the other way round.
 */
async function settle(store: Iap, purchase: unknown, redeem: Redeemer): Promise<Redeemed> {
  const p = purchase as {
    id: string;
    productId: string;
    purchaseToken?: string | null;
    environmentIOS?: string | null;
  };

  const redeemed = await redeem({
    transactionId: p.id,
    productId: p.productId,
    token: p.purchaseToken ?? null,
    sandbox: (p.environmentIOS ?? '').toLowerCase() === 'sandbox',
  });

  /*
   * Only now. Until this line the transaction is still Apple's, and Apple will
   * hand it back on the next launch if anything above went wrong.
   */
  await store.finishTransaction({
    purchase: purchase as never,
    isConsumable: isConsumable(p.productId),
  });

  return redeemed;
}

/**
 * Buys one product and returns what it turned into.
 *
 * The promise is built around the listener because that is where StoreKit
 * puts the answer. It resolves on a purchase for this product, rejects on an
 * error, and is cleaned up either way.
 */
export async function buy(productId: string, redeem: Redeemer): Promise<StoreOutcome> {
  const store = await connect();
  if (!store) {
    return {
      ok: false,
      message: 'This build cannot take payments yet. It needs a new build with the store in it.',
    };
  }

  return new Promise<StoreOutcome>((resolve) => {
    let done = false;
    const finish = (outcome: StoreOutcome) => {
      if (done) return;
      done = true;
      bought.remove();
      failed.remove();
      resolve(outcome);
    };

    const bought = store.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== productId) return;
      settle(store, purchase, redeem).then(
        (redeemed) => finish({ ok: true, redeemed }),
        (error: unknown) =>
          finish({
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : 'The purchase went through but could not be confirmed. It will be picked up next time you open Expyr.',
          }),
      );
    });

    const failed = store.purchaseErrorListener((error) => {
      if (error.code === 'user-cancelled') {
        finish({ ok: false, cancelled: true });
        return;
      }
      finish({ ok: false, message: error.message || 'That purchase did not go through.' });
    });

    store
      .requestPurchase({ request: { apple: { sku: productId } }, type: 'in-app' })
      .catch((error: unknown) =>
        finish({
          ok: false,
          message: error instanceof Error ? error.message : 'The store could not be reached.',
        }),
      );
  });
}

/**
 * Redeems anything Apple is still holding.
 *
 * The other half of never finishing a transaction early. Run at launch, this
 * is what carries a purchase across a crash, a dead network, or an app killed
 * while the sheet was open. It is also what "Restore a previous purchase"
 * does, because on iOS those are the same operation.
 *
 * Returns everything it managed to redeem. A failure is left alone rather than
 * reported: the transaction stays with Apple and comes back next launch, which
 * is a better outcome than an error somebody cannot act on.
 */
export async function sweep(redeem: Redeemer): Promise<Redeemed[]> {
  const store = await connect();
  if (!store) return [];

  let pending: unknown[] = [];
  try {
    pending = (await store.getAvailablePurchases()) as unknown[];
  } catch {
    return [];
  }

  const redeemed: Redeemed[] = [];
  for (const purchase of pending) {
    try {
      redeemed.push(await settle(store, purchase, redeem));
    } catch {
      // Left unfinished on purpose. Apple will offer it again.
    }
  }
  return redeemed;
}

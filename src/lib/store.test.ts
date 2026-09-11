import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Whether this runtime has a store, which is a harder question than it looks.
 *
 * The guard was written believing that importing expo-iap where it does not
 * exist would fail, so catching the import was the whole of the check. expo-iap
 * resolves its native module lazily, behind a Proxy, on the first property
 * anybody touches. So in Expo Go the import succeeds, the app believes it can
 * sell, and the failure arrives later as "Cannot find native module 'ExpoIap'"
 * thrown from whichever line first used it: a red rejection toast over the app
 * instead of the sentence written for exactly that case.
 *
 * These mock expo-iap the two ways it actually behaves, because the difference
 * between them is invisible at the import and total afterwards.
 */

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('expo-iap');
});

describe('a runtime with no store in it', () => {
  it('says so when the module is not there at all', async () => {
    vi.doMock('expo-iap', () => {
      throw new Error('Unable to resolve module expo-iap');
    });

    const { storeAvailable } = await import('@/lib/store');
    expect(await storeAvailable()).toBe(false);
  });

  /*
   * Expo Go. The module imports perfectly and every call into it throws, which
   * is the case the old guard could not see.
   */
  it('says so when the module imports but has no native half', async () => {
    vi.doMock('expo-iap', () => ({
      initConnection: () => {
        throw new Error("Cannot find native module 'ExpoIap'");
      },
    }));

    const { storeAvailable } = await import('@/lib/store');
    expect(await storeAvailable()).toBe(false);
  });

  /* And the friendly sentence rather than a rejection nobody caught. */
  it('refuses a purchase in words, and does not throw', async () => {
    vi.doMock('expo-iap', () => ({
      initConnection: () => {
        throw new Error("Cannot find native module 'ExpoIap'");
      },
    }));

    const { buy } = await import('@/lib/store');
    const outcome = await buy('pro.lifetime', async () => {
      throw new Error('the service must never be asked in this case');
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.cancelled).not.toBe(true);
    expect(outcome.ok === false && outcome.message).toMatch(/cannot take payments/i);
  });

  it('finds nothing to restore, rather than failing to look', async () => {
    vi.doMock('expo-iap', () => ({
      initConnection: () => {
        throw new Error("Cannot find native module 'ExpoIap'");
      },
    }));

    const { sweep } = await import('@/lib/store');
    expect(await sweep(async () => ({ transactionId: 'x', productId: 'y' }))).toEqual([]);
  });

  it('quotes no prices, so the written tables are used instead', async () => {
    vi.doMock('expo-iap', () => ({
      initConnection: () => {
        throw new Error("Cannot find native module 'ExpoIap'");
      },
    }));

    const { priceList } = await import('@/lib/store');
    expect(await priceList()).toEqual({});
  });
});

describe('a runtime that does have a store', () => {
  it('connects once, however many times it is asked', async () => {
    const initConnection = vi.fn(async () => true);
    vi.doMock('expo-iap', () => ({
      initConnection,
      fetchProducts: async () => [],
    }));

    const { storeAvailable, priceList } = await import('@/lib/store');
    expect(await storeAvailable()).toBe(true);
    await priceList();
    await priceList();

    expect(initConnection).toHaveBeenCalledTimes(1);
  });
});

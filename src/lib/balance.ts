import { usableBalance } from '@/domain/credits';
import { postJson } from '@/lib/http';

/** Long enough on a slow connection, short enough not to hold up a launch. */
const TIMEOUT_MS = 15_000;

/**
 * What the service says this phone can spend, asked without an Apple sheet.
 *
 * The install credential goes on every request and the service resolves the
 * account from it, so a phone that signed in once never has to prove it again
 * to read its own balance. That is the whole reason signing in stamps the
 * install durably.
 *
 * Returns null on anything at all going wrong, which is the important part: a
 * balance that could not be fetched must never be read as a balance of zero.
 * The phone's own copy is what it keeps showing, and being unable to reach the
 * service is not news about somebody's credits.
 *
 * `enforced` is the service admitting whether its own number means anything.
 * It is false when the credit store is not durable, and a balance from a store
 * that forgets is worse than no balance: adopting it would wipe the copy on
 * the phone, which at that moment is the only record left.
 */
export type ServiceStanding = {
  /** Null when the service would not stand behind a figure. See `usableBalance`. */
  balance: number | null;
  /** The account this install signed in to, or null if it never did. */
  account: string | null;
};

export async function serviceBalance(): Promise<ServiceStanding> {
  try {
    const reply = await postJson<{ balance?: unknown; enforced?: unknown; account?: unknown }>(
      '/account/available',
      {},
      { timeoutMs: TIMEOUT_MS }
    );
    return {
      balance: usableBalance(reply),
      account: typeof reply.account === 'string' ? reply.account : null,
    };
  } catch {
    return { balance: null, account: null };
  }
}

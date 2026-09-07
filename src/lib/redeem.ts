import { postJson } from '@/lib/http';
import type { Redeemed, Redeemer } from '@/lib/store';

/**
 * Turning a purchase into what it bought, by asking the service.
 *
 * The phone never decides this. It hands over the transaction identifier and
 * the service asks Apple what that transaction actually was, so a build that
 * lied about the product would be told what it really bought, which for an
 * invented identifier is nothing at all.
 *
 * Kept apart from store.ts so the purchase flow can be reasoned about without
 * a network in it, and so the flow can be driven by a different redeemer in a
 * test without either module knowing.
 */

/** Long enough for Apple to answer us, short enough that a phone is not stuck. */
const TIMEOUT_MS = 30_000;

type RedeemReply = {
  productId: string;
  credits?: number;
  balance?: number;
  granted?: boolean;
  pro?: boolean;
};

export const redeemWithService: Redeemer = async (purchase): Promise<Redeemed> => {
  const reply = await postJson<RedeemReply>(
    '/purchase/redeem',
    {
      transactionId: purchase.transactionId,
      productId: purchase.productId,
      token: purchase.token,
      sandbox: purchase.sandbox,
    },
    {
      timeoutMs: TIMEOUT_MS,
      messages: {
        /*
         * Every one of these describes a purchase that has been paid for and
         * not yet delivered, which is the most alarming thing this app can say
         * to somebody. So each one says the same true thing: the money is not
         * lost and Expyr will pick it up. It will, because the transaction is
         * left unfinished with Apple and iOS offers it again on every launch.
         */
        unauthorised: 'This copy of Expyr is not authorised to complete purchases.',
        refused:
          'Apple took the payment but Expyr could not confirm it yet. Nothing is lost. Open Expyr again in a moment and it will finish.',
        timedOut:
          'Apple took the payment but confirming it took too long. Nothing is lost. Open Expyr again in a moment and it will finish.',
        unreachable:
          'Apple took the payment but Expyr could not reach its service. Nothing is lost. Open Expyr again when you have a connection.',
      },
    }
  );

  return {
    transactionId: purchase.transactionId,
    productId: reply.productId || purchase.productId,
    credits: typeof reply.credits === 'number' ? reply.credits : undefined,
    pro: reply.pro === true,
    /*
     * What the service says the balance is now, which is the number that
     * counts. The phone's own ledger is a copy it shows without asking.
     */
    balance: typeof reply.balance === 'number' ? reply.balance : undefined,
  };
};

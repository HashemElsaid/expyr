import type { RenewalGuide } from '@/types';

/**
 * What being late has cost so far.
 *
 * This is the one number in Expyr that is about somebody's money, which makes
 * it the one worth being most careful with. It is only ever shown for the
 * categories whose penalty the app has actually verified as a daily rate — most
 * types state their fine as a sentence, and a sentence is shown as a sentence
 * rather than turned into a figure by guesswork.
 *
 * Three rules, in order, and the first is the one that is easy to forget: a
 * fine that has not started is not a debt. Grace days are counted off before
 * anything is owed, so a document three days expired with a thirty-day grace
 * period owes nothing at all, and says so by returning null.
 */

export type RunningFee = {
  /** In whole units of the currency — these rates are all stated in whole dirhams. */
  owed: number;
  /** True once the fine has stopped growing, which is worth saying out loud. */
  capped: boolean;
  currency: string;
  /** Days past the grace period. Zero here means there is no fee at all. */
  lateDays: number;
};

/**
 * `daysUntil` for the document: negative once it has expired. Returns null when
 * there is nothing to say — not expired, past expiry but still inside the grace
 * period, or a category whose fine the app has not verified as a rate.
 */
export function runningLateFee(
  daysUntilExpiry: number,
  guide: Pick<RenewalGuide, 'lateFeeRate'>
): RunningFee | null {
  const rate = guide.lateFeeRate;
  if (!rate) return null;

  const lateDays = Math.max(0, -daysUntilExpiry - rate.graceDays);
  if (lateDays === 0) return null;

  const uncapped = lateDays * rate.perDay;
  return {
    owed: Math.min(uncapped, rate.cap),
    capped: uncapped >= rate.cap,
    currency: rate.currency,
    lateDays,
  };
}

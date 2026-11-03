import { TIMES_A_YEAR, yearlyAmount } from '@/domain/money';
import { daysUntil } from '@/lib/dates';
import { parseISODate, upcoming } from '@/lib/recurrence';
import type { TrackedDocument } from '@/types';

/**
 * The figures on the year card and the strip under it.
 *
 * Everything here is in one currency, chosen by the caller from
 * `yearlyTotal`, because the card states one figure and adding dirhams to
 * dollars is the one thing it must never do. Subscriptions charged in another
 * currency are left out of these sums rather than converted at a guessed rate.
 */

/** What one charge comes to, from a price that may be quoted per another period. */
export function chargeAmount(doc: Pick<TrackedDocument, 'price' | 'renewsEvery'>): number {
  if (!doc.price || !doc.renewsEvery) return 0;
  return yearlyAmount(doc.price) / TIMES_A_YEAR[doc.renewsEvery];
}

export type MonthCharges = { year: number; month: number; amount: number };

/**
 * What each of the next twelve calendar months charges, starting with this one.
 *
 * Built from the actual charge dates rather than a twelfth of the yearly
 * figure, so a yearly renewal shows as the spike it is in the month it lands.
 * That spike is the point of the chart: it is the charge people forget.
 */
export function chargesByMonth(
  subscriptions: readonly TrackedDocument[],
  currency: string,
  today: Date = new Date()
): MonthCharges[] {
  const months: MonthCharges[] = Array.from({ length: 12 }, (_, i) => {
    const first = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { year: first.getFullYear(), month: first.getMonth(), amount: 0 };
  });
  const end = new Date(today.getFullYear(), today.getMonth() + 12, 1);

  for (const doc of subscriptions) {
    if (doc.archivedAt || !doc.renewsEvery || !doc.price || doc.price.currency !== currency) continue;
    const each = chargeAmount(doc);
    // Enough dates to cover a year at the cadence, and one over for safety.
    const count = TIMES_A_YEAR[doc.renewsEvery] + 2;
    for (const iso of upcoming(doc.expiryDate, doc.renewsEvery, today, count)) {
      const date = parseISODate(iso);
      if (!date || date >= end) break;
      const index =
        (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
      if (index >= 0 && index < 12) months[index].amount += each;
    }
  }
  return months;
}

export type Upcoming = { count: number; amount: number };

/**
 * How many charges fall in the next `days` days, and what they come to in
 * the card's currency. The count includes every currency, because "three
 * charges this month" is true whatever they are paid in.
 */
export function dueWithin(
  subscriptions: readonly TrackedDocument[],
  currency: string,
  days = 30
): Upcoming {
  let count = 0;
  let amount = 0;
  for (const doc of subscriptions) {
    if (doc.archivedAt) continue;
    const left = daysUntil(doc.expiryDate);
    if (left < 0 || left > days) continue;
    count += 1;
    if (doc.price?.currency === currency) amount += chargeAmount(doc);
  }
  return { count, amount };
}

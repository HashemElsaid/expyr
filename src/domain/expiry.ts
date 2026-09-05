import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import type { TrackedDocument } from '@/types';

/**
 * The date the add form should open on.
 *
 * Two cases, and the second is the one worth writing down. Marking something
 * renewed does not mean "a year from today" — it means a year from whichever is
 * later, the old expiry or now. A visa renewed a fortnight early keeps the
 * fortnight; a visa renewed two months late does not get two months of credit
 * for having been ignored.
 */

/** Six months out: far enough to be plausible, near enough to be worth editing. */
export function defaultExpiry(now: Date = new Date()): Date {
  const date = new Date(now);
  date.setMonth(date.getMonth() + 6);
  return date;
}

export function startingExpiry(
  doc: TrackedDocument,
  renew: boolean,
  now: Date = new Date()
): Date {
  const current = new Date(`${doc.expiryDate}T00:00:00`);
  if (!renew) return current;

  /*
   * A year for anything the app has no verified period for. It is only the
   * date the form opens on, and a wrong guess costs one edit — where refusing
   * to guess at all would cost the tap that made this worth having.
   */
  const period = RENEWAL_PERIOD_DAYS[doc.typeId] ?? 365;
  const base = current.getTime() > now.getTime() ? current : now;

  const rolled = new Date(base);
  rolled.setDate(rolled.getDate() + period);
  return rolled;
}

import { daysUntil } from '@/lib/dates';
import { yearlyAmount } from '@/domain/money';
import type { TrackedDocument } from '@/types';

/**
 * The two questions the Subscriptions page asks at the top, and when.
 *
 * Both have one tap answers and both exist to catch money leaving unnoticed.
 * A free trial is about to turn into a charge: keep it, or say it was
 * cancelled. A subscription has renewed by itself many times over: still
 * using it, or cancelled. Neither is a chore that comes back every day.
 */

/** How close a trial's first charge has to be before the page asks about it. */
export const TRIAL_NOTICE_DAYS = 14;

/** How many times something renews unattended before the page checks in. */
export const CHECK_IN_AFTER = 6;

/** A trial check-in answer, or a "still using it", holds for this long. */
const CHECK_IN_QUIET_DAYS = 365;

/** Free trials whose first charge is near, soonest first. */
export function trialsEnding(subscriptions: readonly TrackedDocument[]): TrackedDocument[] {
  return subscriptions
    .filter((doc) => doc.trial && !doc.archivedAt)
    .filter((doc) => {
      const days = daysUntil(doc.expiryDate);
      return days >= 0 && days <= TRIAL_NOTICE_DAYS;
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/**
 * The one subscription worth checking in on, if any: renewed by itself at
 * least CHECK_IN_AFTER times, not answered in the last year, and the most
 * expensive of those, because that is the one worth the question. One at a
 * time, so the top of the page never becomes a survey.
 */
export function checkInFor(
  subscriptions: readonly TrackedDocument[],
  today: Date = new Date()
): TrackedDocument | null {
  const due = subscriptions.filter((doc) => {
    if (doc.archivedAt || doc.trial) return false;
    if ((doc.history?.length ?? 0) < CHECK_IN_AFTER) return false;
    if (!doc.checkedInAt) return true;
    const answered = new Date(`${doc.checkedInAt}T00:00:00`);
    return (today.getTime() - answered.getTime()) / 86_400_000 >= CHECK_IN_QUIET_DAYS;
  });
  if (due.length === 0) return null;
  return due.reduce((best, doc) => (cost(doc) > cost(best) ? doc : best));
}

function cost(doc: TrackedDocument): number {
  return doc.price ? yearlyAmount(doc.price) : 0;
}

import { expiryVerb, isSubscription } from '@/domain/documents';
import { daysUntil, dueIn } from '@/lib/dates';
import type { TrackedDocument } from '@/types';

/**
 * What the test reminder should say, which is something about them.
 *
 * It used to say "Emirates ID expires in 30 days" and "Netflix charges you in
 * 3 days" to everybody, which is a reasonable guess in Dubai and nonsense in
 * Ohio. Worse than nonsense on a lock screen: a notification naming a document
 * somebody has never held, and a brand they may not subscribe to, reads as the
 * app having got them confused with somebody else.
 *
 * So it uses their own soonest item, which makes the test better as a test.
 * The whole point is to show what a real reminder looks like on their phone,
 * and the closest thing to a real reminder is a real one.
 *
 * The fallbacks are for somebody who has just installed Expyr and tracks
 * nothing, and they are deliberately generic: a passport is a document
 * everywhere, and a subscription that renews is a subscription everywhere.
 * Nothing here names a country or a company somebody has not told us about.
 */
export type TestReminderExamples = {
  /** Shaped like a real document reminder: title, verb, and when. */
  document: string;
  /** The same for something that renews, which gets the other set of buttons. */
  subscription: string;
};

/** True everywhere, and owned by nobody in particular. */
const ANY_DOCUMENT = 'Passport expires in 30 days';
const ANY_SUBSCRIPTION = 'A subscription renews in 3 days';

/**
 * The soonest one still ahead of us.
 *
 * Expired items are skipped rather than shown as "expires today", which is
 * what `dueIn` would say about something two years stale. A test reminder that
 * misstates a date is worse than a generic one that states nothing.
 */
function soonest(documents: readonly TrackedDocument[]): TrackedDocument | null {
  let best: TrackedDocument | null = null;
  let bestDays = Number.POSITIVE_INFINITY;
  for (const doc of documents) {
    const days = daysUntil(doc.expiryDate);
    if (days < 0 || days >= bestDays) continue;
    best = doc;
    bestDays = days;
  }
  return best;
}

function titleFor(doc: TrackedDocument): string {
  return `${doc.title} ${expiryVerb(doc)} ${dueIn(daysUntil(doc.expiryDate))}`;
}

export function testReminderExamples(
  documents: readonly TrackedDocument[]
): TestReminderExamples {
  const document = soonest(documents.filter((doc) => !isSubscription(doc)));
  const subscription = soonest(documents.filter((doc) => isSubscription(doc)));

  return {
    document: document ? titleFor(document) : ANY_DOCUMENT,
    subscription: subscription ? titleFor(subscription) : ANY_SUBSCRIPTION,
  };
}

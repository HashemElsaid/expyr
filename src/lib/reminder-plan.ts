import { hasGuidance, type Country } from '@/data/countries';
import { getDocumentType, labelFor } from '@/data/document-types';
import { daysUntil, dueIn, longDate, toISODate } from '@/lib/dates';
import { upcoming } from '@/lib/recurrence';
import type { TrackedDocument } from '@/types';

/**
 * Which reminders to book with iOS, chosen rather than assumed.
 *
 * iOS keeps only the 64 soonest pending local notifications for an app and
 * silently discards the rest — no error, no callback, nothing the app can
 * observe. Expyr used to schedule per document, three lead days each, which put
 * the ceiling at about twenty-one items. Past that, iOS quietly dropped
 * whichever reminders happened to be booked last, and the app went on believing
 * they existed. For a product sold on "nothing expires unnoticed", and on a Pro
 * plan sold as unlimited items, that is the worst bug it could have.
 *
 * So reminders are planned globally instead: every candidate across every
 * document, sorted by when it fires, and the soonest kept. The tail is not lost
 * — it is simply not booked yet, and the next rebalance books it once the head
 * has fired. What that costs is a reminder eighteen months out on a household's
 * fortieth item; what it buys is that everything in the next few months is
 * real.
 *
 * This module is deliberately pure: no expo, no react-native, no clock of its
 * own. Everything above is a claim that can be tested, and is.
 */

/** Actions offered on the reminder itself, so a nudge can be dealt with in place. */
export const REMINDER_CATEGORY = 'expyr.reminder';
/**
 * Subscriptions get their own pair. "Already done" is a sensible thing to say
 * about a visa, which waits for you, and a meaningless thing to say about
 * Netflix, which renews itself whatever you do.
 */
export const SUBSCRIPTION_CATEGORY = 'expyr.subscription';

/**
 * How many of the 64 to use.
 *
 * The four held back are for the things that are booked outside a plan and
 * would otherwise push a real reminder off the end: the two test reminders in
 * Settings, and the headroom for a rebalance that briefly overlaps the
 * notifications it is replacing.
 */
export const REMINDER_BUDGET = 60;

/** When every reminder arrives — see the note on REMINDER_TIME in notifications.ts. */
export const REMINDER_TIME = { hour: 9, minute: 0 } as const;

export type PlannedReminder = {
  documentId: string;
  /** Local time this should fire. */
  fireAt: Date;
  title: string;
  subtitle: string;
  body: string;
  categoryIdentifier: string;
};

export type ReminderPlan = {
  /** What to book, soonest first, already within the budget. */
  book: PlannedReminder[];
  /** How many candidates there were in total, booked or not. */
  wanted: number;
  /**
   * A short string that changes whenever the plan does. Rebooking sixty
   * notifications takes a hundred and twenty round trips to iOS, which is not
   * something to do on every launch when nothing has moved.
   */
  fingerprint: string;
};

/**
 * The date a reminder for this lead time should fire, or null if that moment
 * has already gone by.
 */
function fireDateFor(expiryDate: string, leadDays: number, now: Date): Date | null {
  const fire = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(fire.getTime())) return null;
  fire.setHours(REMINDER_TIME.hour, REMINDER_TIME.minute, 0, 0);
  fire.setDate(fire.getDate() - leadDays);
  return fire.getTime() > now.getTime() ? fire : null;
}

function contentFor(
  doc: TrackedDocument,
  leadDays: number,
  country: Country | null,
  /** The occurrence being warned about — not always the document's own date. */
  onDate: string
): Pick<PlannedReminder, 'title' | 'subtitle' | 'body' | 'categoryIdentifier'> {
  const type = getDocumentType(doc.typeId);
  const typeLabel = labelFor(type, country);

  /*
   * What being late costs, but only when it is a figure. Several of these read
   * as a paragraph — "no fine, but an expired passport invalidates travel" —
   * which belongs on the document's screen, not on a lock screen at nine in
   * the morning.
   */
  const fee = hasGuidance(country) ? type.guide.lateFee : '';
  const lateFee = fee.startsWith('AED') ? fee : '';

  /*
   * A subscription does not expire, it charges you. Saying "expires" of a
   * Netflix renewal invites exactly the wrong response — waiting for it to
   * lapse, when what actually happens is that the money leaves.
   */
  const verb = doc.renewsEvery ? 'charges you' : 'expires';

  return {
    /*
     * Three lines, laid out the way iOS lays them out: what and when, then
     * whose it is, then the fact. The app's name and icon are already in the
     * header, so nothing here says Expyr and nothing asks to be opened —
     * tapping it is what opening it means.
     */
    title: `${doc.title} ${verb} ${dueIn(leadDays)}`,
    subtitle: [doc.owner, typeLabel === doc.title.trim() ? null : typeLabel]
      .filter(Boolean)
      .join(' · '),
    body: lateFee ? `${longDate(onDate)}. Late: ${lateFee}.` : longDate(onDate),
    categoryIdentifier: doc.renewsEvery ? SUBSCRIPTION_CATEGORY : REMINDER_CATEGORY,
  };
}

/**
 * How many charges ahead a subscription is warned about.
 *
 * One is not enough: reminders for a monthly subscription would go quiet the
 * moment that month's charge passed and stay quiet until somebody opened the
 * app — for the one kind of item that renews whether or not anybody is
 * watching. Three covers a quarter of monthly charges, three years of yearly
 * ones, and is small enough that a household's subscriptions cannot crowd
 * everything else out of the budget.
 */
const OCCURRENCES_AHEAD = 3;

/**
 * Every reminder a document wants: one per lead day, plus a snooze if one is
 * outstanding. Archived documents want none — dealing with something is how
 * you stop it nagging.
 */
function candidatesFor(
  doc: TrackedDocument,
  country: Country | null,
  now: Date
): PlannedReminder[] {
  if (doc.archivedAt) return [];

  const out: PlannedReminder[] = [];

  /*
   * A subscription is warned about several charges ahead; everything else has
   * exactly one date and is warned about that. `fireDateFor` returning null is
   * the only test needed for whether a lead time still has a moment to fire —
   * a 30-day nudge on a document with eight days left is simply in the past.
   */
  const dates = doc.renewsEvery
    ? upcoming(doc.expiryDate, doc.renewsEvery, now, OCCURRENCES_AHEAD)
    : [doc.expiryDate];

  for (const date of dates) {
    for (const lead of doc.leadDays) {
      const fireAt = fireDateFor(date, lead, now);
      if (!fireAt) continue;
      out.push({ documentId: doc.id, fireAt, ...contentFor(doc, lead, country, date) });
    }
  }

  /*
   * A snooze is stored on the document rather than booked directly with iOS,
   * so that a rebalance carries it forward instead of cancelling it. It is the
   * one reminder the user asked for out loud, which makes it the last one that
   * should quietly disappear.
   */
  if (doc.snoozedUntil) {
    const fireAt = new Date(`${doc.snoozedUntil}T00:00:00`);
    fireAt.setHours(REMINDER_TIME.hour, REMINDER_TIME.minute, 0, 0);
    if (!Number.isNaN(fireAt.getTime()) && fireAt.getTime() > now.getTime()) {
      const leadFromSnooze = Math.max(0, daysUntil(doc.expiryDate) - daysUntil(doc.snoozedUntil));
      out.push({
        documentId: doc.id,
        fireAt,
        ...contentFor(doc, leadFromSnooze, country, doc.expiryDate),
      });
    }
  }

  return out;
}

/**
 * The reminders to have booked with iOS right now, for this whole collection.
 *
 * `now` is a parameter rather than a call to the clock so this can be tested at
 * any date, and so a single pass cannot disagree with itself about what time it
 * is halfway through.
 */
export function planReminders(
  documents: TrackedDocument[],
  country: Country | null,
  now: Date = new Date(),
  budget: number = REMINDER_BUDGET
): ReminderPlan {
  const candidates = documents.flatMap((doc) => candidatesFor(doc, country, now));

  /*
   * Soonest first, and ties broken by document id. Without the tiebreak the
   * order of two reminders on the same morning depends on the order the array
   * happened to be in, which would make the fingerprint below change when
   * nothing had.
   */
  candidates.sort(
    (a, b) =>
      a.fireAt.getTime() - b.fireAt.getTime() || a.documentId.localeCompare(b.documentId)
  );

  const book = candidates.slice(0, Math.max(0, budget));

  return {
    book,
    wanted: candidates.length,
    fingerprint: book
      .map((r) => `${r.documentId}@${toISODate(r.fireAt)}:${r.title}`)
      .join('|'),
  };
}

/** The date a snooze taken today should land on, as the app stores dates. */
export function snoozeDate(days: number, now: Date = new Date()): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

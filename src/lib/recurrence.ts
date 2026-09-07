import { toISODate } from '@/lib/dates';
import type { Recurrence } from '@/types';

/**
 * The date arithmetic behind anything that charges itself again.
 *
 * Two places need to agree about when a subscription next takes money: the
 * store, which moves a passed date forward so the list is not showing a charge
 * that already happened, and the reminder planner, which books warnings for
 * charges that have not happened yet. They used to be the same rule written
 * once; this is that rule written once and used twice.
 *
 * The whole file is about one problem. Adding a month to the 31st of January
 * by letting the date object do it lands in March, because there is no 31st of
 * February and the overflow carries. So a period is moved in whole months from
 * the first, and the day of the month is put back afterwards — short months
 * taking the last day they have. The day it charges on is a property of the
 * subscription, not of whichever month it last passed through.
 */

/** How many whole months one period is, or null for the one measured in days. */
function monthsIn(every: Recurrence): number | null {
  switch (every) {
    case 'weekly':
      return null;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'yearly':
      return 12;
  }
}

/**
 * One period on from `date`, keeping `anchorDay` as the day of the month.
 * Mutates nothing; returns a new Date.
 */
/**
 * How often it charges, as a word.
 *
 * The timeline row was printing "Subscription / Membership" under every one of
 * seven subscriptions, on a screen already headed Subscriptions — the same
 * eleven characters seven times, saying nothing that distinguished one row from
 * the next. This says something that does: Fitness First is yearly and Netflix
 * is not.
 */
export function recurrenceWord(every: Recurrence): string {
  switch (every) {
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
  }
}

export function addPeriod(date: Date, every: Recurrence, anchorDay: number): Date {
  const next = new Date(date);
  const months = monthsIn(every);

  if (months === null) {
    next.setDate(next.getDate() + 7);
    return next;
  }

  // From the first, so the month can never overflow into the one after.
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(anchorDay, lastOfMonth));
  return next;
}

/** Local midnight of an ISO date, or null when the string is not one. */
export function parseISODate(isoDate: string): Date | null {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A guard rather than a limit. A date typed as 1901 with a weekly period would
 * otherwise step through six thousand weeks before arriving at today.
 */
const MAX_STEPS = 400;

export type Advanced = {
  /** The first occurrence that has not happened yet. */
  next: string;
  /** Every occurrence stepped over on the way, oldest first. */
  past: string[];
};

/**
 * Moves a recurring date forward until it is in the future, remembering where
 * it has been.
 *
 * Nothing else in the app moves on its own: a visa sits expired until somebody
 * deals with it, which is the point of the warning. A subscription has already
 * taken the money and will take it again, so the only useful thing to show is
 * the next time.
 */
export function advance(isoDate: string, every: Recurrence, today: Date): Advanced {
  const start = parseISODate(isoDate);
  if (!start) return { next: isoDate, past: [] };

  const floor = new Date(today);
  floor.setHours(0, 0, 0, 0);
  if (start >= floor) return { next: isoDate, past: [] };

  const anchorDay = start.getDate();
  const past: string[] = [];
  let cursor = start;

  for (let i = 0; i < MAX_STEPS && cursor < floor; i += 1) {
    past.push(toISODate(cursor));
    cursor = addPeriod(cursor, every, anchorDay);
  }

  return { next: toISODate(cursor), past };
}

/**
 * The next `count` dates this will charge on, starting from `isoDate` itself
 * when that is still ahead.
 *
 * Reminders are booked for more than the next charge on purpose. A monthly
 * subscription whose reminders only covered one charge would go quiet the
 * moment that charge passed, and stay quiet until somebody opened the app —
 * which, for the one kind of item that renews whether or not anybody is
 * watching, is exactly backwards.
 */
export function upcoming(
  isoDate: string,
  every: Recurrence,
  today: Date,
  count: number
): string[] {
  const { next } = advance(isoDate, every, today);
  const first = parseISODate(next);
  if (!first) return [];

  const anchorDay = first.getDate();
  const dates: string[] = [];
  let cursor = first;

  for (let i = 0; i < count; i += 1) {
    dates.push(toISODate(cursor));
    cursor = addPeriod(cursor, every, anchorDay);
  }

  return dates;
}

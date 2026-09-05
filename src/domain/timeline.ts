import { daysUntil } from '@/lib/dates';
import type { TrackedDocument } from '@/types';

/**
 * The year in the order it arrives, which is the shape the whole app is built
 * around.
 *
 * Lived on the home screen until a second screen wanted the same thing for one
 * person. Two copies of this would have drifted the moment one of them learned
 * something — most likely the overdue rule below, which is the part that took
 * thinking about.
 */

export type Section = { title: string; data: TrackedDocument[] };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** One section per calendar month, in date order, overdue pinned above them. */
export function buildSections(docs: readonly TrackedDocument[]): Section[] {
  const byMonth = new Map<string, TrackedDocument[]>();

  /*
   * Anything already past comes out of the calendar and goes to the top under
   * its own heading. Filed by month it reads as history — an Emirates ID that
   * lapsed in August sits under "August 2026", above today, looking as settled
   * as a tenancy that ends next year. It is not history. It is costing AED 20
   * a day, and it is the only thing on the screen that cannot wait.
   */
  const overdue: TrackedDocument[] = [];

  const sorted = [...docs].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  for (const doc of sorted) {
    if (daysUntil(doc.expiryDate) < 0) {
      overdue.push(doc);
      continue;
    }
    const date = new Date(`${doc.expiryDate}T00:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    if (existing) existing.push(doc);
    else byMonth.set(key, [doc]);
  }

  const months = [...byMonth.entries()].map(([key, data]) => {
    const [year, month] = key.split('-');
    return { title: `${MONTHS[Number(month)]} ${year}`, data };
  });

  return overdue.length > 0 ? [{ title: 'Overdue', data: overdue }, ...months] : months;
}

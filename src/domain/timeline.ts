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

/**
 * Whether a row's title already says what kind of thing it is.
 *
 * The subtitle exists to add what the title cannot: how long is left, whose it
 * is, what a subscription costs. Repeating the category back is the one thing
 * it should never do, and "Health insurance · Health Insurance" is what that
 * looks like on screen.
 *
 * An exact comparison used to guard this and was too literal to catch anything
 * a person would actually type. One capital defeated it, and so did a spelling:
 * "UAE Driving Licence" is plainly a driving licence and did not match the
 * label "Driving License" by a single character in the middle.
 *
 * So: letters only, one spelling of licence, and a title that contains its
 * label says its own type. Deliberately one-directional — "Mulkiya" under the
 * label "Car Registration (Mulkiya)" keeps the subtitle, because there the
 * label is telling somebody something the title did not.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/licence/g, 'license').replace(/[^a-z0-9]/g, '');
}

export function saysItsOwnType(title: string, label: string): boolean {
  const a = normalise(title);
  const b = normalise(label);
  if (a.length === 0 || b.length === 0) return false;
  return a.includes(b);
}

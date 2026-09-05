import { daysUntil } from '@/lib/dates';
import type { TrackedDocument } from '@/types';

/**
 * Who is in the household, and what each of them is carrying.
 *
 * Until now a person existed only as a side effect of owning something: the
 * owner field on a document, grouped. That is why there was no way to add
 * somebody — there was nothing to add them *to*, and a person with no documents
 * yet had nowhere to be. Which is backwards for the one page whose job is
 * telling you what is missing, since a relative you have not filed anything for
 * is the largest gap of all.
 *
 * So the list of people is the names on the documents plus the names somebody
 * typed in, and a person with nothing to their name is a first-class row rather
 * than an absence.
 */

/** A blank owner means the phone's owner, shown as "Mine". */
export const MINE = '';

export type Person = {
  /** The stored owner string. Empty for the phone's owner. */
  name: string;
  /** What to call them on screen. */
  label: string;
  /** Soonest first. */
  items: TrackedDocument[];
  /** How many are due within a month, or already past. */
  urgent: number;
  /** True when they were added by name and have nothing filed yet. */
  empty: boolean;
};

/** Two names are the same person if only case or surrounding space differ. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

export function buildHousehold(
  documents: readonly TrackedDocument[],
  /** Names added explicitly, who may not own anything yet. */
  named: readonly string[] = []
): Person[] {
  const byPerson = new Map<string, { name: string; items: TrackedDocument[] }>();

  /*
   * The phone's owner is always present, even on an empty file. "Mine" with
   * nothing under it is a true and useful thing to show; leaving it out makes
   * a new user's own row appear only once they have filed something, which
   * reads as the page being broken.
   */
  byPerson.set(key(MINE), { name: MINE, items: [] });

  for (const name of named) {
    if (!name.trim()) continue;
    if (!byPerson.has(key(name))) byPerson.set(key(name), { name: name.trim(), items: [] });
  }

  for (const doc of documents) {
    const owner = doc.owner ?? MINE;
    const existing = byPerson.get(key(owner));
    if (existing) existing.items.push(doc);
    else byPerson.set(key(owner), { name: owner.trim(), items: [doc] });
  }

  return [...byPerson.values()]
    .map(({ name, items }) => {
      const sorted = [...items].sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
      return {
        name,
        label: name || 'Mine',
        items: sorted,
        urgent: sorted.filter((doc) => daysUntil(doc.expiryDate) <= 30).length,
        empty: sorted.length === 0,
      };
    })
    .sort((a, b) => {
      // Whoever needs attention soonest comes first; "Mine" wins a tie.
      if (b.urgent !== a.urgent) return b.urgent - a.urgent;
      if (a.name === MINE) return -1;
      if (b.name === MINE) return 1;
      // Someone with nothing filed yet sits after someone who has something.
      if (a.empty !== b.empty) return a.empty ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
}

/** The line under a person's name. */
export function personSummary(person: Person): string {
  if (person.empty) return 'Nothing tracked yet';
  if (person.urgent === 0) return 'All clear';
  return `${person.urgent} need${person.urgent === 1 ? 's' : ''} you`;
}

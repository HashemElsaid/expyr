import { countWord, daysUntil } from '@/lib/dates';
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

/** A blank owner means the phone's owner. */
export const MINE = '';

/**
 * A person's name out of a device name, or nothing.
 *
 * iOS offers no way to read the Apple ID name — the only route to it is Sign in
 * with Apple, which needs the user to tap it, needs a paid developer account,
 * and lets them withhold the name anyway. What is available without asking
 * anybody anything is what they called their phone, and on iOS that is very
 * often "Hashem's iPhone".
 *
 * A guess, and treated as one: it seeds a label the person can change, it never
 * leaves the device, and anything that does not clearly parse falls back rather
 * than putting half a device model on a card.
 */
export function nameFromDevice(deviceName?: string | null): string {
  const trimmed = (deviceName ?? '').trim();
  if (!trimmed) return '';

  // "Hashem's iPhone", "Reem’s iPad Pro" — straight and curly apostrophes.
  const owned = /^(.+?)[’']s\s+(iphone|ipad|ipod)/i.exec(trimmed);
  const name = owned?.[1]?.trim() ?? '';

  /*
   * Deliberately narrow. "iPhone", "Hashem's Mac mini" and "iPhone de Hashem"
   * all fall through to nothing, because a wrong name on somebody's own card is
   * worse than no name — and the possessive form is the one iOS actually
   * suggests when a phone is set up.
   */
  if (!name || name.length > 30) return '';
  return /^[\p{L}][\p{L}\p{M}' -]*$/u.test(name) ? name : '';
}

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
  /**
   * The phone's owner, on a phone that has never been told their name.
   *
   * It matters because the app cannot work it out. iOS stopped handing apps
   * the device name in iOS 16, so an unnamed card stays "Mine" until somebody
   * says otherwise — and until then, anybody who files a document under their
   * own name gets two cards: an empty "Mine" and a full one with their name
   * on it, which reads as a bug rather than a question.
   */
  unnamed: boolean;
};

/** Two names are the same person if only case or surrounding space differ. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

export function buildHousehold(
  documents: readonly TrackedDocument[],
  /** Names added explicitly, who may not own anything yet. */
  named: readonly string[] = [],
  /**
   * What the phone's owner is called. Empty until it is known, and then it is
   * both the label on their card and the name their own documents may carry.
   */
  ownName = ''
): Person[] {
  const byPerson = new Map<string, { name: string; items: TrackedDocument[] }>();
  const mine = ownName.trim();

  /*
   * The phone's owner is always present, even on an empty file. "Mine" with
   * nothing under it is a true and useful thing to show; leaving it out makes
   * a new user's own row appear only once they have filed something, which
   * reads as the page being broken.
   */
  byPerson.set(key(MINE), { name: MINE, items: [] });

  for (const name of named) {
    if (!name.trim()) continue;
    // Naming yourself in the list too must not conjure a second you.
    if (mine && key(name) === key(mine)) continue;
    if (!byPerson.has(key(name))) byPerson.set(key(name), { name: name.trim(), items: [] });
  }

  for (const doc of documents) {
    /*
     * Somebody's own name is the same person as no name at all.
     *
     * Without this, naming yourself puts you on the page twice: an empty card
     * for the blank owner and a full one for everything you happened to file
     * under your name. Which is exactly what happened the moment somebody typed
     * their own name into "Whose is it".
     */
    const raw = doc.owner ?? MINE;
    const owner = mine && key(raw) === key(mine) ? MINE : raw;
    const existing = byPerson.get(key(owner));
    if (existing) existing.items.push(doc);
    else byPerson.set(key(owner), { name: owner.trim(), items: [doc] });
  }

  return [...byPerson.values()]
    .map(({ name, items }) => {
      const sorted = [...items].sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
      return {
        name,
        unnamed: name === MINE && !mine,
        label: name || mine || 'Mine',
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

/**
 * The line under a person's name.
 *
 * Urgency first, always: somebody with a licence expiring on Tuesday does not
 * need to be asked what they are called. After that, an unnamed own-card asks,
 * because the alternative is a card labelled "Mine" sitting beside one with
 * their own name on it and no hint that the two are meant to be the same
 * person, or that the app is waiting to be told.
 */
export function personSummary(person: Person): string {
  /*
   * Expired is said as expired.
   *
   * Anything already past counts as urgent, so a passport four days over was
   * announced as "1 due soon" — which reads as a warning about next week, on
   * the one item where the deadline has already gone. Both are said when both
   * exist, because leading with the expired one and dropping the other would
   * turn eight things needing attention into "2 expired".
   */
  const over = person.items.filter((doc) => daysUntil(doc.expiryDate) < 0).length;
  if (over > 0) {
    const soon = person.urgent - over;
    return soon > 0 ? `${over} expired, ${soon} due` : `${over} expired`;
  }
  if (person.urgent > 0) return `${person.urgent} due soon`;
  if (person.unnamed) return 'Tap to add your name';
  if (person.empty) return 'Nothing tracked yet';
  /*
   * Says what was actually checked, which is dates. "All clear" was a broader
   * claim than this function can make, and it was being printed directly above
   * a warning triangle saying the Emirates ID has to be renewed before the
   * licence — the card contradicting itself in two adjacent lines.
   */
  return 'Nothing due soon';
}

/**
 * The same facts, set as a headline.
 *
 * Not personSummary with a full stop on the end, which is what the person's
 * page was doing. That string is written for a tile a third of the screen
 * wide, where "8 due soon" in figures is right; a headline spells small
 * numbers out, which is the rule the home masthead already follows and this
 * screen was quietly breaking beside it.
 *
 * It also said "All clear." directly above the list of everything missing from
 * somebody's file. Expired wins outright when there is any, exactly as the
 * masthead does: one figure covering both flattens the thing already costing
 * money into the ones that are not.
 */
export function personVerdict(person: Person): string {
  if (person.empty) return 'Nothing yet.';

  const expired = person.items.filter((doc) => daysUntil(doc.expiryDate) < 0).length;
  if (expired > 0) return `${countWord(expired)} expired.`;
  if (person.urgent > 0) return `${countWord(person.urgent)} due soon.`;
  return 'Nothing due soon.';
}

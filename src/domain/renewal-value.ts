import { hasGuidance, type Country } from '@/data/countries';
import { getDocumentType } from '@/data/document-types';
import type { DocumentTypeId } from '@/types';

/**
 * What somebody's own paperwork is worth, in the money it costs to renew.
 *
 * For one line at the top of the paywall: "You are tracking 5 items worth
 * AED 2,208 in renewals". The screen underneath it is a table of what the free
 * plan will not do, and a person arrives at it having just been stopped. A
 * sentence made of their own documents makes it about what they are holding
 * rather than what they are denied, and it is the only number on the screen
 * they can check for themselves.
 *
 * Three rules, and each one is about not overstating the case.
 *
 * The figure is the bottom of every range. The catalogue quotes real spans,
 * "AED 700-10,000+" for health insurance, because that is what insurers
 * charge; adding up the top of each would produce a number nobody could
 * defend on a sales screen. The low end can be defended and is still large
 * once there are five of them.
 *
 * A document whose fee is unknown adds nothing rather than an estimate. That
 * covers a blank entry, a category that has no fee at all, and the labour card
 * the employer pays for by law.
 *
 * And the money only appears where the fees have been checked, which is the
 * United Arab Emirates. Everywhere else the app already refuses to show
 * renewal steps and fees rather than guessing at them, and a paywall quoting
 * dirhams to somebody in Karachi would be the same invention with a price tag
 * on it. They get the count of their items, which is true everywhere.
 */

export type Fee = {
  /** The currency as the catalogue wrote it, normally AED. */
  currency: string;
  amount: number;
};

/**
 * The first sum of money in a fee description, or null if there is none.
 *
 * Reads the currency out of the string rather than assuming dirhams, so the
 * day a second country's guidance is written this either works or declines to
 * add up two currencies. Taking the first figure is what makes a range resolve
 * to its low end, and it is also what ignores the second fee bolted onto the
 * end of "AED 300 renewal + AED 140-180 eye test + ~AED 20 delivery".
 */
export function feeFrom(cost: string): Fee | null {
  const match = /([A-Z]{3})\s*~?\s*([0-9][0-9,]*)/.exec(cost);
  if (!match) return null;

  const amount = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return { currency: match[1], amount };
}

/**
 * Adds up fees, and refuses to add up two currencies.
 *
 * Returning null for a mixed list is deliberate: a total is only a total if
 * every part is in the same money, and "AED 300 + SAR 180 = 480" is a number
 * that means nothing. The caller falls back to the count.
 */
export function totalOf(fees: readonly (Fee | null)[]): Fee | null {
  const known = fees.filter((fee): fee is Fee => fee !== null);
  if (known.length === 0) return null;

  const currency = known[0].currency;
  if (known.some((fee) => fee.currency !== currency)) return null;

  return { currency, amount: known.reduce((sum, fee) => sum + fee.amount, 0) };
}

/** What a person's tracked items come to, given where they are. */
export function renewalWorth(
  documents: readonly { typeId: DocumentTypeId }[],
  country: Country | null
): { items: number; worth: Fee | null } {
  if (!hasGuidance(country)) return { items: documents.length, worth: null };

  const fees = documents.map((doc) => feeFrom(getDocumentType(doc.typeId).guide.typicalCost));
  return { items: documents.length, worth: totalOf(fees) };
}

/**
 * The line itself, or null when there is nothing to say.
 *
 * Nothing for an empty list, because "you are tracking 0 items" on the screen
 * selling a tracker is an argument against buying it. Somebody with no items
 * can only have reached the paywall from Settings, where the table alone is
 * the right answer.
 */
export function trackedSentence(
  documents: readonly { typeId: DocumentTypeId }[],
  country: Country | null
): string | null {
  const { items, worth } = renewalWorth(documents, country);
  if (items === 0) return null;

  const counted = `You are tracking ${items} item${items === 1 ? '' : 's'}`;
  if (!worth) return counted;

  return `${counted} worth ${worth.currency} ${worth.amount.toLocaleString('en-US')} in renewals`;
}

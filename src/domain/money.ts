import type { Money, Recurrence, TrackedDocument } from '@/types';

/**
 * What a year of somebody's recurring paperwork costs.
 *
 * The listing promises "see what your year costs before it arrives", so the
 * app has to be able to say it. Everything here is about being able to defend
 * the number on the screen, because a total that is quietly wrong is worse
 * than no total: nobody can check it against anything, and the one place it
 * shows is the screen that argues the app is worth paying for.
 */

/** How many times a year each cadence charges. */
const TIMES_A_YEAR: Record<Recurrence, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/**
 * A price read out of free text, or null.
 *
 * The import already gets a price off the screenshot as it was printed —
 * "USD 24.99", "$9.99/mo", "AED 39" — and the transcription is kept exactly as
 * printed, because a reformatted number is a wrong one. This is the separate
 * job of turning that into something addable, and it declines rather than
 * guesses: no currency, or no figure, and there is nothing to add up.
 *
 * The currency is read, never assumed. A build that assumed dollars would
 * silently add dirhams to them, and the sum would look perfectly plausible.
 */
const SYMBOLS: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '₹': 'INR',
  '¥': 'JPY',
};

export function parseMoney(text: string): { amount: number; currency: string } | null {
  const code = /([A-Z]{3})\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text);
  const symbol = /([$£€₹¥])\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text);
  const found = code ?? symbol;
  if (!found) return null;

  const currency = code ? found[1] : SYMBOLS[found[1]];
  if (!currency) return null;

  const amount = Number(found[2].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return { amount, currency };
}

/** What one price comes to over a year. */
export function yearlyAmount(price: Money): number {
  return price.amount * TIMES_A_YEAR[price.every];
}

/**
 * The total, and what it is safe to say about it.
 *
 * `mixed` is its own answer rather than a number, because adding two
 * currencies together is the one thing this must never do. A household paying
 * in dollars and dirhams has no single yearly figure, and inventing one by
 * picking a rate would be a number nobody could check on a screen that exists
 * to be checked.
 *
 * One-off fees are not in here. A passport's renewal fee is real money but it
 * is not what a year costs, and folding it in would make the figure move for
 * reasons nobody could trace.
 */
export type YearlyTotal =
  | { kind: 'none' }
  | { kind: 'one'; currency: string; amount: number }
  /** The largest currency by value, and how many others there were. */
  | { kind: 'mixed'; currency: string; amount: number; others: number };

export function yearlyTotal(documents: readonly TrackedDocument[]): YearlyTotal {
  const byCurrency = new Map<string, number>();

  for (const doc of documents) {
    if (doc.archivedAt) continue;
    const price = doc.price;
    // Only what actually charges on a schedule, which is what the sum claims.
    if (!price || !doc.renewsEvery) continue;
    byCurrency.set(price.currency, (byCurrency.get(price.currency) ?? 0) + yearlyAmount(price));
  }

  if (byCurrency.size === 0) return { kind: 'none' };

  const ranked = [...byCurrency.entries()].sort((a, b) => b[1] - a[1]);
  const [currency, amount] = ranked[0];

  return ranked.length === 1
    ? { kind: 'one', currency, amount }
    : { kind: 'mixed', currency, amount, others: ranked.length - 1 };
}

/**
 * The figure as a line of text.
 *
 * Whole units, because the cents on a yearly total of several thousand are
 * noise pretending to be precision, and because a figure somebody is meant to
 * feel should be read at a glance.
 */
export function formatYearly(total: YearlyTotal): string | null {
  if (total.kind === 'none') return null;
  const figure = `${total.currency} ${Math.round(total.amount).toLocaleString('en-US')}`;
  return total.kind === 'one'
    ? `${figure} a year`
    : `${figure} a year, plus ${total.others} other ${total.others === 1 ? 'currency' : 'currencies'}`;
}

/**
 * The currency to record a hand-typed price in.
 *
 * The phone's own, because somebody typing a number into a form is thinking in
 * the money they spend. Read rather than mapped from the country setting: the
 * country says where their paperwork is, which is not always where their bank
 * is, and a locale that names a currency is the phone telling us directly.
 *
 * Falls back to dollars only when the phone says nothing at all, which is the
 * simulator and very little else.
 */
export function localCurrency(read: () => string | null | undefined): string {
  const code = read();
  return code && /^[A-Za-z]{3}$/.test(code) ? code.toUpperCase() : 'USD';
}

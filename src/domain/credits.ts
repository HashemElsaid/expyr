/**
 * What Expyr AI costs a person, and what it has already cost them.
 *
 * The tracker is sold once and costs a fraction of a cent to run for years.
 * Expyr AI is different in kind: reading a contract and answering questions
 * about it costs real money every time, and answering *any* question reliably
 * means having read *all* of it — so the cost floor cannot be engineered away.
 *
 * Credits exist so that cost is carried by the person choosing to spend it,
 * visibly, rather than absorbed by a one-off purchase and hoped for. A balance
 * that goes down makes people ask fewer, better questions. That is the point,
 * not a side effect.
 *
 * Nothing here talks to a store, a server or a network. It is the arithmetic
 * and the rules, so both can be got right before either exists.
 */

/**
 * Everything is a whole number of credits.
 *
 * Money in floating point is how ledgers develop a cent of drift and then an
 * argument. A credit is the smallest unit anybody spends, and nothing divides
 * one, so integers are enough for every sum in this file.
 */
export type Credits = number;

/**
 * One credit is a tenth of a US cent of underlying cost.
 *
 * Deliberately a small unit. It keeps every price a round number, it leaves
 * room to reprice a model without renumbering everything, and it means a
 * balance reads as a healthy figure rather than a rounding error.
 */
export const CREDIT_COST_USD = 0.001;

/**
 * Ten credits — a penny — per page transcribed.
 *
 * A page costs about eight tenths of a cent to read at current Haiku pricing.
 * The rest covers the summary that follows it, which runs on a dearer model.
 */
export const CREDITS_PER_PAGE = 10;

/** Twenty credits a question, which is about what one costs to answer. */
export const CREDITS_PER_QUESTION = 20;

/** What a document of `pages` pages costs to read. */
export function priceOfPages(pages: number): Credits {
  return Math.max(0, Math.ceil(pages)) * CREDITS_PER_PAGE;
}

export type EntryKind = 'topup' | 'read' | 'question' | 'refund';

/**
 * One movement, and why.
 *
 * A balance that falls without saying what for is the thing people resent. The
 * point of a visible balance is that it is legible: every entry names what was
 * bought, so "where did my credits go" is answerable by scrolling.
 */
export type Entry = {
  id: string;
  /** ISO 8601, so it sorts as a string and survives a JSON round trip. */
  at: string;
  kind: EntryKind;
  /** Shown to the person: "Tenancy contract · 14 pages". Never an id. */
  detail: string;
  /** Positive adds, negative spends. Always a whole number of credits. */
  delta: Credits;
};

export type Ledger = {
  balance: Credits;
  /** Most recent first, which is the order anybody reads a statement in. */
  entries: Entry[];
};

export const EMPTY_LEDGER: Ledger = { balance: 0, entries: [] };

/**
 * How many entries are kept.
 *
 * Enough to answer "what happened to my credits" for any plausible session,
 * bounded so the file cannot grow without limit. The balance is authoritative
 * and is never recomputed from the entries, so trimming old ones is safe.
 */
export const MAX_ENTRIES = 200;

export function canAfford(ledger: Ledger, cost: Credits): boolean {
  return ledger.balance >= cost;
}

/**
 * Applies a movement, returning a new ledger.
 *
 * The balance is carried, not derived: entries are trimmed once there are
 * enough of them, and a balance recomputed from a trimmed list would be wrong
 * — quietly, and in the direction that favours us, which is the worst way for
 * a money bug to be wrong.
 */
export function apply(ledger: Ledger, entry: Entry): Ledger {
  return {
    balance: ledger.balance + entry.delta,
    entries: [entry, ...ledger.entries].slice(0, MAX_ENTRIES),
  };
}

function makeEntry(kind: EntryKind, detail: string, delta: Credits, at: Date, id: string): Entry {
  return { id, at: at.toISOString(), kind, detail, delta: Math.round(delta) };
}

export function topUp(
  ledger: Ledger,
  credits: Credits,
  detail: string,
  at: Date,
  id: string
): Ledger {
  return apply(ledger, makeEntry('topup', detail, Math.abs(Math.round(credits)), at, id));
}

/**
 * Charges for pages actually transcribed.
 *
 * Per page rather than per document, and after the fact rather than before,
 * because a long PDF is read in batches and any of them can fail. Somebody who
 * paid for fourteen pages and received twelve has been overcharged; somebody
 * charged when nothing arrived has been robbed. Charging for what landed makes
 * a retry cost only the pages it adds, which is also what the transcript cache
 * already does.
 */
export function chargeForPages(
  ledger: Ledger,
  pages: number,
  detail: string,
  at: Date,
  id: string
): Ledger {
  const cost = priceOfPages(pages);
  if (cost === 0) return ledger;
  return apply(ledger, makeEntry('read', detail, -cost, at, id));
}

export function chargeForQuestion(ledger: Ledger, detail: string, at: Date, id: string): Ledger {
  return apply(ledger, makeEntry('question', detail, -CREDITS_PER_QUESTION, at, id));
}

/**
 * Gives credits back, for work that was charged for and then turned out not to
 * have been delivered. Never more than was taken.
 */
export function refund(
  ledger: Ledger,
  credits: Credits,
  detail: string,
  at: Date,
  id: string
): Ledger {
  return apply(ledger, makeEntry('refund', detail, Math.abs(Math.round(credits)), at, id));
}

/**
 * The balance as money, for the one place it belongs: next to a price.
 *
 * Everywhere else shows credits. A balance denominated in dollars invites the
 * arithmetic Apple's thirty percent makes unflattering — a five dollar top-up
 * cannot buy five dollars of anything — and pricing a product is honest where
 * reporting a dollar that is not a dollar is not.
 */
export function asMoney(credits: Credits): string {
  return `$${(credits * CREDIT_COST_USD).toFixed(2)}`;
}

/** "1,240 credits" — grouped, because four digits stop being readable at once. */
export function formatCredits(credits: Credits): string {
  return `${Math.max(0, Math.round(credits)).toLocaleString('en-US')} credits`;
}

/**
 * Roughly how many more documents of this length the balance covers. Rounded
 * down, because promising four and delivering three is worse than saying three.
 */
export function documentsLeft(ledger: Ledger, pagesEach: number): number {
  const each = priceOfPages(pagesEach);
  if (each <= 0) return 0;
  return Math.floor(ledger.balance / each);
}

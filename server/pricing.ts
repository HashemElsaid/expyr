/**
 * What using Expyr AI costs, and what a new install is given.
 *
 * The authority, for the same reason `products.ts` is: the phone is not
 * trusted. It has its own copy of these numbers in `src/domain/credits.ts` and
 * draws the balance from it, but a number in local storage is a number its
 * owner can edit, and every read and every question costs real money at
 * Anthropic. So the phone's arithmetic is a display and this one is the bill.
 *
 * A test in the app suite reads this file and fails if the two disagree,
 * because the same figure in two runtimes that cannot import from each other
 * is exactly the pair that drifts.
 */

/** Ten credits reads one page of a document. */
export const CREDITS_PER_PAGE = 10;

/** Twenty answers one question about documents already read. */
export const CREDITS_PER_QUESTION = 20;

/**
 * What a new install is given, once: thirty pages' worth.
 *
 * Enough to read a tenancy contract and ask about it before deciding whether
 * any of this is worth paying for. Granted by the service rather than claimed
 * by the phone, or it would be thirty free pages per reinstall for anybody who
 * noticed.
 */
export const WELCOME_CREDITS = 300;

/** What reading a given number of pages costs. Never less than one page. */
export function priceOfPages(pages: number): number {
  return Math.max(1, Math.ceil(pages)) * CREDITS_PER_PAGE;
}

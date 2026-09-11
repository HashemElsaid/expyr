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
 * What a new install is given, which is nothing.
 *
 * It was thirty pages' worth, granted here rather than claimed by the phone so
 * that it could not be had again per reinstall. Expyr AI is a Pro feature now:
 * the credits that come with Pro are the opening balance, and a free install
 * has none.
 *
 * Kept as a constant at zero rather than removed, because the grant machinery
 * around it is correct and the number is one line to change back. A test in
 * the app suite fails if this and the phone's copy stop agreeing.
 */
export const WELCOME_CREDITS = 0;

/** What reading a given number of pages costs. Never less than one page. */
export function priceOfPages(pages: number): number {
  return Math.max(1, Math.ceil(pages)) * CREDITS_PER_PAGE;
}

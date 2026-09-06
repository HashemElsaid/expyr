/**
 * The most pages read from one document.
 *
 * A fifty page contract is unbounded in both directions: about forty cents to
 * transcribe and several minutes to wait, and the pages that answer questions
 * are almost never at the back. Tenancy contracts, insurance policies and
 * licences put the dates, the parties and the terms in the first few pages and
 * fill the rest with schedules.
 *
 * Thirty is generous against every document this app was built for and bounds
 * the worst case at about a quarter, which is a number that can be charged for
 * honestly. The cap is said out loud rather than applied quietly: the screen
 * reports thirty of fifty-two, and the transcript itself carries a line saying
 * where it stops, so a question about page forty is answered with "that part
 * was not read" instead of "the contract does not mention it".
 */
export const MAX_PAGES_READ = 30;

/** How much of a document of `total` pages will actually be read. */
export function pagesToRead(total: number): number {
  return Math.max(0, Math.min(Math.floor(total), MAX_PAGES_READ));
}

import { CREDITS_PER_PAGE, priceOfPages, type Credits } from '@/domain/credits';

/**
 * The most pages that can be read from one document.
 *
 * A hundred, because that is the model's own ceiling for a single PDF, not a
 * number chosen here. There used to be a product cap of thirty on top of it,
 * and it was a mistake: a contract read to page thirty cannot answer a
 * question about page forty, so every answer about a long document carried a
 * hole the person asking could not see. Half a transcript is worse than none,
 * because none is obviously none.
 *
 * What bounds the cost now is the person. Pages are counted before anything is
 * read, which is free, and the price is put to them in credits before a single
 * page is fetched. Nothing is spent on a document somebody has not agreed to.
 */
export const MAX_PAGES_READ = 100;

/** How much of a document of `total` pages can be read. */
export function pagesToRead(total: number): number {
  return Math.max(0, Math.min(Math.floor(total), MAX_PAGES_READ));
}

/** What reading a document of this length costs. */
export function priceOfDocument(pages: number): Credits {
  return priceOfPages(pagesToRead(pages));
}

/**
 * Long enough that the price is worth putting to somebody before it is spent.
 *
 * Below this it is a few credits and a few seconds, and stopping to ask makes
 * the app feel like it is haggling. Above it, the cost is real and so is the
 * wait, and being asked is the difference between a purchase and a surprise.
 */
export const ASK_FIRST_ABOVE_PAGES = 8;

export function worthConfirming(pages: number): boolean {
  return pages > ASK_FIRST_ABOVE_PAGES;
}

/**
 * Roughly how long a document of this length takes, in whole minutes.
 *
 * Deliberately rounded up and never less than one. Somebody told "about a
 * minute" who waits ninety seconds is fine; somebody told "seconds" who waits
 * ninety is being lied to.
 *
 * Four pages a batch, two batches at a time, and a batch that lands in about
 * twenty seconds when the service is warm.
 */
export function estimatedMinutes(pages: number): number {
  const batches = Math.ceil(pagesToRead(pages) / 4);
  const rounds = Math.ceil(batches / 2);
  return Math.max(1, Math.ceil((rounds * 20) / 60));
}

/**
 * What to tell somebody before spending their credits.
 *
 * Everything they need to decide, in the order they need it: how big the thing
 * is, what it costs, and what they are left with. The balance after matters
 * most and is easiest to leave out.
 */
export function readingOffer(
  pages: number,
  balance: Credits
): { pages: number; cost: Credits; after: Credits; minutes: number; affordable: boolean } {
  const readable = pagesToRead(pages);
  const cost = readable * CREDITS_PER_PAGE;
  return {
    pages: readable,
    cost,
    after: balance - cost,
    minutes: estimatedMinutes(readable),
    affordable: balance >= cost,
  };
}

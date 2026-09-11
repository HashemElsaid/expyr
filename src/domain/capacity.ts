/**
 * How much room is left under the free ceiling, and what to do with a batch
 * that does not fit inside it.
 *
 * Adding one item at a time never needed this: the screen asks whether the
 * list is full and shows the paywall if it is. Importing does, because a
 * screenshot of somebody's Subscriptions page arrives with seven of them at
 * once, and "is the list full" has three answers rather than two. It is not
 * full, it is full, or there is room for some of them.
 *
 * The third answer is the one that was missing. The import wrote every chosen
 * subscription with no reference to the ceiling at all, so a free account with
 * two items and six on screen ended up tracking eight, and the limit the
 * paywall sells against was enforced everywhere except the one screen that
 * could add six things in a tap.
 *
 * No imports on purpose. The ceiling lives in `src/store/settings.tsx`
 * alongside AsyncStorage and expo-constants, and reaching for it from here
 * would drag native modules into anything that wanted to test this. So the
 * limit is an argument and the caller holds the constant.
 */

/**
 * How many more items may be tracked.
 *
 * Infinite for somebody who has paid, which is the honest answer and composes
 * correctly: `Math.min(chosen, Infinity)` is `chosen`, so nothing downstream
 * needs to know whether a person is on the free plan.
 */
export function roomFor({
  tracked,
  limit,
  premium,
}: {
  tracked: number;
  limit: number;
  premium: boolean;
}): number {
  if (premium) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - tracked);
}

/**
 * Splits a batch into what fits and what does not.
 *
 * Both halves matter. `take` is what gets written, and taking as many as will
 * fit rather than refusing the lot is the difference between an import that
 * half worked and one that looked broken. `blocked` is what the person has to
 * be told about, because silently dropping four of somebody's six
 * subscriptions is worse than either adding them or refusing them: they walk
 * away believing they are being reminded about things nothing is watching.
 */
export function splitImport(
  chosen: number,
  room: number
): { take: number; blocked: number } {
  const wanted = Math.max(0, Math.floor(chosen));
  const take = Math.max(0, Math.min(wanted, room));
  return { take, blocked: wanted - take };
}

import { yearlyAmount } from '@/domain/money';
import type { TrackedDocument } from '@/types';

/**
 * Which subscriptions a free plan reminds about.
 *
 * Free tracks every subscription and counts every one in the yearly total; it
 * reminds about only a few of them, and Pro reminds about all. The slots go
 * first to the ones the person picked, and any slot still empty goes to the
 * most expensive of the rest, because that is the charge somebody would most
 * regret missing.
 *
 * Picks can outnumber the allowance in one case only: a free account that
 * already had more subscriptions when this rule arrived keeps a reminder on
 * every one of them, so the change took nobody's warning away.
 *
 * No imports from the settings store on purpose, so this can be tested
 * without native modules: the allowance is an argument and the caller holds
 * the constant.
 */
export function remindedSubscriptions(
  subscriptions: readonly TrackedDocument[],
  picks: readonly string[] | null,
  premium: boolean,
  allowance: number
): Set<string> {
  const live = subscriptions.filter((doc) => !doc.archivedAt);
  if (premium) return new Set(live.map((doc) => doc.id));

  const ids = new Set(live.map((doc) => doc.id));
  const reminded = new Set((picks ?? []).filter((id) => ids.has(id)));
  if (reminded.size >= allowance) return reminded;

  const rest = live
    .filter((doc) => !reminded.has(doc.id))
    // Ties go to the one tracked first, so the choice does not flicker.
    .sort((a, b) => costOf(b) - costOf(a) || a.createdAt.localeCompare(b.createdAt));
  for (const doc of rest) {
    if (reminded.size >= allowance) break;
    reminded.add(doc.id);
  }
  return reminded;
}

/**
 * The picks after moving a reminder from one subscription to another. What is
 * stored is every subscription currently reminded, so the swap does not leave
 * a slot for the most-expensive rule to refill behind the person's back.
 */
export function moveReminder(
  reminded: ReadonlySet<string>,
  from: string,
  to: string
): string[] {
  return [...reminded].filter((id) => id !== from && id !== to).concat(to);
}

/**
 * The picks to store on the first launch under this rule: every subscription
 * already tracked when there are more than the allowance, so a free account
 * keeps the reminders it had, and nothing otherwise.
 */
export function grandfatheredPicks(
  subscriptions: readonly TrackedDocument[],
  allowance: number
): string[] {
  const live = subscriptions.filter((doc) => !doc.archivedAt);
  return live.length > allowance ? live.map((doc) => doc.id) : [];
}

/** A year of it, for ranking. Unpriced counts as nothing. */
function costOf(doc: TrackedDocument): number {
  return doc.price ? yearlyAmount(doc.price) : 0;
}

/**
 * Whether to ask for an icon again.
 *
 * Two failures look the same from the outside and want opposite treatment.
 *
 * A service that has no icon has no icon: mygym.com was a guess made from
 * somebody typing "My gym", and nothing will ever come back. Asking again on
 * every launch, forever, is a request about somebody's private list sent to a
 * stranger for no reason at all.
 *
 * A service whose icon did not arrive because the network was down does have
 * one, and the only thing wrong was the moment. That should be asked again.
 *
 * So a definite no is remembered and a maybe is not. The memory expires,
 * because a service that had no favicon in September may well have one by
 * March, and a permanent no on a guess is how a row keeps a blank tile years
 * after the reason has gone.
 */

/** How long a "there is no icon here" is trusted before asking again. */
export const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldAskAgain(missedAt: number | null, now: number): boolean {
  if (missedAt === null) return true;
  // A clock that has gone backwards is not a reason to stop asking.
  if (!Number.isFinite(missedAt) || missedAt > now) return true;
  return now - missedAt >= MISS_TTL_MS;
}

/**
 * Whether a failed request means "there is no icon" or "not just now".
 *
 * 404 is the service saying it looked and found nothing, which is the only
 * answer worth remembering. Everything else — a timeout, a 502, the phone
 * being on a plane — is about the moment rather than the domain.
 */
export function isDefiniteMiss(status: number): boolean {
  return status === 404;
}

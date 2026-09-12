export type Urgency = 'expired' | 'critical' | 'soon' | 'ok';

/** Whole days from today (local midnight) until the given ISO date. Negative if past. */
export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyFor(days: number): Urgency {
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'soon';
  return 'ok';
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function countdownLabel(days: number, renews = false): string {
  /*
   * A subscription does not expire, it charges.
   *
   * Netflix said "Expires tomorrow", which is the opposite of what happens
   * tomorrow: nothing lapses, money leaves. The one thing somebody wants from
   * a subscription reminder is the chance to cancel before being billed, and
   * the word "expires" tells them there is nothing to do.
   */
  if (renews) {
    if (days < 0) return `Renewed ${-days === 1 ? 'yesterday' : `${-days} days ago`}`;
    if (days === 0) return 'Renews today';
    if (days === 1) return 'Renews tomorrow';
    if (days < 60) return `Renews in ${days} days`;
    const months = Math.floor(days / 30);
    return `Renews in ~${months} month${months > 1 ? 's' : ''}`;
  }

  if (days < 0) return `Expired ${-days === 1 ? 'yesterday' : `${-days} days ago`}`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 60) return `${days} days left`;
  const months = Math.floor(days / 30);
  return `~${months} month${months > 1 ? 's' : ''} left`;
}

/** Split into a figure and a unit so the countdown can be set as a numeral. */
export function countdownParts(days: number): { value: string; unit: string } {
  if (days < 0) return { value: String(-days), unit: -days === 1 ? 'day over' : 'days over' };
  if (days === 0) return { value: '0', unit: 'days left' };
  if (days < 60) return { value: String(days), unit: days === 1 ? 'day left' : 'days left' };
  const months = Math.floor(days / 30);
  if (months < 24) return { value: String(months), unit: months === 1 ? 'month' : 'months' };
  return { value: String(Math.floor(days / 365)), unit: 'years' };
}

/** Terse form for the ledger: "11 days", "6 months", "9 years". */
export function countdownShort(days: number): string {
  if (days < 0) return `${-days}d over`;
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.round(days / 365)} years`;
}

/**
 * The detail screen's headline answer to "should I worry?".
 *
 * No full stop. It is a Large Title, and a Large Title with a stop on the end
 * is the sentence-headline pattern item 17 took out of every other screen:
 * iOS does not punctuate a title, and "4 months." reads as a fragment of
 * something longer that got cut off.
 */
export function verdictPhrase(days: number): string {
  if (days < 0) return `${-days} ${-days === 1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Today';
  return countdownShort(days);
}

/** Spelled out up to ten — reads better in a headline. */
export function countWord(n: number): string {
  const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return words[n] ?? String(n);
}

export function monthName(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', { month: 'long' });
}

export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Thursday 10 September 2026" — used in full sentences. */
export function longDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "11 Aug" — used for reminder dates. */
export function dayMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * A reminder time written the way a person says it: "9am", "9:30am", and the
 * two hours that have names of their own.
 */
export function formatTime(hour: number, minute = 0): string {
  if (minute === 0 && hour === 0) return 'midnight';
  if (minute === 0 && hour === 12) return 'noon';
  const suffix = hour < 12 ? 'am' : 'pm';
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${clock}${suffix}`
    : `${clock}:${String(minute).padStart(2, '0')}${suffix}`;
}

/**
 * How far off something is, phrased to sit after "expires". Notifications read
 * better as a sentence than as a countdown: "expires in 30 days", not "30d".
 */
export function dueIn(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 45) return `in ${days} days`;
  const months = Math.round(days / 30);
  return `in ${months} month${months === 1 ? '' : 's'}`;
}

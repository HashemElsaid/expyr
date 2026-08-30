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

export function countdownLabel(days: number): string {
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
  if (days === 0) return { value: '—', unit: 'today' };
  if (days < 60) return { value: String(days), unit: days === 1 ? 'day left' : 'days left' };
  const months = Math.floor(days / 30);
  if (months < 24) return { value: String(months), unit: months === 1 ? 'month' : 'months' };
  return { value: String(Math.floor(days / 365)), unit: 'years' };
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

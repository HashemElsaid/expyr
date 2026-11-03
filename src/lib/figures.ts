/**
 * Numbers as the home pages set them: short, and in the units a person thinks
 * in. Days while it is close, months while it is this year or next, years
 * beyond that, and lateness said as lateness rather than as a negative.
 */

/** "Today", "12 days", "4 months", "9 years", or "3 days late". */
export function timeLeft(days: number): string {
  if (days < 0) return `${-days} ${-days === 1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Today';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`;
  return `${Math.round(days / 365.25)} years`;
}

/** The same, split for a card: the figure set large, the unit beside it. */
export function timeLeftParts(days: number): { value: string; unit: string } {
  if (days === 0) return { value: 'Today', unit: '' };
  const [value, ...rest] = timeLeft(days).split(' ');
  return { value, unit: rest.join(' ') };
}

/** Whole amounts as they are, anything else to the cent: "240", "24.99". */
export function money(amount: number): string {
  const cents = Math.round(amount * 100);
  return cents % 100 === 0
    ? (cents / 100).toLocaleString('en-US')
    : (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A total, where the cents are noise: "16,535". */
export function wholeMoney(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

/**
 * A sum short enough for a third of the screen: "$1,050", "AED 1,050".
 *
 * The narrow symbol where the currency has one everybody reads, the code
 * where it does not. Falls back to the code if the phone's number formatting
 * does not know the currency, rather than showing nothing.
 */
export function shortMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })
      .format(Math.round(amount))
      .replace(/ /g, ' ');
  } catch {
    return `${currency} ${wholeMoney(amount)}`;
  }
}

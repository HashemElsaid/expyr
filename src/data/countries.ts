/**
 * Renewly's tracker half — read a date, file it, remind you — works anywhere.
 * Its guidance half does not: every renewal step, cost, fine and portal in the
 * app was verified against UAE sources, and a UAE answer given to someone in
 * Riyadh or Cairo is worse than no answer, because it is delivered with the
 * same confidence as a correct one.
 *
 * So the country decides whether guidance is shown at all. Adding a country
 * later means writing its guides and adding it to WITH_GUIDANCE, not touching
 * the screens.
 */
export type Country = 'ae' | 'sa' | 'kw' | 'qa' | 'bh' | 'om' | 'other';

export const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'ae', label: 'UAE' },
  { value: 'sa', label: 'Saudi Arabia' },
  { value: 'kw', label: 'Kuwait' },
  { value: 'qa', label: 'Qatar' },
  { value: 'bh', label: 'Bahrain' },
  { value: 'om', label: 'Oman' },
  { value: 'other', label: 'Somewhere else' },
];

/** The only country whose renewal knowledge we have actually checked. */
const WITH_GUIDANCE: Country[] = ['ae'];

export function hasGuidance(country: Country | null): boolean {
  return country !== null && WITH_GUIDANCE.includes(country);
}

/** Only the UAE splits services by emirate in a way the app needs to know. */
export function usesEmirates(country: Country | null): boolean {
  return country === 'ae';
}

export function countryLabel(country: Country): string {
  return COUNTRIES.find((c) => c.value === country)?.label ?? 'Somewhere else';
}

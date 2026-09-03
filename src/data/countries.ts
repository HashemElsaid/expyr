/**
 * Expyr's tracker half — read a date, file it, remind you — works anywhere.
 * Its guidance half does not: every renewal step, cost, fine and portal in the
 * app was verified against UAE sources, and a UAE answer given to someone in
 * Riyadh or Cairo is worse than no answer, because it is delivered with the
 * same confidence as a correct one.
 *
 * So the country decides whether guidance is shown at all. Being on this list
 * only means Expyr will track your dates there; adding guidance means writing
 * that country's guides and adding it to WITH_GUIDANCE, not touching a screen.
 */
export type Country =
  | 'dz'
  | 'bh'
  | 'km'
  | 'dj'
  | 'eg'
  | 'iq'
  | 'jo'
  | 'kw'
  | 'lb'
  | 'ly'
  | 'mr'
  | 'ma'
  | 'om'
  | 'ps'
  | 'qa'
  | 'sa'
  | 'so'
  | 'sd'
  | 'sy'
  | 'tn'
  | 'ae'
  | 'ye'
  | 'other';

/**
 * The Arab League, under the names people would look for rather than initials,
 * in alphabetical order. "Somewhere else" is pinned to the end because it is
 * not a country and sorting it under S would hide it.
 */
export const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'dz', label: 'Algeria' },
  { value: 'bh', label: 'Bahrain' },
  { value: 'km', label: 'Comoros' },
  { value: 'dj', label: 'Djibouti' },
  { value: 'eg', label: 'Egypt' },
  { value: 'iq', label: 'Iraq' },
  { value: 'jo', label: 'Jordan' },
  { value: 'kw', label: 'Kuwait' },
  { value: 'lb', label: 'Lebanon' },
  { value: 'ly', label: 'Libya' },
  { value: 'mr', label: 'Mauritania' },
  { value: 'ma', label: 'Morocco' },
  { value: 'om', label: 'Oman' },
  { value: 'ps', label: 'Palestine' },
  { value: 'qa', label: 'Qatar' },
  { value: 'sa', label: 'Saudi Arabia' },
  { value: 'so', label: 'Somalia' },
  { value: 'sd', label: 'Sudan' },
  { value: 'sy', label: 'Syria' },
  { value: 'tn', label: 'Tunisia' },
  { value: 'ae', label: 'United Arab Emirates' },
  { value: 'ye', label: 'Yemen' },
  { value: 'other', label: 'Somewhere else' },
];

/**
 * The only country whose renewal knowledge we have actually checked, portal by
 * portal and fee by fee. Everywhere else gets the tracker and nothing more.
 */
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

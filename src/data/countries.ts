/**
 * Expyr's tracker half - read a date, file it, remind you - works anywhere.
 * Its guidance half does not: every renewal step, cost, fine and portal in the
 * app was verified against UAE sources, and a UAE answer given to someone in
 * Riyadh or Cairo is worse than no answer, because it is delivered with the
 * same confidence as a correct one.
 *
 * So the country decides whether guidance is shown at all. Being on this list
 * only means Expyr will track your dates there; adding guidance means writing
 * that country's guides and adding it to WITH_GUIDANCE, not touching a screen.
 */

/**
 * Every sovereign state, alphabetically: the UN's 193 members plus Palestine
 * and Vatican City. Each row is [code, name, other names people search for] -
 * somebody typing "UAE", "UK" or "Holland" should not have to know the formal
 * name of the country they are looking for.
 */
const LIST = [
  ['af', 'Afghanistan', ''],
  ['al', 'Albania', ''],
  ['dz', 'Algeria', ''],
  ['ad', 'Andorra', ''],
  ['ao', 'Angola', ''],
  ['ag', 'Antigua and Barbuda', ''],
  ['ar', 'Argentina', ''],
  ['am', 'Armenia', ''],
  ['au', 'Australia', ''],
  ['at', 'Austria', ''],
  ['az', 'Azerbaijan', ''],
  ['bs', 'Bahamas', ''],
  ['bh', 'Bahrain', ''],
  ['bd', 'Bangladesh', ''],
  ['bb', 'Barbados', ''],
  ['by', 'Belarus', ''],
  ['be', 'Belgium', ''],
  ['bz', 'Belize', ''],
  ['bj', 'Benin', ''],
  ['bt', 'Bhutan', ''],
  ['bo', 'Bolivia', ''],
  ['ba', 'Bosnia and Herzegovina', ''],
  ['bw', 'Botswana', ''],
  ['br', 'Brazil', ''],
  ['bn', 'Brunei', ''],
  ['bg', 'Bulgaria', ''],
  ['bf', 'Burkina Faso', ''],
  ['bi', 'Burundi', ''],
  ['kh', 'Cambodia', ''],
  ['cm', 'Cameroon', ''],
  ['ca', 'Canada', ''],
  ['cv', 'Cape Verde', 'Cabo Verde'],
  ['cf', 'Central African Republic', ''],
  ['td', 'Chad', ''],
  ['cl', 'Chile', ''],
  ['cn', 'China', ''],
  ['co', 'Colombia', ''],
  ['km', 'Comoros', ''],
  ['cg', 'Congo', 'Republic of the Congo Brazzaville'],
  ['cd', 'Congo (DRC)', 'Democratic Republic Zaire Kinshasa'],
  ['cr', 'Costa Rica', ''],
  ['hr', 'Croatia', ''],
  ['cu', 'Cuba', ''],
  ['cy', 'Cyprus', ''],
  ['cz', 'Czechia', 'Czech Republic'],
  ['dk', 'Denmark', ''],
  ['dj', 'Djibouti', ''],
  ['dm', 'Dominica', ''],
  ['do', 'Dominican Republic', ''],
  ['ec', 'Ecuador', ''],
  ['eg', 'Egypt', ''],
  ['sv', 'El Salvador', ''],
  ['gq', 'Equatorial Guinea', ''],
  ['er', 'Eritrea', ''],
  ['ee', 'Estonia', ''],
  ['sz', 'Eswatini', 'Swaziland'],
  ['et', 'Ethiopia', ''],
  ['fj', 'Fiji', ''],
  ['fi', 'Finland', ''],
  ['fr', 'France', ''],
  ['ga', 'Gabon', ''],
  ['gm', 'Gambia', ''],
  ['ge', 'Georgia', ''],
  ['de', 'Germany', ''],
  ['gh', 'Ghana', ''],
  ['gr', 'Greece', ''],
  ['gd', 'Grenada', ''],
  ['gt', 'Guatemala', ''],
  ['gn', 'Guinea', ''],
  ['gw', 'Guinea-Bissau', ''],
  ['gy', 'Guyana', ''],
  ['ht', 'Haiti', ''],
  ['hn', 'Honduras', ''],
  ['hu', 'Hungary', ''],
  ['is', 'Iceland', ''],
  ['in', 'India', ''],
  ['id', 'Indonesia', ''],
  ['ir', 'Iran', ''],
  ['iq', 'Iraq', ''],
  ['ie', 'Ireland', ''],
  ['il', 'Israel', ''],
  ['it', 'Italy', ''],
  ['ci', 'Ivory Coast', 'Cote dIvoire'],
  ['jm', 'Jamaica', ''],
  ['jp', 'Japan', ''],
  ['jo', 'Jordan', ''],
  ['kz', 'Kazakhstan', ''],
  ['ke', 'Kenya', ''],
  ['ki', 'Kiribati', ''],
  ['kw', 'Kuwait', ''],
  ['kg', 'Kyrgyzstan', ''],
  ['la', 'Laos', ''],
  ['lv', 'Latvia', ''],
  ['lb', 'Lebanon', ''],
  ['ls', 'Lesotho', ''],
  ['lr', 'Liberia', ''],
  ['ly', 'Libya', ''],
  ['li', 'Liechtenstein', ''],
  ['lt', 'Lithuania', ''],
  ['lu', 'Luxembourg', ''],
  ['mg', 'Madagascar', ''],
  ['mw', 'Malawi', ''],
  ['my', 'Malaysia', ''],
  ['mv', 'Maldives', ''],
  ['ml', 'Mali', ''],
  ['mt', 'Malta', ''],
  ['mh', 'Marshall Islands', ''],
  ['mr', 'Mauritania', ''],
  ['mu', 'Mauritius', ''],
  ['mx', 'Mexico', ''],
  ['fm', 'Micronesia', ''],
  ['md', 'Moldova', ''],
  ['mc', 'Monaco', ''],
  ['mn', 'Mongolia', ''],
  ['me', 'Montenegro', ''],
  ['ma', 'Morocco', ''],
  ['mz', 'Mozambique', ''],
  ['mm', 'Myanmar', 'Burma'],
  ['na', 'Namibia', ''],
  ['nr', 'Nauru', ''],
  ['np', 'Nepal', ''],
  ['nl', 'Netherlands', 'Holland'],
  ['nz', 'New Zealand', ''],
  ['ni', 'Nicaragua', ''],
  ['ne', 'Niger', ''],
  ['ng', 'Nigeria', ''],
  ['kp', 'North Korea', 'Korea'],
  ['mk', 'North Macedonia', 'Macedonia'],
  ['no', 'Norway', ''],
  ['om', 'Oman', ''],
  ['pk', 'Pakistan', ''],
  ['pw', 'Palau', ''],
  ['ps', 'Palestine', ''],
  ['pa', 'Panama', ''],
  ['pg', 'Papua New Guinea', ''],
  ['py', 'Paraguay', ''],
  ['pe', 'Peru', ''],
  ['ph', 'Philippines', ''],
  ['pl', 'Poland', ''],
  ['pt', 'Portugal', ''],
  ['qa', 'Qatar', ''],
  ['ro', 'Romania', ''],
  ['ru', 'Russia', ''],
  ['rw', 'Rwanda', ''],
  ['kn', 'Saint Kitts and Nevis', ''],
  ['lc', 'Saint Lucia', ''],
  ['vc', 'Saint Vincent and the Grenadines', ''],
  ['ws', 'Samoa', ''],
  ['sm', 'San Marino', ''],
  ['st', 'Sao Tome and Principe', ''],
  ['sa', 'Saudi Arabia', ''],
  ['sn', 'Senegal', ''],
  ['rs', 'Serbia', ''],
  ['sc', 'Seychelles', ''],
  ['sl', 'Sierra Leone', ''],
  ['sg', 'Singapore', ''],
  ['sk', 'Slovakia', ''],
  ['si', 'Slovenia', ''],
  ['sb', 'Solomon Islands', ''],
  ['so', 'Somalia', ''],
  ['za', 'South Africa', ''],
  ['kr', 'South Korea', 'Korea'],
  ['ss', 'South Sudan', ''],
  ['es', 'Spain', ''],
  ['lk', 'Sri Lanka', ''],
  ['sd', 'Sudan', ''],
  ['sr', 'Suriname', ''],
  ['se', 'Sweden', ''],
  ['ch', 'Switzerland', ''],
  ['sy', 'Syria', ''],
  ['tj', 'Tajikistan', ''],
  ['tz', 'Tanzania', ''],
  ['th', 'Thailand', ''],
  ['tl', 'Timor-Leste', 'East Timor'],
  ['tg', 'Togo', ''],
  ['to', 'Tonga', ''],
  ['tt', 'Trinidad and Tobago', ''],
  ['tn', 'Tunisia', ''],
  ['tr', 'Turkey', 'Turkiye'],
  ['tm', 'Turkmenistan', ''],
  ['tv', 'Tuvalu', ''],
  ['ug', 'Uganda', ''],
  ['ua', 'Ukraine', ''],
  ['ae', 'United Arab Emirates', 'UAE Emirates'],
  ['gb', 'United Kingdom', 'UK Britain England Scotland Wales'],
  ['us', 'United States', 'USA America'],
  ['uy', 'Uruguay', ''],
  ['uz', 'Uzbekistan', ''],
  ['vu', 'Vanuatu', ''],
  ['va', 'Vatican City', 'Holy See'],
  ['ve', 'Venezuela', ''],
  ['vn', 'Vietnam', ''],
  ['ye', 'Yemen', ''],
  ['zm', 'Zambia', ''],
  ['zw', 'Zimbabwe', '']
] as const;

export type Country = (typeof LIST)[number][0] | 'other';

export const COUNTRIES: { value: Country; label: string; aka: string }[] = LIST.map(
  ([value, label, aka]) => ({ value, label, aka })
);

/** The flag as an emoji, built from the country code's two letters. */
export function flagFor(country: Country): string {
  if (country === 'other' || country.length !== 2) return '';
  const A = 0x1f1e6; // Regional Indicator Symbol Letter A
  return String.fromCodePoint(
    ...[...country.toUpperCase()].map((letter) => A + letter.charCodeAt(0) - 65)
  );
}

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

/**
 * Name first, then the aliases, so "emirates" finds the UAE and "korea" finds
 * both Koreas. Codes are deliberately not matched: two letters would drag in
 * half the list on every keystroke.
 */
export function searchCountries(query: string): typeof COUNTRIES {
  const needle = query.trim().toLowerCase();
  if (!needle) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.label.toLowerCase().includes(needle) || c.aka.toLowerCase().includes(needle)
  );
}

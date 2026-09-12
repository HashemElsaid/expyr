import type { Country } from '@/data/countries';
import type { DocumentDraft } from '@/types';

/**
 * The invented American household the App Store screenshots are taken of.
 *
 * Michael and Sarah Bennett of Denver, who do not exist. Written down rather
 * than typed in each time because screenshots have to be retaken for every
 * version, and ten minutes of typing before each one is how a screenshot ends
 * up showing "test test" and a date in 1970.
 *
 * American on purpose. The store listing is worldwide and the first screenshot
 * is the whole of what most people ever see of an app, so a shelf of Emirates
 * IDs tells the majority of the people looking that Expyr is not for them. The
 * app works the same either way; the pictures are a claim about who it is for.
 *
 * Every date is relative to the day it is seeded, so the screenshots are never
 * of a list that has quietly gone stale. One item is deliberately overdue,
 * because the red state is the one the app exists for and a screenshot without
 * it is a screenshot of a to-do list nobody has used.
 *
 * Development only. The Settings rows that call this are inside `__DEV__` and
 * do not exist in a shipped build.
 */

/**
 * An ISO date this many days out.
 *
 * Built from the local date parts rather than through `toISOString`, which
 * converts to UTC first: east of Greenwich local midnight is the previous day,
 * and every date here would land one early.
 */
function inDays(days: number): string {
  const when = new Date();
  when.setHours(0, 0, 0, 0);
  when.setDate(when.getDate() + days);
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const day = String(when.getDate()).padStart(2, '0');
  return `${when.getFullYear()}-${month}-${day}`;
}

/** Whose phone this is, in the demo. */
export const DEMO_OWN_NAME = 'Michael';

/**
 * Where they live, which decides more than the flag on the settings screen.
 *
 * Every label and every piece of guidance is chosen by country. Left unset,
 * `labelFor` falls back to the UAE wording, and the Denver lease appears as
 * "Tenancy Contract (Ejari)" with a cost in dirhams. The seed sets this for
 * the same reason it sets the names.
 */
export const DEMO_COUNTRY: Country = 'us';
const SARAH = 'Sarah';

export function demoHousehold(): DocumentDraft[] {
  return [
    // ------------------------------------------------------------ Michael
    {
      typeId: 'passport',
      title: 'US passport',
      expiryDate: inDays(243),
      documentNumber: 'C03847291',
      owner: DEMO_OWN_NAME,
      leadDays: [180, 90, 30],
      files: [],
      fields: [
        { label: 'Full name', value: 'Michael James Bennett', kind: 'name' },
        { label: 'Issuing authority', value: 'United States Department of State', kind: 'place' },
      ],
    },
    {
      typeId: 'driving-license',
      title: 'Colorado driver’s license',
      expiryDate: inDays(151),
      owner: DEMO_OWN_NAME,
      leadDays: [90, 30, 7],
      files: [],
      fields: [
        { label: 'Class', value: 'R', kind: 'other' },
        { label: 'Renewal fee', value: 'USD 30', kind: 'money' },
      ],
    },
    /*
     * The overdue one. Registration rather than anything with a passport's
     * weight, because an expired passport in a screenshot reads as alarming
     * and an expired car registration reads as ordinary life.
     */
    {
      typeId: 'car-registration',
      title: 'Subaru Outback registration',
      expiryDate: inDays(-6),
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      fields: [
        { label: 'Plate', value: 'CO 8ZQ-114', kind: 'other' },
        { label: 'Late fee', value: 'USD 25', kind: 'money' },
      ],
    },
    {
      typeId: 'health-insurance',
      title: 'Anthem health plan',
      expiryDate: inDays(96),
      owner: DEMO_OWN_NAME,
      leadDays: [60, 30, 7],
      files: [],
      fields: [
        { label: 'Member ID', value: 'AB4820193', kind: 'number' },
        { label: 'Monthly premium', value: 'USD 412', kind: 'money' },
      ],
    },
    {
      typeId: 'tenancy-ejari',
      title: 'Denver apartment lease',
      expiryDate: inDays(208),
      owner: DEMO_OWN_NAME,
      leadDays: [90, 60, 30],
      files: [],
      fields: [
        { label: 'Started', value: inDays(-157), kind: 'date' },
        { label: 'Address', value: '1412 Pearl Street, Denver, CO', kind: 'place' },
        { label: 'Monthly rent', value: 'USD 2,150', kind: 'money' },
      ],
    },
    {
      typeId: 'warranty',
      title: 'Refrigerator warranty',
      expiryDate: inDays(58),
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      fields: [{ label: 'Covers', value: 'Parts and labour', kind: 'other' }],
    },

    // -------------------------------------------------------------- Sarah
    {
      typeId: 'labor-card',
      title: 'H-1B work permit',
      expiryDate: inDays(124),
      owner: SARAH,
      leadDays: [120, 60, 30],
      files: [],
      fields: [
        { label: 'Full name', value: 'Sarah Bennett', kind: 'name' },
        { label: 'Employer', value: 'Kestrel Analytics', kind: 'place' },
      ],
    },
    {
      typeId: 'passport',
      title: 'US passport',
      expiryDate: inDays(311),
      owner: SARAH,
      leadDays: [180, 90, 30],
      files: [],
      fields: [{ label: 'Full name', value: 'Sarah Anne Bennett', kind: 'name' }],
    },

    // ------------------------------------------------------ subscriptions
    /*
     * Spread across the year rather than all inside one month: two of these
     * renew yearly, so the list shows the range the app actually handles
     * rather than five rows that all say "in 3 weeks".
     */
    {
      typeId: 'membership',
      title: 'Netflix',
      expiryDate: inDays(3),
      renewsEvery: 'monthly',
      iconDomain: 'netflix.com',
      owner: DEMO_OWN_NAME,
      leadDays: [3],
      files: [],
      fields: [{ label: 'Plan', value: 'Standard, USD 17.99', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Verizon phone plan',
      expiryDate: inDays(9),
      renewsEvery: 'monthly',
      iconDomain: 'verizon.com',
      owner: DEMO_OWN_NAME,
      leadDays: [3],
      files: [],
      fields: [{ label: 'Plan', value: 'Unlimited, USD 85', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Spotify',
      expiryDate: inDays(17),
      renewsEvery: 'monthly',
      iconDomain: 'spotify.com',
      owner: SARAH,
      leadDays: [3],
      files: [],
      fields: [{ label: 'Plan', value: 'Duo, USD 16.99', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'iCloud+',
      expiryDate: inDays(74),
      renewsEvery: 'yearly',
      iconDomain: 'icloud.com',
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      fields: [{ label: 'Plan', value: '2 TB, USD 119.88 a year', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Alpine Fitness',
      expiryDate: inDays(167),
      renewsEvery: 'yearly',
      owner: SARAH,
      leadDays: [60, 30, 7],
      files: [],
      fields: [{ label: 'Membership', value: 'Annual, USD 588', kind: 'money' }],
    },
  ];
}

/**
 * How a seeded item is recognised again, for both halves of the job: seeding
 * twice must not double the list, and clearing must take back exactly what was
 * put there.
 *
 * Title and owner together, because the two passports share a title and differ
 * only by whose they are. Matching on title alone would have seeded one of
 * them and called the other a duplicate.
 */
export function demoKey(item: { title: string; owner?: string }): string {
  return `${item.title} ${item.owner ?? ''}`;
}

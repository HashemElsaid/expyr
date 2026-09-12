import type { Country } from '@/data/countries';
import type { DocumentDraft } from '@/types';

/**
 * The invented American household the App Store screenshots are taken of.
 *
 * Michael and Sarah Bennett of Cherry Hills Village, Denver, who do not exist.
 * Written down rather than typed in each time because screenshots have to be
 * retaken for every version, and ten minutes of typing before each one is how
 * a store listing ends up showing "test test" and a date in 1970.
 *
 * American on purpose. The listing is worldwide and the first screenshot is
 * the whole of what most people ever see of an app, so a shelf of Emirates IDs
 * tells the majority of the people looking that Expyr is not for them. The app
 * works the same either way; the pictures are a claim about who it is for.
 *
 * Comfortable on purpose too. What somebody tracks is a picture of their life,
 * and a screenshot of a lapsed permit and a phone bill sells the app to people
 * scraping by. The Bennetts have an S-Class and a villa, and the registration
 * lapsed anyway, which is the whole argument for the app in one row.
 *
 * Every date is relative to the day it is seeded, so the set never quietly
 * goes stale sitting in the repo. One item is overdue, because the red state
 * is the one the app exists for; one falls inside the week; the rest spread
 * across a year, so all four Timeline cards show a number.
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
 * `labelFor` falls back to the UAE wording, and the villa tenancy appears as
 * "Tenancy Contract (Ejari)" with a cost in dirhams. The seed sets this for
 * the same reason it sets the names.
 */
export const DEMO_COUNTRY: Country = 'us';

const SARAH = 'Sarah';

export function demoHousehold(): DocumentDraft[] {
  return [
    // ============================================================== the car
    /*
     * The overdue one, and the only one allowed to be.
     *
     * A registration rather than a passport, because an expired passport in a
     * screenshot reads as alarming while an expired registration reads as the
     * ordinary thing that happens to everybody. It is also what the picture
     * rests on: they can afford the car and the renewal, and it lapsed anyway.
     */
    {
      typeId: 'car-registration',
      title: 'Mercedes S-Class registration',
      expiryDate: inDays(-4),
      documentNumber: 'WDDUG8FB4KA492077',
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      fields: [
        { label: 'Plate', value: 'CO 4RN-820', kind: 'other' },
        { label: 'Renewal fee', value: 'USD 812', kind: 'money' },
        { label: 'Late fee', value: 'USD 25 a month', kind: 'money' },
      ],
    },
    {
      typeId: 'car-insurance',
      title: 'Mercedes S-Class insurance',
      expiryDate: inDays(47),
      owner: DEMO_OWN_NAME,
      leadDays: [60, 30, 7],
      files: [],
      fields: [
        { label: 'Insurer', value: 'Chubb', kind: 'place' },
        { label: 'Policy number', value: 'CH-4471-2286', kind: 'number' },
        { label: 'Annual premium', value: 'USD 3,140', kind: 'money' },
      ],
    },

    // ============================================================ the house
    {
      typeId: 'tenancy-ejari',
      title: 'Cherry Hills villa tenancy',
      expiryDate: inDays(196),
      owner: DEMO_OWN_NAME,
      leadDays: [90, 60, 30],
      files: [],
      fields: [
        { label: 'Started', value: inDays(-169), kind: 'date' },
        { label: 'Address', value: '4820 Blackmer Road, Cherry Hills Village, CO', kind: 'place' },
        { label: 'Annual rent', value: 'USD 96,000', kind: 'money' },
      ],
    },

    // ========================================================= the identity
    {
      typeId: 'passport',
      title: 'US passport',
      expiryDate: inDays(283),
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
      typeId: 'passport',
      title: 'US passport',
      expiryDate: inDays(341),
      documentNumber: 'C04120558',
      owner: SARAH,
      leadDays: [180, 90, 30],
      files: [],
      fields: [{ label: 'Full name', value: 'Sarah Anne Bennett', kind: 'name' }],
    },
    {
      typeId: 'driving-license',
      title: 'Colorado driver’s license',
      expiryDate: inDays(129),
      owner: DEMO_OWN_NAME,
      leadDays: [90, 30, 7],
      files: [],
      fields: [
        { label: 'Class', value: 'R', kind: 'other' },
        { label: 'Renewal fee', value: 'USD 30', kind: 'money' },
      ],
    },
    /*
     * `other` rather than `membership`, deliberately. `isSubscription` counts
     * anything of type membership as a subscription whatever its dates say, so
     * Global Entry would have turned up on the subscriptions screen renewing
     * once every five years, between Netflix and the electricity. It is a
     * document somebody holds, so it is filed as one.
     */
    {
      typeId: 'other',
      title: 'Global Entry membership',
      expiryDate: inDays(224),
      documentNumber: '98812470',
      owner: DEMO_OWN_NAME,
      leadDays: [180, 90],
      files: [],
      fields: [{ label: 'Programme', value: 'CBP Trusted Traveler', kind: 'place' }],
    },
    {
      typeId: 'labor-card',
      title: 'H-1B work permit',
      expiryDate: inDays(158),
      owner: SARAH,
      leadDays: [120, 60, 30],
      files: [],
      fields: [
        { label: 'Full name', value: 'Sarah Anne Bennett', kind: 'name' },
        { label: 'Employer', value: 'Kestrel Analytics', kind: 'place' },
      ],
    },

    // ======================================================= and the rest
    {
      typeId: 'health-insurance',
      title: 'Anthem family health plan',
      expiryDate: inDays(112),
      owner: DEMO_OWN_NAME,
      leadDays: [60, 30, 7],
      files: [],
      fields: [
        { label: 'Member ID', value: 'AB4820193', kind: 'number' },
        { label: 'Monthly premium', value: 'USD 1,480', kind: 'money' },
      ],
    },
    {
      typeId: 'warranty',
      title: 'Rolex Submariner warranty',
      expiryDate: inDays(88),
      documentNumber: '124060-8817',
      owner: DEMO_OWN_NAME,
      leadDays: [60, 30],
      files: [],
      fields: [
        { label: 'Covers', value: 'International service guarantee', kind: 'other' },
        { label: 'Bought from', value: 'Hyde Park Jewelers, Denver', kind: 'place' },
      ],
    },

    // ======================================================= subscriptions
    /*
     * Spread rather than bunched: Bloomberg renews yearly, so the list shows
     * the range the app handles instead of six rows all saying "in 3 weeks".
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
      price: { amount: 24.99, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: 'Premium, USD 24.99 a month', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Equinox membership',
      expiryDate: inDays(9),
      renewsEvery: 'monthly',
      iconDomain: 'equinox.com',
      owner: SARAH,
      leadDays: [7],
      files: [],
      price: { amount: 335, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: 'Destination, USD 335 a month', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Verizon phone plan',
      expiryDate: inDays(11),
      renewsEvery: 'monthly',
      iconDomain: 'verizon.com',
      owner: DEMO_OWN_NAME,
      leadDays: [3],
      files: [],
      price: { amount: 115, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: 'Unlimited Ultimate, USD 115 a month', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Spotify',
      expiryDate: inDays(16),
      renewsEvery: 'monthly',
      iconDomain: 'spotify.com',
      owner: SARAH,
      leadDays: [3],
      files: [],
      price: { amount: 19.99, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: 'Family, USD 19.99 a month', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'iCloud+ 2TB',
      expiryDate: inDays(21),
      renewsEvery: 'monthly',
      iconDomain: 'icloud.com',
      owner: DEMO_OWN_NAME,
      leadDays: [3],
      files: [],
      price: { amount: 9.99, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: '2 TB, USD 9.99 a month', kind: 'money' }],
    },
    {
      typeId: 'membership',
      title: 'Bloomberg',
      expiryDate: inDays(64),
      renewsEvery: 'yearly',
      iconDomain: 'bloomberg.com',
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      price: { amount: 415, currency: 'USD', every: 'yearly' },
      fields: [{ label: 'Plan', value: 'Digital, USD 415 a year', kind: 'money' }],
    },

    // =============================================================== bills
    /*
     * The one inside the week, so the list opens on something that matters
     * today rather than on a date six months out.
     */
    {
      typeId: 'bill',
      title: 'Xcel Energy electricity',
      expiryDate: inDays(5),
      renewsEvery: 'monthly',
      iconDomain: 'xcelenergy.com',
      owner: DEMO_OWN_NAME,
      leadDays: [7, 3],
      files: [],
      price: { amount: 240, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Typical bill', value: 'USD 240 a month', kind: 'money' }],
    },
    {
      typeId: 'bill',
      title: 'Xfinity internet',
      expiryDate: inDays(13),
      renewsEvery: 'monthly',
      iconDomain: 'xfinity.com',
      owner: DEMO_OWN_NAME,
      leadDays: [7, 3],
      files: [],
      price: { amount: 120, currency: 'USD', every: 'monthly' },
      fields: [{ label: 'Plan', value: 'Gigabit, USD 120 a month', kind: 'money' }],
    },
    {
      typeId: 'bill',
      title: 'Denver Water',
      expiryDate: inDays(26),
      renewsEvery: 'quarterly',
      iconDomain: 'denverwater.org',
      owner: DEMO_OWN_NAME,
      leadDays: [14, 3],
      files: [],
      price: { amount: 185, currency: 'USD', every: 'quarterly' },
      fields: [{ label: 'Typical bill', value: 'USD 185 a quarter', kind: 'money' }],
    },
    {
      typeId: 'bill',
      title: 'Cherry Hills HOA dues',
      expiryDate: inDays(38),
      renewsEvery: 'quarterly',
      owner: DEMO_OWN_NAME,
      leadDays: [30, 7],
      files: [],
      price: { amount: 1250, currency: 'USD', every: 'quarterly' },
      fields: [{ label: 'Dues', value: 'USD 1,250 a quarter', kind: 'money' }],
    },
  ];
}

/**
 * How a seeded item is recognised again, for both halves of the job: seeding
 * twice must not double the list, and clearing must take back exactly what was
 * put there.
 *
 * Title and owner together, because both Bennetts have a US passport and they
 * differ only by whose it is. Matching on title alone would have seeded one of
 * them and called the other a duplicate.
 */
export function demoKey(item: { title: string; owner?: string }): string {
  return `${item.title} ${item.owner ?? ''}`;
}

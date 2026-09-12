import { describe, expect, it } from 'vitest';

import { labelForId } from '@/data/document-types';

import { DEMO_COUNTRY, DEMO_OWN_NAME, demoHousehold, demoKey } from './demo-household';

const household = demoHousehold();

function daysOut(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

describe('the household the screenshots are taken of', () => {
  /*
   * Seeding is idempotent by skipping anything already there under the same
   * key, so two items sharing a key would mean one of them never seeded. Both
   * Bennetts have a US passport, which is exactly the collision that would
   * have happened had the key been the title alone.
   */
  it('gives every item a key of its own', () => {
    const keys = household.map(demoKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has both passports, told apart by whose they are', () => {
    const passports = household.filter((item) => item.title === 'US passport');
    expect(passports).toHaveLength(2);
    expect(new Set(passports.map((item) => item.owner))).toEqual(new Set([DEMO_OWN_NAME, 'Sarah']));
  });

  /*
   * The red state is the one the app exists for. A screenshot without it is a
   * screenshot of a to-do list nobody has used.
   */
  it('has exactly one thing overdue', () => {
    const overdue = household.filter((item) => daysOut(item.expiryDate) < 0);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('Subaru Outback registration');
  });

  it('has five subscriptions, not all renewing in the same month', () => {
    const subscriptions = household.filter((item) => item.renewsEvery);
    expect(subscriptions).toHaveLength(5);
    expect(Math.max(...subscriptions.map((item) => daysOut(item.expiryDate)))).toBeGreaterThan(60);
  });

  it('has eight documents that are not subscriptions', () => {
    expect(household.filter((item) => !item.renewsEvery)).toHaveLength(8);
  });

  it('is two people, one of them the owner of the phone', () => {
    const owners = new Set(household.map((item) => item.owner));
    expect(owners).toEqual(new Set([DEMO_OWN_NAME, 'Sarah']));
  });

  /*
   * The listing is worldwide and the first screenshot is the whole of what
   * most people see. A shelf of Emirates IDs tells most of them Expyr is not
   * for them.
   */
  it('renders nothing from the UAE, under the country the seed sets', () => {
    const onScreen = household
      .map((item) => `${item.title} ${labelForId(item.typeId, DEMO_COUNTRY)} ${JSON.stringify(item.fields ?? [])}`)
      .join(' ');
    expect(onScreen).not.toMatch(/Emirates|Ejari|AED|Dubai|Abu Dhabi/i);
  });

  /*
   * The one that is easy to get wrong. Labels are chosen by country, and with
   * none set labelFor falls back to the UAE wording, so the Denver lease would
   * photograph as "Tenancy Contract (Ejari)". The seed sets the country for
   * exactly this reason, and this is the assertion that says so.
   */
  it('shows the lease as a tenancy contract, not as an Ejari', () => {
    expect(labelForId('tenancy-ejari', DEMO_COUNTRY)).toBe('Tenancy Contract');
    expect(labelForId('tenancy-ejari', null)).toBe('Tenancy Contract (Ejari)');
  });

  /** Dates are relative, so the screenshots never go stale sitting in a repo. */
  it('is dated from today, not from a day somebody wrote it', () => {
    for (const item of household) {
      expect(daysOut(item.expiryDate)).toBeGreaterThan(-30);
      expect(daysOut(item.expiryDate)).toBeLessThan(400);
    }
  });
});

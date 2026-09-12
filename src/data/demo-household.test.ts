import { describe, expect, it } from 'vitest';

import { labelForId } from '@/data/document-types';
import { isSubscription } from '@/domain/documents';
import { formatYearly, yearlyTotal } from '@/domain/money';
import type { DocumentDraft, TrackedDocument } from '@/types';

import { DEMO_COUNTRY, DEMO_OWN_NAME, demoHousehold, demoKey } from './demo-household';

const household = demoHousehold();

/** The seed is drafts; the total takes documents. Nothing else differs here. */
function asTracked(draft: DocumentDraft): TrackedDocument {
  return { ...draft, id: draft.title, visibility: 'private', createdAt: '', updatedAt: '' };
}

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
   * All four Timeline cards have to show a number, or the first screenshot is
   * of an app with nothing going on. Overdue, Next 30 days, All, and the count
   * of people in the household.
   */
  it('lights all four Timeline cards', () => {
    const overdue = household.filter((item) => daysOut(item.expiryDate) < 0);
    const soon = household.filter((item) => {
      const days = daysOut(item.expiryDate);
      return days >= 0 && days <= 30;
    });
    const people = new Set(household.map((item) => item.owner));

    expect(overdue.length).toBeGreaterThan(0);
    expect(soon.length).toBeGreaterThan(0);
    expect(household.length).toBeGreaterThan(0);
    expect(people.size).toBe(2);
  });

  /*
   * The red state is the one the app exists for, and exactly one of them,
   * because a screenshot of five lapsed documents sells carelessness rather
   * than the app.
   */
  it('has exactly one thing overdue, and it is the registration', () => {
    const overdue = household.filter((item) => daysOut(item.expiryDate) < 0);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('Mercedes S-Class registration');
  });

  it('has something inside the week', () => {
    const thisWeek = household.filter((item) => {
      const days = daysOut(item.expiryDate);
      return days >= 0 && days <= 7;
    });
    expect(thisWeek.length).toBeGreaterThan(0);
  });

  /*
   * Global Entry is the trap. `isSubscription` counts anything of type
   * membership as one whatever its dates say, so filing it under membership
   * would have put a five-yearly document on the subscriptions screen between
   * Netflix and the electricity bill.
   */
  it('keeps Global Entry out of the subscriptions', () => {
    const globalEntry = household.find((item) => item.title === 'Global Entry membership');
    expect(globalEntry).toBeDefined();
    expect(isSubscription(globalEntry!)).toBe(false);
  });

  it('has the six subscriptions and the four bills, all recurring', () => {
    const memberships = household.filter((item) => item.typeId === 'membership');
    const bills = household.filter((item) => item.typeId === 'bill');
    expect(memberships).toHaveLength(6);
    expect(bills).toHaveLength(4);
    for (const item of [...memberships, ...bills]) {
      expect(item.renewsEvery, item.title).toBeTruthy();
    }
  });

  /** Every price is in dollars, because they live in Denver. */
  it('prices everything in USD', () => {
    for (const item of household) {
      for (const field of item.fields ?? []) {
        if (field.kind !== 'money') continue;
        expect(field.value, `${item.title}: ${field.value}`).toMatch(/USD/);
      }
    }
  });

  /*
   * The rule is that a title says what the thing is. Whose it is lives in its
   * own field and is shown beside the title, so a name in a title is the same
   * fact twice.
   */
  it('never puts a person in a title', () => {
    for (const item of household) {
      expect(item.title, item.title).not.toMatch(/Michael|Sarah|Bennett/);
    }
  });

  /*
   * The listing is worldwide and the first screenshot is the whole of what
   * most people see. A shelf of Emirates IDs tells most of them Expyr is not
   * for them.
   */
  it('renders nothing from the UAE, under the country the seed sets', () => {
    const onScreen = household
      .map(
        (item) =>
          `${item.title} ${labelForId(item.typeId, DEMO_COUNTRY)} ${JSON.stringify(item.fields ?? [])}`
      )
      .join(' ');
    expect(onScreen).not.toMatch(/Emirates|Ejari|AED|Dubai|Abu Dhabi/i);
  });

  /*
   * The one that is easy to get wrong. Labels are chosen by country, and with
   * none set labelFor falls back to the UAE wording, so the villa would
   * photograph as "Tenancy Contract (Ejari)". The seed sets the country for
   * exactly this reason, and this is the assertion that says so.
   */
  it('shows the villa as a tenancy contract, not as an Ejari', () => {
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

/*
 * The screenshot the listing headline promises. "See what your year actually
 * costs" has to be a real figure under the real list, so the seeded household
 * is what proves the number the picture will show.
 */
describe('what the demo household costs a year', () => {
  const recurring = household.filter((item) => item.renewsEvery);

  it('prices every recurring item, or the total understates itself', () => {
    for (const item of recurring) {
      expect(item.price, item.title).toBeDefined();
      expect(item.price?.currency, item.title).toBe('USD');
      // The cadence on the price is the cadence it actually charges at.
      expect(item.price?.every, item.title).toBe(item.renewsEvery);
    }
  });

  it('comes to one uncomfortable figure in one currency', () => {
    const total = yearlyTotal(recurring.map(asTracked));
    expect(total.kind).toBe('one');
    // 864.97 a month over twelve, 1,435 a quarter over four, and Bloomberg's
    // 415 once. Checked by hand, because a total nobody has checked is the
    // thing this whole module is about not shipping.
    expect(formatYearly(total)).toBe('USD 16,535 a year');
  });

  /** Nothing one-off is in it: the villa's rent and the car's fee stay out. */
  it('leaves the one-off fees out of the year', () => {
    const total = yearlyTotal(household.map(asTracked));
    const recurringOnly = yearlyTotal(recurring.map(asTracked));
    expect(total).toEqual(recurringOnly);
  });
});

import { describe, expect, it } from 'vitest';

import { testReminderExamples } from './test-reminder';
import type { TrackedDocument } from '@/types';

/**
 * An ISO date this many days from today, so the tests do not age.
 *
 * Built from the local date parts rather than through toISOString, which
 * converts to UTC first: east of Greenwich, local midnight is the previous
 * day in UTC and every date here came out a day early.
 */
function inDays(days: number): string {
  const when = new Date();
  when.setHours(0, 0, 0, 0);
  when.setDate(when.getDate() + days);
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const day = String(when.getDate()).padStart(2, '0');
  return `${when.getFullYear()}-${month}-${day}`;
}

function doc(partial: Partial<TrackedDocument> & { title: string }): TrackedDocument {
  return {
    id: partial.title,
    typeId: 'other',
    expiryDate: inDays(30),
    leadDays: [30],
    createdAt: new Date().toISOString(),
    files: [],
    ...partial,
  } as TrackedDocument;
}

describe('what the test reminder says', () => {
  /*
   * The bug: it said "Emirates ID expires in 30 days" and "Netflix charges you
   * in 3 days" to everybody, which is a fair guess in Dubai and a stranger's
   * paperwork in Ohio.
   */
  it('names nothing local to anywhere when there is nothing to name', () => {
    const example = testReminderExamples([]);
    expect(example.document).toBe('Passport expires in 30 days');
    expect(example.subscription).toBe('A subscription renews in 3 days');
    expect(`${example.document} ${example.subscription}`).not.toMatch(/Emirates|Netflix|AED/);
  });

  it('uses their own soonest document, phrased like a real reminder', () => {
    const example = testReminderExamples([
      doc({ title: 'Egyptian passport', expiryDate: inDays(90) }),
      doc({ title: 'Tenancy contract', expiryDate: inDays(200) }),
    ]);
    expect(example.document).toBe('Egyptian passport expires in 3 months');
  });

  it('uses their own soonest subscription, with the verb that fits it', () => {
    const example = testReminderExamples([
      doc({ title: 'Passport', expiryDate: inDays(90) }),
      doc({ title: 'Spotify', expiryDate: inDays(4), renewsEvery: 'monthly' }),
    ]);
    expect(example.document).toBe('Passport expires in 3 months');
    expect(example.subscription).toBe('Spotify charges you in 4 days');
  });

  /*
   * A subscription is not a document example and a document is not a
   * subscription example, because the two reminders carry different buttons
   * and the test exists to show both.
   */
  it('keeps the two kinds apart, falling back for whichever is missing', () => {
    const onlySubs = testReminderExamples([
      doc({ title: 'Spotify', expiryDate: inDays(4), renewsEvery: 'monthly' }),
    ]);
    expect(onlySubs.document).toBe('Passport expires in 30 days');
    expect(onlySubs.subscription).toBe('Spotify charges you in 4 days');

    const onlyDocs = testReminderExamples([doc({ title: 'Visa', expiryDate: inDays(10) })]);
    expect(onlyDocs.document).toBe('Visa expires in 10 days');
    expect(onlyDocs.subscription).toBe('A subscription renews in 3 days');
  });

  /*
   * `dueIn` would call something two years stale "expires today". A test
   * reminder that misstates a date is worse than a generic one that states
   * nothing, so expired items are passed over.
   */
  it('passes over what has already expired', () => {
    const example = testReminderExamples([
      doc({ title: 'Old visa', expiryDate: inDays(-400) }),
      doc({ title: 'Car registration', expiryDate: inDays(12) }),
    ]);
    expect(example.document).toBe('Car registration expires in 12 days');
  });

  it('falls back rather than naming something that has expired', () => {
    const example = testReminderExamples([doc({ title: 'Old visa', expiryDate: inDays(-400) })]);
    expect(example.document).toBe('Passport expires in 30 days');
  });
});

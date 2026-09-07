import { describe, expect, it } from 'vitest';

import { REMINDER_BUDGET, SUBSCRIPTION_CATEGORY, leadLabel, planReminders, snoozeDate } from '@/lib/reminder-plan';
import { inDays, makeDocument } from '@/test/factories';

/**
 * The bug this module exists to fix cannot be seen from inside the app: iOS
 * keeps the 64 soonest pending notifications and discards the rest without
 * telling anybody. So the guarantee has to be proved here, on the plan, before
 * it ever reaches a device.
 */

const NOW = new Date(2026, 8, 5, 8, 0, 0);

describe('planReminders', () => {
  it('books one reminder per lead day', () => {
    // Emirates ID: 30, 14 and 7 days before.
    const eid = makeDocument('emirates-id', { expiryDate: inDays(200) });
    const plan = planReminders([eid], 'ae');

    expect(plan.book).toHaveLength(3);
    expect(plan.wanted).toBe(3);
  });

  it('skips lead times that have already gone by', () => {
    // Eight days left, so the 30- and 14-day nudges never had a moment to fire.
    const eid = makeDocument('emirates-id', { expiryDate: inDays(8) });
    const plan = planReminders([eid], 'ae');

    expect(plan.book).toHaveLength(1);
  });

  it('books nothing at all for an expired document', () => {
    const gone = makeDocument('passport', { expiryDate: inDays(-30) });
    expect(planReminders([gone], 'ae').book).toEqual([]);
  });

  it('books nothing for an archived one', () => {
    const done = makeDocument('passport', {
      expiryDate: inDays(300),
      archivedAt: new Date().toISOString(),
    });
    expect(planReminders([done], 'ae').book).toEqual([]);
  });

  it('orders everything by when it fires, across all documents', () => {
    const far = makeDocument('passport', { expiryDate: inDays(900) });
    const near = makeDocument('car-insurance', { expiryDate: inDays(40) });

    const times = planReminders([far, near], 'ae').book.map((r) => r.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  /* ---------------------------------------------------------- the ceiling -- */

  it('never books more than the budget, however many documents there are', () => {
    // Forty items at three lead days each is 120 candidates — nearly twice what
    // iOS will hold, and the exact shape that used to lose reminders silently.
    const many = Array.from({ length: 40 }, (_, i) =>
      makeDocument('emirates-id', { expiryDate: inDays(300 + i * 5) })
    );

    const plan = planReminders(many, 'ae');
    expect(plan.wanted).toBe(120);
    expect(plan.book).toHaveLength(REMINDER_BUDGET);
  });

  it('keeps the soonest and drops the furthest, not the other way round', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      makeDocument('emirates-id', { expiryDate: inDays(100 + i * 30) })
    );

    const plan = planReminders(many, 'ae');
    const booked = plan.book.map((r) => r.fireAt.getTime());
    const latestBooked = Math.max(...booked);

    // Every candidate that was left out fires after every one that was kept.
    const all = planReminders(many, 'ae', new Date(), 10_000).book.map((r) => r.fireAt.getTime());
    const dropped = all.filter((t) => !booked.includes(t));
    expect(Math.min(...dropped)).toBeGreaterThanOrEqual(latestBooked);
  });

  it('leaves room below the iOS ceiling for the reminders it does not plan', () => {
    // 64 is the iOS limit; the gap is for test reminders and rebalance overlap.
    expect(REMINDER_BUDGET).toBeLessThan(64);
  });

  /* ------------------------------------------------------------ the words -- */

  it('tells a subscription it will charge, not that it will expire', () => {
    const netflix = makeDocument('membership', {
      title: 'Netflix',
      expiryDate: inDays(20),
      renewsEvery: 'monthly',
    });

    const first = planReminders([netflix], 'ae').book[0];
    expect(first.title).toContain('charges you');
    expect(first.title).not.toContain('expires');
    expect(first.categoryIdentifier).toBe(SUBSCRIPTION_CATEGORY);
  });

  it('does not repeat the category when it is already the title', () => {
    const passport = makeDocument('passport', { title: 'Passport', expiryDate: inDays(300) });
    expect(planReminders([passport], 'ae').book[0].subtitle).toBe('');
  });

  it('names the owner when there is one', () => {
    const passport = makeDocument('passport', { owner: 'Amal', expiryDate: inDays(300) });
    expect(planReminders([passport], 'ae').book[0].subtitle).toContain('Amal');
  });

  it('keeps a fine out of the body where the fine is a paragraph, not a figure', () => {
    const passport = makeDocument('passport', { expiryDate: inDays(300) });
    expect(planReminders([passport], 'ae').book[0].body).not.toMatch(/Late:/);
  });

  it('says nothing about UAE fines to somebody who does not live there', () => {
    const eid = makeDocument('emirates-id', { expiryDate: inDays(200) });
    expect(planReminders([eid], 'eg').book[0].body).not.toMatch(/Late:/);
  });

  /* ------------------------------------------------------- subscriptions -- */

  /*
   * The decay bug. Reminders used to be booked only for the next charge, so a
   * monthly subscription went quiet the moment that charge passed and stayed
   * quiet until somebody opened the app — for the one kind of item that renews
   * whether or not anybody is watching.
   */
  it('warns about several charges ahead, not just the next one', () => {
    const netflix = makeDocument('membership', {
      title: 'Netflix',
      expiryDate: inDays(10),
      renewsEvery: 'monthly',
      leadDays: [3],
    });

    const dates = planReminders([netflix], 'ae').book.map((r) => r.fireAt.getMonth());
    expect(new Set(dates).size).toBeGreaterThan(1);
  });

  it('names the right charge date in each of them', () => {
    const netflix = makeDocument('membership', {
      title: 'Netflix',
      expiryDate: '2026-10-03',
      renewsEvery: 'monthly',
      leadDays: [3],
    });

    const bodies = planReminders([netflix], 'ae', new Date(2026, 8, 5)).book.map((r) => r.body);
    expect(bodies[0]).toContain('3 October');
    expect(bodies[1]).toContain('3 November');
  });

  it('rolls a subscription whose charge has already passed', () => {
    // Charged on the 20th of June; today is September. The next charge is the
    // 20th of September, and that is what should be warned about.
    const gym = makeDocument('membership', {
      title: 'Gym',
      expiryDate: '2026-06-20',
      renewsEvery: 'monthly',
      leadDays: [3],
    });

    const first = planReminders([gym], 'ae', new Date(2026, 8, 5)).book[0];
    expect(first.body).toContain('20 September');
  });

  /* ------------------------------------------------------------- snoozes -- */

  it('carries a snooze through a rebalance instead of losing it', () => {
    const doc = makeDocument('passport', {
      expiryDate: inDays(300),
      snoozedUntil: snoozeDate(7),
    });

    const plan = planReminders([doc], 'ae');
    // Three lead days plus the snooze the user asked for out loud.
    expect(plan.wanted).toBe(4);
    // And it is the soonest thing booked, a week out.
    expect(plan.book[0].fireAt.getTime()).toBeLessThan(plan.book[1].fireAt.getTime());
  });

  it('ignores a snooze whose day has passed', () => {
    const doc = makeDocument('passport', {
      expiryDate: inDays(300),
      snoozedUntil: inDays(-2),
    });
    expect(planReminders([doc], 'ae').wanted).toBe(3);
  });

  /* --------------------------------------------------------- fingerprint -- */

  it('gives the same plan the same fingerprint', () => {
    const docs = [makeDocument('passport', { expiryDate: inDays(300) })];
    expect(planReminders(docs, 'ae', NOW).fingerprint).toBe(
      planReminders(docs, 'ae', NOW).fingerprint
    );
  });

  it('changes the fingerprint when a date moves', () => {
    const before = makeDocument('passport', { id: 'p1', expiryDate: inDays(300) });
    const after = { ...before, expiryDate: inDays(301) };

    expect(planReminders([before], 'ae', NOW).fingerprint).not.toBe(
      planReminders([after], 'ae', NOW).fingerprint
    );
  });

  it('changes the fingerprint when a title changes', () => {
    const before = makeDocument('passport', { id: 'p1', expiryDate: inDays(300) });
    const after = { ...before, title: 'Amal’s passport' };

    expect(planReminders([before], 'ae', NOW).fingerprint).not.toBe(
      planReminders([after], 'ae', NOW).fingerprint
    );
  });

  it('does not change the fingerprint when the list is merely reordered', () => {
    const a = makeDocument('passport', { id: 'a', expiryDate: inDays(300) });
    const b = makeDocument('emirates-id', { id: 'b', expiryDate: inDays(300) });

    expect(planReminders([a, b], 'ae', NOW).fingerprint).toBe(
      planReminders([b, a], 'ae', NOW).fingerprint
    );
  });
});

describe('snoozeDate', () => {
  it('lands the requested number of days out, on a local calendar day', () => {
    expect(snoozeDate(7, new Date(2026, 0, 28))).toBe('2026-02-04');
  });
});

describe('leadLabel', () => {
  /*
   * The picker read "1 day, 3, 7, 14, 30, 60, 90, 180 days": units on the
   * first and the last, and six bare integers in between. Three grammars in
   * one control.
   */
  it('says every option in the same grammar', () => {
    expect([1, 3, 7, 14, 30, 60, 90, 180].map(leadLabel)).toEqual([
      '1 day',
      '3 days',
      '1 week',
      '2 weeks',
      '1 month',
      '2 months',
      '3 months',
      '6 months',
    ]);
  });

  /* Seven days is a week to everybody who is not a computer. */
  it('prefers the unit a person would actually use', () => {
    expect(leadLabel(7)).toBe('1 week');
    expect(leadLabel(30)).toBe('1 month');
  });

  /* The driving licence default warns at 45, which is neither. */
  it('falls back to days when nothing divides cleanly', () => {
    expect(leadLabel(45)).toBe('45 days');
    expect(leadLabel(10)).toBe('10 days');
  });

  it('never says "1 days"', () => {
    for (const days of [1, 3, 7, 14, 30, 45, 60, 90, 180]) {
      expect(leadLabel(days)).not.toMatch(/\b1 (days|weeks|months)\b/);
    }
  });
});

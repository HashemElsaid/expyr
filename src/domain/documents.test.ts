import { describe, expect, it } from 'vitest';

import {
  expiryVerb,
  isSubscription,
  migrateDocument,
  rollForward,
  rollForwardAll,
} from '@/domain/documents';
import { makeDocument } from '@/test/factories';

/**
 * Reading an old record is the operation with no second chance: get it wrong
 * and somebody's documents are gone on the launch after an update. Every older
 * shape the app has ever written is represented here on purpose.
 */

describe('migrateDocument', () => {
  it('keeps a current record exactly as it is', () => {
    const doc = makeDocument('passport');
    expect(migrateDocument(doc)).toEqual(doc);
  });

  it('rejects anything that is not a document', () => {
    for (const value of [null, undefined, 42, 'x', {}, { id: 'a' }, { id: 'a', typeId: 'passport' }]) {
      expect(migrateDocument(value)).toBeNull();
    }
  });

  it('carries forward the single imageUri from before PDFs existed', () => {
    const old = {
      id: 'a',
      typeId: 'passport',
      expiryDate: '2027-01-01',
      imageUri: 'file:///photos/a.jpg',
    };

    expect(migrateDocument(old)?.files).toEqual([
      { uri: 'file:///photos/a.jpg', type: 'image', key: 'legacy' },
    ]);
  });

  it('carries forward the single fileUri from before multiple attachments', () => {
    const old = {
      id: 'a',
      typeId: 'tenancy-ejari',
      expiryDate: '2027-01-01',
      fileUri: 'file:///docs/a.pdf',
      fileType: 'pdf',
    };

    expect(migrateDocument(old)?.files).toEqual([
      { uri: 'file:///docs/a.pdf', type: 'pdf', key: 'legacy' },
    ]);
  });

  it('falls back rather than vanishing when a category is retired', () => {
    const orphan = { id: 'a', typeId: 'no-such-category', expiryDate: '2027-01-01' };
    expect(migrateDocument(orphan)?.typeId).toBe('other');
  });

  it('gives a record with no lead days the ones its category expects', () => {
    const bare = { id: 'a', typeId: 'emirates-id', expiryDate: '2027-01-01' };
    expect(migrateDocument(bare)?.leadDays).toEqual([30, 14, 7]);
  });

  it('treats a record with no updatedAt as unchanged since it was made', () => {
    const old = {
      id: 'a',
      typeId: 'passport',
      expiryDate: '2027-01-01',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    expect(migrateDocument(old)?.updatedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('starts anything without a visibility private', () => {
    const old = { id: 'a', typeId: 'passport', expiryDate: '2027-01-01' };
    expect(migrateDocument(old)?.visibility).toBe('private');
  });

  it('does not lose an outstanding snooze', () => {
    const doc = makeDocument('passport', { snoozedUntil: '2026-09-20' });
    expect(migrateDocument(doc)?.snoozedUntil).toBe('2026-09-20');
  });
});

describe('isSubscription', () => {
  it('is about money leaving on a cycle, not about the category', () => {
    const gym = makeDocument('other', { renewsEvery: 'yearly' });
    expect(isSubscription(gym)).toBe(true);
  });

  it('leaves a document that merely expires on the other side', () => {
    expect(isSubscription(makeDocument('passport'))).toBe(false);
    expect(isSubscription(makeDocument('residence-visa'))).toBe(false);
    expect(isSubscription(makeDocument('tenancy-ejari'))).toBe(false);
  });

  /*
   * Records written before the app asked how often a thing recurs have no
   * renewsEvery at all. Without the fallback a person's Netflix would quietly
   * appear under Documents after an update.
   */
  it('still recognises a membership saved before recurrence existed', () => {
    expect(isSubscription(makeDocument('membership'))).toBe(true);
  });

  it('does not need a whole document to answer', () => {
    expect(isSubscription({ typeId: 'passport', renewsEvery: 'monthly' })).toBe(true);
  });
});

describe('rollForward', () => {
  const TODAY = new Date(2026, 8, 5);

  it('leaves anything that does not renew itself alone, expired or not', () => {
    const visa = makeDocument('residence-visa', { expiryDate: '2026-01-01' });
    // A visa waits for you. Moving its date would hide the very thing to warn about.
    expect(rollForward(visa, TODAY)).toBe(visa);
  });

  it('leaves an archived subscription alone', () => {
    const cancelled = makeDocument('membership', {
      expiryDate: '2026-01-01',
      renewsEvery: 'monthly',
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(rollForward(cancelled, TODAY)).toBe(cancelled);
  });

  it('returns the very same object when nothing moved', () => {
    const future = makeDocument('membership', {
      expiryDate: '2026-12-01',
      renewsEvery: 'monthly',
    });
    expect(rollForward(future, TODAY)).toBe(future);
  });

  it('moves a passed charge to the next one and records the ones behind it', () => {
    const netflix = makeDocument('membership', {
      expiryDate: '2026-06-15',
      renewsEvery: 'monthly',
    });

    const rolled = rollForward(netflix, TODAY);
    expect(rolled.expiryDate).toBe('2026-09-15');
    expect(rolled.history).toEqual(['2026-06-15', '2026-07-15', '2026-08-15']);
  });

  it('appends to a history that already had something in it', () => {
    const netflix = makeDocument('membership', {
      expiryDate: '2026-08-15',
      renewsEvery: 'monthly',
      history: ['2026-07-15'],
    });

    expect(rollForward(netflix, TODAY).history).toEqual(['2026-07-15', '2026-08-15']);
  });

  it('keeps the day of the month across a February', () => {
    const doc = makeDocument('membership', {
      expiryDate: '2026-01-31',
      renewsEvery: 'monthly',
    });

    expect(rollForward(doc, new Date(2026, 3, 10)).expiryDate).toBe('2026-04-30');
  });
});

describe('rollForwardAll', () => {
  const TODAY = new Date(2026, 8, 5);

  it('returns the same array when nothing needed moving, so nothing is rewritten', () => {
    const docs = [makeDocument('passport'), makeDocument('emirates-id')];
    expect(rollForwardAll(docs, TODAY)).toBe(docs);
  });

  it('returns a new array when anything moved', () => {
    const docs = [
      makeDocument('passport'),
      makeDocument('membership', { expiryDate: '2026-06-15', renewsEvery: 'monthly' }),
    ];

    const next = rollForwardAll(docs, TODAY);
    expect(next).not.toBe(docs);
    expect(next[0]).toBe(docs[0]);
    expect(next[1].expiryDate).toBe('2026-09-15');
  });
});

/**
 * The wording shipped wrong once: the notification builder had its own copy of
 * this choice, so a banner and the screen it opened could describe the same
 * subscription in contradictory terms. These pin the two callers to one answer.
 */
describe('expiryVerb', () => {
  it('says a document expires', () => {
    expect(expiryVerb(makeDocument('passport'))).toBe('expires');
  });

  it('says a document expired, in the past', () => {
    expect(expiryVerb(makeDocument('passport'), true)).toBe('expired');
  });

  it('says a subscription charges you, because it does not expire', () => {
    const netflix = { ...makeDocument('membership'), renewsEvery: 'month' as const };
    expect(expiryVerb(netflix)).toBe('charges you');
    expect(expiryVerb(netflix, true)).toBe('charged you');
  });

  /*
   * The bug that made this function necessary. The notification builder keyed
   * on renewsEvery alone, so a record written before the app asked how often a
   * thing recurs said "expires" in the banner and showed cancellation guidance
   * on the screen behind it.
   */
  it('treats a membership with no period as a subscription, like isSubscription does', () => {
    const legacy = makeDocument('membership');
    expect(isSubscription(legacy)).toBe(true);
    expect(expiryVerb(legacy)).toBe('charges you');
  });

  it('defaults to the future tense', () => {
    expect(expiryVerb(makeDocument('passport'))).toBe(expiryVerb(makeDocument('passport'), false));
  });
});

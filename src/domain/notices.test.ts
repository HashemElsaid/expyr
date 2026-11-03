import { describe, expect, it } from 'vitest';

import { checkInFor, trialsEnding } from '@/domain/notices';
import { inDays, makeDocument } from '@/test/factories';

const history = (n: number) => Array.from({ length: n }, (_, i) => `2026-0${(i % 9) + 1}-01`);

describe('trialsEnding', () => {
  it('lists trials charging within two weeks, soonest first', () => {
    const subs = [
      makeDocument('membership', { title: 'Later', trial: true, expiryDate: inDays(10) }),
      makeDocument('membership', { title: 'Soon', trial: true, expiryDate: inDays(2) }),
      makeDocument('membership', { title: 'Far', trial: true, expiryDate: inDays(40) }),
      makeDocument('membership', { title: 'Paid', expiryDate: inDays(1) }),
    ];
    expect(trialsEnding(subs).map((doc) => doc.title)).toEqual(['Soon', 'Later']);
  });
});

describe('checkInFor', () => {
  const today = new Date(2026, 10, 3);

  it('picks the most expensive that has renewed itself six times', () => {
    const subs = [
      makeDocument('membership', {
        title: 'Gym',
        history: history(6),
        price: { amount: 300, currency: 'AED', every: 'monthly' },
      }),
      makeDocument('membership', {
        title: 'Music',
        history: history(8),
        price: { amount: 20, currency: 'AED', every: 'monthly' },
      }),
      makeDocument('membership', { title: 'New', history: history(2) }),
    ];
    expect(checkInFor(subs, today)?.title).toBe('Gym');
  });

  it('stays away for a year after an answer', () => {
    const gym = makeDocument('membership', { history: history(6), checkedInAt: '2026-06-01' });
    expect(checkInFor([gym], today)).toBeNull();
    expect(checkInFor([{ ...gym, checkedInAt: '2025-10-01' }], today)).not.toBeNull();
  });

  it('never asks about one still in a trial', () => {
    expect(checkInFor([makeDocument('membership', { history: history(9), trial: true })], today)).toBeNull();
  });
});

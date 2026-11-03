import { describe, expect, it } from 'vitest';

import { grandfatheredPicks, moveReminder, remindedSubscriptions } from '@/domain/reminder-allowance';
import { makeDocument } from '@/test/factories';

function sub(id: string, monthly: number | null, extra: object = {}) {
  return makeDocument('membership', {
    id,
    renewsEvery: 'monthly',
    ...(monthly === null ? {} : { price: { amount: monthly, currency: 'AED', every: 'monthly' } }),
    ...extra,
  });
}

const seven = [
  sub('netflix', 56),
  sub('gym', 300),
  sub('shahid', 30),
  sub('du', 400),
  sub('spotify', 22),
  sub('icloud', 11),
  sub('unpriced', null),
];

describe('remindedSubscriptions', () => {
  it('reminds a paid account about every one', () => {
    expect(remindedSubscriptions(seven, null, true, 2).size).toBe(7);
  });

  it('gives a free account the two most expensive by default', () => {
    expect([...remindedSubscriptions(seven, null, false, 2)].sort()).toEqual(['du', 'gym']);
  });

  it('honours the ones the person picked', () => {
    expect([...remindedSubscriptions(seven, ['spotify', 'icloud'], false, 2)].sort()).toEqual([
      'icloud',
      'spotify',
    ]);
  });

  it('fills a slot left empty with the most expensive of the rest', () => {
    expect([...remindedSubscriptions(seven, ['spotify'], false, 2)].sort()).toEqual([
      'du',
      'spotify',
    ]);
  });

  it('frees the slot of a pick that has gone', () => {
    const left = seven.filter((doc) => doc.id !== 'spotify');
    expect([...remindedSubscriptions(left, ['spotify', 'icloud'], false, 2)].sort()).toEqual([
      'du',
      'icloud',
    ]);
  });

  it('does not count an archived subscription', () => {
    const archived = seven.map((doc) =>
      doc.id === 'du' ? { ...doc, archivedAt: '2026-11-01T00:00:00Z' } : doc
    );
    expect(remindedSubscriptions(archived, null, false, 2).has('du')).toBe(false);
  });

  it('keeps every reminder a free account had before the rule', () => {
    const picks = grandfatheredPicks(seven.slice(0, 4), 2);
    expect(remindedSubscriptions(seven, picks, false, 2).size).toBe(4);
  });
});

describe('grandfatheredPicks', () => {
  it('keeps them all when there were more than the allowance', () => {
    expect(grandfatheredPicks(seven, 2)).toHaveLength(7);
  });

  it('stores nothing when everything already fits', () => {
    expect(grandfatheredPicks(seven.slice(0, 2), 2)).toEqual([]);
  });
});

describe('moveReminder', () => {
  it('moves one reminder and keeps the other', () => {
    const reminded = new Set(['du', 'gym']);
    expect(moveReminder(reminded, 'gym', 'netflix').sort()).toEqual(['du', 'netflix']);
  });
});

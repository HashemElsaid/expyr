import { describe, expect, it } from 'vitest';

import { chargeAmount, chargesByMonth, dueWithin } from '@/domain/year';
import { toISODate } from '@/lib/dates';
import { inDays, makeDocument } from '@/test/factories';

const today = new Date(2026, 10, 3); // 3 November 2026

function sub(expiryDate: string, amount: number, every: 'monthly' | 'quarterly' | 'yearly', currency = 'USD') {
  return makeDocument('membership', {
    expiryDate,
    renewsEvery: every,
    price: { amount, currency, every },
  });
}

describe('chargeAmount', () => {
  it('is the price when it is quoted per charge', () => {
    expect(chargeAmount(sub('2026-11-10', 20, 'monthly'))).toBe(20);
  });

  it('converts a price quoted per month into a yearly charge', () => {
    const doc = makeDocument('membership', {
      renewsEvery: 'yearly',
      price: { amount: 10, currency: 'USD', every: 'monthly' },
    });
    expect(chargeAmount(doc)).toBe(120);
  });

  it('is nothing without a price or a cadence', () => {
    expect(chargeAmount(makeDocument('membership'))).toBe(0);
  });
});

describe('chargesByMonth', () => {
  it('starts with this month and covers twelve', () => {
    const months = chargesByMonth([], 'USD', today);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 10, amount: 0 });
    expect(months[11]).toEqual({ year: 2027, month: 9, amount: 0 });
  });

  it('puts a monthly charge in every month', () => {
    const months = chargesByMonth([sub('2026-11-20', 15, 'monthly')], 'USD', today);
    expect(months.every((m) => m.amount === 15)).toBe(true);
  });

  it('shows a yearly renewal as one spike in the month it lands', () => {
    const months = chargesByMonth([sub('2027-03-04', 415, 'yearly')], 'USD', today);
    expect(months[4].amount).toBe(415);
    expect(months.filter((m) => m.amount > 0)).toHaveLength(1);
  });

  it('leaves out another currency rather than converting it', () => {
    const months = chargesByMonth([sub('2026-11-20', 50, 'monthly', 'AED')], 'USD', today);
    expect(months.every((m) => m.amount === 0)).toBe(true);
  });

  it('leaves out anything archived', () => {
    const doc = { ...sub('2026-11-20', 15, 'monthly'), archivedAt: toISODate(today) };
    expect(chargesByMonth([doc], 'USD', today).every((m) => m.amount === 0)).toBe(true);
  });
});

describe('dueWithin', () => {
  it('counts every currency but sums only the one asked for', () => {
    const due = dueWithin(
      [sub(inDays(3), 20, 'monthly'), sub(inDays(10), 50, 'monthly', 'AED'), sub(inDays(40), 9, 'monthly')],
      'USD'
    );
    expect(due).toEqual({ count: 2, amount: 20 });
  });

  it('includes a charge due today', () => {
    expect(dueWithin([sub(inDays(0), 12, 'monthly')], 'USD').count).toBe(1);
  });
});

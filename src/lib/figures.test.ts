import { describe, expect, it } from 'vitest';

import { money, shortMoney, timeLeft, timeLeftParts, wholeMoney } from '@/lib/figures';

describe('timeLeft', () => {
  it('says today, then days, months and years', () => {
    expect(timeLeft(0)).toBe('Today');
    expect(timeLeft(1)).toBe('1 day');
    expect(timeLeft(12)).toBe('12 days');
    expect(timeLeft(59)).toBe('59 days');
    expect(timeLeft(129)).toBe('4 months');
    expect(timeLeft(1715)).toBe('5 years');
  });

  it('says lateness as lateness', () => {
    expect(timeLeft(-1)).toBe('1 day late');
    expect(timeLeft(-4)).toBe('4 days late');
  });
});

describe('timeLeftParts', () => {
  it('splits the figure from its unit', () => {
    expect(timeLeftParts(3)).toEqual({ value: '3', unit: 'days' });
    expect(timeLeftParts(-4)).toEqual({ value: '4', unit: 'days late' });
    expect(timeLeftParts(0)).toEqual({ value: 'Today', unit: '' });
  });
});

describe('money', () => {
  it('keeps cents only when there are some', () => {
    expect(money(240)).toBe('240');
    expect(money(24.99)).toBe('24.99');
    expect(money(19.9)).toBe('19.90');
    expect(money(1250)).toBe('1,250');
  });

  it('does not show floating point dust', () => {
    expect(money(0.1 + 0.2)).toBe('0.30');
    expect(money(239.88000000001)).toBe('239.88');
  });
});

describe('shortMoney', () => {
  it('uses the symbol for dollars and drops the cents', () => {
    expect(shortMoney(1049.6, 'USD')).toBe('$1,050');
  });

  it('keeps the amount whatever the currency', () => {
    expect(shortMoney(1050, 'AED')).toMatch(/1,050/);
  });

  it('falls back to the code for a currency it does not know', () => {
    expect(shortMoney(12, 'NOT-A-CODE')).toBe('NOT-A-CODE 12');
  });
});

describe('wholeMoney', () => {
  it('rounds to whole units with separators', () => {
    expect(wholeMoney(16534.6)).toBe('16,535');
  });
});

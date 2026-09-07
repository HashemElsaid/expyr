import { describe, expect, it } from 'vitest';

import { saysItsOwnType } from '@/domain/timeline';

describe('when a row should not repeat its own type', () => {
  it('catches a difference of one capital', () => {
    expect(saysItsOwnType('Health insurance', 'Health Insurance')).toBe(true);
  });

  it('catches the two spellings of licence', () => {
    expect(saysItsOwnType('UAE Driving Licence', 'Driving License')).toBe(true);
    expect(saysItsOwnType('Driving License', 'Driving Licence')).toBe(true);
  });

  it('catches a title that adds a word in front', () => {
    expect(saysItsOwnType('My Car Insurance', 'Car Insurance')).toBe(true);
  });

  /*
   * One-directional on purpose. "Mulkiya" under "Car Registration (Mulkiya)"
   * keeps its subtitle, because there the label says something the title does
   * not.
   */
  it('keeps the label when the label is the one adding something', () => {
    expect(saysItsOwnType('Mulkiya', 'Car Registration (Mulkiya)')).toBe(false);
  });

  it('keeps the label for a title that says nothing about its type', () => {
    expect(saysItsOwnType('Claude Max', 'Subscription / Membership')).toBe(false);
    expect(saysItsOwnType("Reem's card", 'Emirates ID')).toBe(false);
  });

  it('is not fooled by empty text', () => {
    expect(saysItsOwnType('', 'Passport')).toBe(false);
    expect(saysItsOwnType('Passport', '')).toBe(false);
  });
});

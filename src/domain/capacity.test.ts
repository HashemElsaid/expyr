import { describe, expect, it } from 'vitest';

import { roomFor, splitImport } from '@/domain/capacity';

const FREE = 5;

describe('room under the ceiling', () => {
  it('counts what is left on the free plan', () => {
    expect(roomFor({ tracked: 2, limit: FREE, premium: false })).toBe(3);
  });

  it('is nothing once the plan is full', () => {
    expect(roomFor({ tracked: 5, limit: FREE, premium: false })).toBe(0);
  });

  /*
   * An account can be over the ceiling: it bought Pro, added twenty items and
   * then asked for a refund. Reporting negative room would let a caller add
   * items by subtraction.
   */
  it('never reports negative room for an account already over it', () => {
    expect(roomFor({ tracked: 20, limit: FREE, premium: false })).toBe(0);
  });

  it('is unbounded for somebody who has paid', () => {
    expect(roomFor({ tracked: 400, limit: FREE, premium: true })).toBe(Infinity);
  });
});

describe('a batch that does not fit', () => {
  /*
   * The case from the launch list, and the bug this was written for: two
   * items already tracked and six subscriptions read off a screenshot. Three
   * of them fit. The import used to write all six and say nothing.
   */
  it('takes what fits and reports the rest', () => {
    const room = roomFor({ tracked: 2, limit: FREE, premium: false });
    expect(splitImport(6, room)).toEqual({ take: 3, blocked: 3 });
  });

  it('takes everything when everything fits', () => {
    const room = roomFor({ tracked: 1, limit: FREE, premium: false });
    expect(splitImport(3, room)).toEqual({ take: 3, blocked: 0 });
  });

  it('takes nothing, and says so, when the plan is already full', () => {
    expect(splitImport(4, 0)).toEqual({ take: 0, blocked: 4 });
  });

  it('takes the lot for somebody who has paid', () => {
    const room = roomFor({ tracked: 60, limit: FREE, premium: true });
    expect(splitImport(9, room)).toEqual({ take: 9, blocked: 0 });
  });

  it('has nothing to do with an empty selection', () => {
    expect(splitImport(0, 3)).toEqual({ take: 0, blocked: 0 });
  });

  /* Neither half of the answer may exceed the batch it came from. */
  it('never adds up to more than was asked for', () => {
    for (const chosen of [0, 1, 5, 9]) {
      for (const room of [0, 1, 3, 100, Infinity]) {
        const { take, blocked } = splitImport(chosen, room);
        expect(take + blocked).toBe(chosen);
        expect(take).toBeLessThanOrEqual(chosen);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';

import { buildHousehold, MINE, personSummary } from '@/domain/household';
import { inDays, makeDocument } from '@/test/factories';

describe('buildHousehold', () => {
  it('always has a row for the phone’s owner, even with nothing filed', () => {
    const people = buildHousehold([]);
    expect(people).toHaveLength(1);
    expect(people[0].label).toBe('Mine');
    expect(people[0].empty).toBe(true);
  });

  it('groups a document under whoever owns it', () => {
    const mine = makeDocument('passport');
    const hers = makeDocument('passport', { owner: 'Amal' });

    const people = buildHousehold([mine, hers]);
    expect(people.map((p) => p.label).sort()).toEqual(['Amal', 'Mine']);
  });

  it('treats a blank owner as the phone’s owner', () => {
    const people = buildHousehold([makeDocument('passport', { owner: '' })]);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe(MINE);
  });

  /*
   * The whole reason this exists. A relative you have not filed anything for is
   * the largest gap on a page whose job is telling you what is missing, and
   * before this there was nowhere to put them.
   */
  it('includes somebody added by name who owns nothing yet', () => {
    const people = buildHousehold([], ['Ali']);
    expect(people.map((p) => p.label)).toContain('Ali');
    expect(people.find((p) => p.label === 'Ali')?.empty).toBe(true);
  });

  it('does not list somebody twice for being both named and an owner', () => {
    const people = buildHousehold([makeDocument('passport', { owner: 'Ali' })], ['ali', 'ALI ']);
    expect(people.filter((p) => p.label.toLowerCase() === 'ali')).toHaveLength(1);
  });

  it('ignores a name that is only whitespace', () => {
    expect(buildHousehold([], ['   '])).toHaveLength(1);
  });

  it('counts what is due within a month as needing attention', () => {
    const person = buildHousehold([
      makeDocument('passport', { expiryDate: inDays(10) }),
      makeDocument('passport', { expiryDate: inDays(-5) }),
      makeDocument('passport', { expiryDate: inDays(400) }),
    ])[0];

    expect(person.urgent).toBe(2);
  });

  it('sorts each person’s own items soonest first', () => {
    const person = buildHousehold([
      makeDocument('passport', { expiryDate: inDays(300) }),
      makeDocument('emirates-id', { expiryDate: inDays(10) }),
    ])[0];

    expect(person.items[0].typeId).toBe('emirates-id');
  });

  it('puts whoever needs attention soonest first', () => {
    const people = buildHousehold([
      makeDocument('passport', { expiryDate: inDays(900) }),
      makeDocument('passport', { owner: 'Ali', expiryDate: inDays(3) }),
    ]);

    expect(people[0].label).toBe('Ali');
  });

  it('puts somebody with nothing filed after somebody who has something', () => {
    const people = buildHousehold(
      [makeDocument('passport', { owner: 'Ali', expiryDate: inDays(900) })],
      ['Zara']
    );

    // Mine is empty too, but always leads.
    expect(people.map((p) => p.label)).toEqual(['Mine', 'Ali', 'Zara']);
  });
});

describe('personSummary', () => {
  const person = (over: Partial<ReturnType<typeof buildHousehold>[number]>) => ({
    name: 'x',
    label: 'x',
    items: [],
    urgent: 0,
    empty: false,
    ...over,
  });

  it('says so plainly when there is nothing filed', () => {
    expect(personSummary(person({ empty: true }))).toBe('Nothing tracked yet');
  });

  it('says so plainly when there is nothing to do', () => {
    expect(personSummary(person({ urgent: 0 }))).toBe('All clear');
  });

  it('counts, and gets the verb right for one', () => {
    expect(personSummary(person({ urgent: 1 }))).toBe('1 needs you');
    expect(personSummary(person({ urgent: 3 }))).toBe('3 need you');
  });
});

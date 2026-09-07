import { describe, expect, it } from 'vitest';

import {
  buildHousehold,
  MINE,
  nameFromDevice,
  personSummary,
  personVerdict,
} from '@/domain/household';
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

describe('nameFromDevice', () => {
  it('takes the name off a phone named the way iOS suggests', () => {
    expect(nameFromDevice("Hashem's iPhone")).toBe('Hashem');
    expect(nameFromDevice('Reem’s iPad Pro')).toBe('Reem');
    expect(nameFromDevice("Abu Bakr's iPhone 15")).toBe('Abu Bakr');
  });

  /*
   * A wrong name on somebody's own card is worse than no name, so anything that
   * does not clearly parse falls through to nothing rather than to a guess.
   */
  it('gives up rather than guessing', () => {
    for (const device of ['iPhone', "Hashem's Mac mini", 'iPhone de Hashem', 'Work Phone 2', '']) {
      expect(nameFromDevice(device), device).toBe('');
    }
  });

  it('copes with the name being missing entirely', () => {
    expect(nameFromDevice(undefined)).toBe('');
    expect(nameFromDevice(null)).toBe('');
  });

  it('refuses something too long to be a first name', () => {
    expect(nameFromDevice(`${'x'.repeat(60)}'s iPhone`)).toBe('');
  });
});

describe('knowing whose phone it is', () => {
  /*
   * The bug on the screen: somebody typed their own name into "Whose is it",
   * and the household showed them twice — an empty card for the blank owner
   * beside a full one under their name.
   */
  it('does not put somebody on the page twice for naming themselves', () => {
    const people = buildHousehold(
      [
        makeDocument('passport', { owner: 'Hashim' }),
        makeDocument('emirates-id', { owner: '' }),
      ],
      [],
      'Hashim'
    );

    expect(people).toHaveLength(1);
    expect(people[0].label).toBe('Hashim');
    expect(people[0].items).toHaveLength(2);
  });

  it('matches their own name however it was capitalised', () => {
    const people = buildHousehold([makeDocument('passport', { owner: 'hashim ' })], [], 'Hashim');
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe(MINE);
  });

  it('labels their card with their name instead of "Mine"', () => {
    expect(buildHousehold([], [], 'Hashim')[0].label).toBe('Hashim');
  });

  it('still says "Mine" before the name is known', () => {
    expect(buildHousehold([], [])[0].label).toBe('Mine');
  });

  it('does not fold anybody else into them', () => {
    const people = buildHousehold([makeDocument('passport', { owner: 'Reem' })], [], 'Hashim');
    expect(people.map((p) => p.label).sort()).toEqual(['Hashim', 'Reem']);
  });

  it('ignores their own name appearing in the added list too', () => {
    const people = buildHousehold([], ['Hashim', 'Reem'], 'Hashim');
    expect(people.map((p) => p.label).sort()).toEqual(['Hashim', 'Reem']);
  });
});

describe('personSummary', () => {
  const person = (over: Partial<ReturnType<typeof buildHousehold>[number]>) => ({
    name: 'x',
    label: 'x',
    items: [],
    urgent: 0,
    empty: false,
    unnamed: false,
    ...over,
  });

  it('says so plainly when there is nothing filed', () => {
    expect(personSummary(person({ empty: true }))).toBe('Nothing tracked yet');
  });

  /*
   * "All clear" claimed more than this function checks. It was printed
   * directly above a warning triangle saying the Emirates ID has to be renewed
   * before the licence — the card contradicting itself in two adjacent lines.
   */
  it('claims only what it checked, which is dates', () => {
    expect(personSummary(person({ urgent: 0 }))).toBe('Nothing due soon');
  });

  /*
   * The card that produced two of somebody on one screen: an empty "Mine"
   * beside a full card with their own name on it, and nothing saying the app
   * was waiting to be told they are the same person.
   */
  it('asks an unnamed own-card for a name', () => {
    expect(personSummary(person({ unnamed: true, empty: true }))).toBe('Tap to add your name');
  });

  it('does not ask while something needs attention', () => {
    expect(personSummary(person({ unnamed: true, urgent: 2 }))).toBe('2 due soon');
  });

  /* "N need you" read as a plea with the request missing: need you to do what? */
  it('states how many rather than asking for help', () => {
    expect(personSummary(person({ urgent: 1 }))).toBe('1 due soon');
    expect(personSummary(person({ urgent: 3 }))).toBe('3 due soon');
  });

  /*
   * The passport four days over that announced itself as "1 due soon".
   * Anything expired is also urgent, so the count was right and the word was
   * wrong on the one item whose deadline has already gone.
   */
  it('calls something already past expired, not due', () => {
    const gone = [makeDocument('passport', { expiryDate: inDays(-4) })];
    expect(personSummary(person({ items: gone, urgent: 1 }))).toBe('1 expired');
  });

  it('says both when both are true', () => {
    const items = [
      makeDocument('passport', { expiryDate: inDays(-4) }),
      makeDocument('emirates-id', { expiryDate: inDays(-1) }),
      makeDocument('residence-visa', { expiryDate: inDays(6) }),
    ];
    expect(personSummary(person({ items, urgent: 3 }))).toBe('2 expired, 1 due');
  });

  /* Today is not over. */
  it('does not count today as expired', () => {
    const today = [makeDocument('passport', { expiryDate: inDays(0) })];
    expect(personSummary(person({ items: today, urgent: 1 }))).toBe('1 due soon');
  });
});

describe('personVerdict', () => {
  const person = (over: Partial<ReturnType<typeof buildHousehold>[number]>) => ({
    name: 'x',
    label: 'x',
    items: [],
    urgent: 0,
    empty: false,
    unnamed: false,
    ...over,
  });

  /*
   * The page was rendering personSummary with a full stop on the end, which is
   * a string written for a tile a third of the screen wide. A display face
   * spells small numbers out, which is the rule the home masthead follows and
   * this screen was breaking beside it.
   */
  it('spells the number out, the way the masthead does', () => {
    const gone = [makeDocument('passport', { expiryDate: inDays(-4) })];
    expect(personVerdict(person({ items: gone, urgent: 1 }))).toBe('One expired.');
    expect(personVerdict(person({ urgent: 3 }))).toBe('Three due soon.');
  });

  /*
   * "All clear." was printed directly above the list of everything missing
   * from somebody's file.
   */
  it('claims only what it checked', () => {
    expect(personVerdict(person({ urgent: 0 }))).toBe('Nothing due soon.');
  });

  it('says nothing yet when there is nothing filed', () => {
    expect(personVerdict(person({ empty: true }))).toBe('Nothing yet.');
  });

  /* Expired wins outright, as it does on the home screen. */
  it('does not flatten what is expired into what is merely due', () => {
    const items = [
      makeDocument('passport', { expiryDate: inDays(-4) }),
      makeDocument('emirates-id', { expiryDate: inDays(6) }),
      makeDocument('residence-visa', { expiryDate: inDays(9) }),
    ];
    expect(personVerdict(person({ items, urgent: 3 }))).toBe('One expired.');
  });
});

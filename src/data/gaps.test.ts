import { describe, expect, it } from 'vitest';
import { inSentence } from '@/data/document-types';

import { findGaps, gapSummary } from '@/data/gaps';
import { findBlockers } from '@/data/prerequisites';
import { inDays, makeDocument } from '@/test/factories';

/**
 * These rules decide what Household tells somebody about their own paperwork,
 * and getting one wrong means either a false alarm about a visa or silence
 * about a real one. Both are worse than the app saying nothing at all.
 */

describe('findBlockers', () => {
  it('spots a passport that will be short of six months at visa renewal', () => {
    const visa = makeDocument('residence-visa', { expiryDate: inDays(200) });
    // Valid for longer than the visa, and still not enough: the rule wants the
    // passport to outlast the visa by 180 days.
    const passport = makeDocument('passport', { expiryDate: inDays(300) });

    const blockers = findBlockers(visa, [visa, passport]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].rule.requires).toBe('passport');
  });

  it('says nothing when the passport clears the buffer', () => {
    const visa = makeDocument('residence-visa', { expiryDate: inDays(200) });
    const passport = makeDocument('passport', { expiryDate: inDays(400) });

    expect(findBlockers(visa, [visa, passport])).toHaveLength(0);
  });

  /*
   * The household case. Two people's passports and visas are in one list, and
   * pairing a wife's visa with a husband's passport would produce a warning
   * about a document that has nothing to do with it.
   */
  it('never pairs one person’s document with another person’s', () => {
    const hers = makeDocument('residence-visa', { owner: 'Amal', expiryDate: inDays(200) });
    const hisPassport = makeDocument('passport', { owner: 'Hashem', expiryDate: inDays(210) });

    expect(findBlockers(hers, [hers, hisPassport])).toHaveLength(0);
  });

  it('treats a blank owner as the phone’s owner, consistently', () => {
    const visa = makeDocument('residence-visa', { expiryDate: inDays(200) });
    const passport = makeDocument('passport', { owner: '', expiryDate: inDays(210) });

    expect(findBlockers(visa, [visa, passport])).toHaveLength(1);
  });

  it('reports nothing when the prerequisite is not tracked at all', () => {
    const visa = makeDocument('residence-visa', { expiryDate: inDays(200) });
    expect(findBlockers(visa, [visa])).toHaveLength(0);
  });
});

describe('findGaps', () => {
  it('reports a conflict between two dates that each look fine alone', () => {
    const visa = makeDocument('residence-visa', { expiryDate: inDays(200) });
    const passport = makeDocument('passport', { expiryDate: inDays(300) });
    const eid = makeDocument('emirates-id');
    const health = makeDocument('health-insurance');

    const gaps = findGaps([visa, passport, eid, health], 'ae');
    expect(gaps.some((g) => g.severity === 'blocked')).toBe(true);
  });

  it('names a prerequisite that is not tracked at all', () => {
    const licence = makeDocument('driving-license');
    const gaps = findGaps([licence], 'ae');

    const missing = gaps.filter((g) => g.severity === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].text).toContain('cannot be renewed without one');
  });

  it('does not list a document twice when a rule already named it', () => {
    const licence = makeDocument('driving-license');
    const gaps = findGaps([licence], 'ae');

    // The Emirates ID is the driving licence's prerequisite, so it is explained
    // once as `missing` and must not reappear in the flat "Not tracked" line.
    const untracked = gaps.find((g) => g.severity === 'untracked');
    expect(untracked?.text).not.toContain('Emirates ID');
  });

  /*
   * The rules were verified against UAE sources only. Telling somebody in Cairo
   * which papers a resident holds would be a confident guess, which is the one
   * thing this app refuses to do.
   */
  it('stays quiet about ordinary papers outside the countries with guidance', () => {
    const passport = makeDocument('passport');
    const gaps = findGaps([passport], 'eg');

    expect(gaps.some((g) => g.severity === 'untracked')).toBe(false);
  });

  it('says nothing at all about an empty file', () => {
    expect(findGaps([], 'ae')).toEqual([
      { severity: 'untracked', text: expect.stringContaining('Not tracked') },
    ]);
  });

  it('is silent when a UAE resident tracks the full set', () => {
    const complete = [
      makeDocument('passport', { expiryDate: inDays(1200) }),
      makeDocument('residence-visa', { expiryDate: inDays(400) }),
      makeDocument('emirates-id', { expiryDate: inDays(400) }),
      makeDocument('health-insurance', { expiryDate: inDays(500) }),
    ];

    expect(findGaps(complete, 'ae')).toEqual([]);
  });
});

describe('gapSummary', () => {
  it('leads with the most serious thing there is to say', () => {
    const gaps = [
      { severity: 'untracked' as const, text: 'c' },
      { severity: 'blocked' as const, text: 'a' },
      { severity: 'missing' as const, text: 'b' },
    ];
    expect(gapSummary(gaps)?.text).toBe('a');
  });

  it('returns nothing when there is nothing to say', () => {
    expect(gapSummary([])).toBeUndefined();
  });
});

describe('how a document type reads inside a sentence', () => {
  it('lowercases ordinary words', () => {
    expect(inSentence('Passport')).toBe('passport');
    expect(inSentence('Car Insurance')).toBe('car insurance');
  });

  /*
   * The bug. Lowercasing everything turned "Emirates ID" into "emirates id"
   * and "UAE Driving Licence" into "uae driving licence" on the household
   * page, which is the kind of thing that makes an app look unfinished.
   */
  it('leaves an initialism alone', () => {
    expect(inSentence('Emirates ID')).toBe('Emirates ID');
    expect(inSentence('UAE Driving Licence')).toBe('UAE Driving Licence');
  });

  it('copes with an empty label', () => {
    expect(inSentence('')).toBe('');
  });
});

/**
 * The app is sold outside the UAE. Somebody in London or Texas must never be
 * told about an Emirates ID, a Mulkiya or an Ejari, because being described a
 * country you do not live in is how an app stops being believed about the
 * parts that are true.
 *
 * The document labels adapt on their own — emirates-id reads "National ID"
 * elsewhere — but these warnings are written sentences naming the RTA and the
 * ICP, and a sentence cannot be translated into a rule nobody checked.
 */
describe('outside the countries whose rules have been checked', () => {
  const licence = makeDocument('driving-license', { expiryDate: '2027-01-01' });
  const car = makeDocument('car-registration', { expiryDate: '2027-01-01' });
  const visa = makeDocument('residence-visa', { expiryDate: '2027-01-01' });

  it.each([null, 'us', 'gb', 'eg', 'in'] as const)('says nothing at all in %s', (country) => {
    expect(findGaps([licence, car, visa], country as never)).toEqual([]);
  });

  it('never names an Emirates ID to somebody who does not have one', () => {
    for (const country of [null, 'us', 'gb'] as const) {
      const text = findGaps([licence, car, visa], country as never)
        .map((g) => g.text)
        .join(' ');
      expect(text).not.toMatch(/Emirates ID|Mulkiya|Ejari|RTA|ICP|emirate/i);
    }
  });

  /* And it still does its job where the rules were verified. */
  it('still warns in the UAE', () => {
    expect(findGaps([licence, car, visa], 'ae').length).toBeGreaterThan(0);
  });
});

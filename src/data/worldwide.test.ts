import { describe, expect, it } from 'vitest';

import { hasGuidance } from '@/data/countries';
import { DOCUMENT_TYPES, labelFor, numberFieldFor } from '@/data/document-types';

/**
 * Nothing local reaches somebody who is not here.
 *
 * Expyr was built in and for the UAE, and shipping it worldwide means every
 * one of those assumptions is now a bug waiting for the right user. They are
 * not findable by reading: "Trade / Freelance License" is a perfectly ordinary
 * phrase until you notice no American has ever held one, and "Mulkiya" is
 * obvious only because it looks foreign.
 *
 * So this asserts the property rather than the instances. A new document type
 * with a UAE word in its label fails here on the day it is added, rather than
 * on the day somebody in Toronto opens the picker.
 *
 * The UAE labels themselves are untouched and should be: somebody in Dubai
 * wants to read "Mulkiya", because that is the word printed on the thing in
 * their glovebox.
 */

/** Words and phrasings that only mean something in one country. */
const LOCAL_TO_THE_UAE: (string | RegExp)[] = [
  'emirates',
  'emirati',
  'mulkiya',
  'ejari',
  'uae',
  'dubai',
  'abu dhabi',
  'sharjah',
  'ajman',
  'fujairah',
  'rta',
  'gdrfa',
  'tasjeel',
  'dirham',
  'aed',
  /*
   * Not a place, but a UAE way of naming the licence to run a business.
   * Everywhere else it is a business licence, and this is the one that got
   * through: the type had no generic label at all.
   *
   * A pattern rather than a phrase, and the self-check below is why. The label
   * was "Trade / Freelance License", which does not contain the substring
   * "trade license", so a plain string would have missed the single bug this
   * whole file exists to catch.
   */
  /trade[^a-z]*(freelance[^a-z]*)?licen[cs]e/,
];

/** How the app addresses somebody outside the UAE. */
const ELSEWHERE = 'us' as const;

function offendingWord(text: string): string | undefined {
  const haystack = text.toLowerCase();
  const hit = LOCAL_TO_THE_UAE.find((word) =>
    typeof word === 'string' ? haystack.includes(word) : word.test(haystack)
  );
  return hit === undefined ? undefined : String(hit);
}

describe('what somebody outside the UAE is shown', () => {
  it('names no document in a word that is local to the UAE', () => {
    for (const type of DOCUMENT_TYPES) {
      const label = labelFor(type, ELSEWHERE);
      expect(
        offendingWord(label),
        `"${label}" reaches everyone on earth. Give ${type.id} a genericLabel.`
      ).toBeUndefined();
    }
  });

  it('asks for no document number by a name local to the UAE', () => {
    for (const type of DOCUMENT_TYPES) {
      const field = numberFieldFor(type, ELSEWHERE);
      if (!field) continue;
      for (const text of [field.label, field.placeholder]) {
        expect(
          offendingWord(text),
          `"${text}" on ${type.id} reaches everyone. Give it a genericNumberField.`
        ).toBeUndefined();
      }
    }
  });

  /*
   * The other half of the same rule. Somebody in Dubai should read the word
   * printed on the thing in their glovebox, so the local labels stay local and
   * a well-meaning tidy-up that genericises them fails here.
   */
  it('still uses the local words inside the UAE', () => {
    const byId = Object.fromEntries(DOCUMENT_TYPES.map((type) => [type.id, type]));
    expect(labelFor(byId['car-registration'], 'ae')).toContain('Mulkiya');
    expect(labelFor(byId['emirates-id'], 'ae')).toBe('Emirates ID');
    expect(labelFor(byId['tenancy-ejari'], 'ae')).toContain('Ejari');
  });

  /* Proves the scanner can see one, so a broken matcher cannot pass as clean. */
  it('would notice a UAE word if one came back', () => {
    expect(offendingWord('Emirates ID')).toBe('emirates');
    expect(offendingWord('Car Registration (Mulkiya)')).toBe('mulkiya');
    // The one a plain substring missed, which is why the list takes patterns.
    expect(offendingWord('Trade / Freelance License')).toBeDefined();
    expect(offendingWord('Trade Licence')).toBeDefined();
    // And the labels that should pass, so the matcher is not simply greedy.
    expect(offendingWord("Driver's License")).toBeUndefined();
    expect(offendingWord('Business License')).toBeUndefined();
    expect(offendingWord('Trademark')).toBeUndefined();
  });
});

describe('the guidance gate', () => {
  /*
   * The verified-versus-generated distinction is the thing that stops AI
   * guidance reading as authoritative, and shipping worldwide is exactly the
   * pressure that would tempt somebody to widen this list to be welcoming.
   * A country belongs here when its steps, fees and fines have been checked
   * against that country's own authorities, and never before.
   */
  it('claims verified guidance only where it has been written', () => {
    expect(hasGuidance('ae')).toBe(true);
    for (const country of ['us', 'gb', 'in', 'ca', 'au', 'sa', 'eg', 'other'] as const) {
      expect(hasGuidance(country), `${country} has no verified guides`).toBe(false);
    }
  });

  it('claims nothing when no country has been chosen', () => {
    expect(hasGuidance(null)).toBe(false);
  });
});

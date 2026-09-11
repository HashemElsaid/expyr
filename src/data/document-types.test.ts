import { describe, expect, it } from 'vitest';

import { articleFor, DOCUMENT_TYPES, getDocumentType, labelFor } from '@/data/document-types';

const VOWELS = ['a', 'e', 'i', 'o', 'u'];

/*
 * The scan now asks "This looks like a passport. Is that right?", so every
 * label has to be able to sit in that sentence. The first draft picked the
 * article by testing for the letter e, which was right for the one label that
 * needed it and wrong for the rest.
 */
describe('the article in front of a category', () => {
  it('puts "an" in front of the one label that needs it', () => {
    expect(articleFor('Emirates ID')).toBe('an');
  });

  it('puts "a" in front of an ordinary one', () => {
    expect(articleFor('Passport')).toBe('a');
    expect(articleFor('Driving Licence')).toBe('a');
  });

  it('is right for every label in the catalogue, in both namings', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const label of [labelFor(type, 'ae'), labelFor(type, 'pk')]) {
        const expected = VOWELS.includes(label.charAt(0).toLowerCase()) ? 'an' : 'a';
        expect(articleFor(label), label).toBe(expected);
      }
    }
  });

  it('is not thrown by leading space or an empty label', () => {
    expect(articleFor('  Emirates ID')).toBe('an');
    expect(articleFor('')).toBe('a');
  });
});

describe('the catalogue itself', () => {
  /*
   * The display order is a separate list from the catalogue, so a category
   * added to one and not the other sorts by indexOf(-1) and silently lands
   * first. The residence visa is documented as the top of the list, so a type
   * missing from the order shows up here as having taken its place.
   */
  it('still leads with the thing most people came for', () => {
    expect(DOCUMENT_TYPES[0].id).toBe('residence-visa');
  });

  it('gives every category a name and at least one reminder', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(type.label.trim(), type.id).not.toBe('');
      expect(type.defaultLeadDays.length, type.id).toBeGreaterThan(0);
      expect(type.defaultLeadDays.every((d) => d > 0), type.id).toBe(true);
    }
  });

  it('finds a category by id, and falls back rather than throwing', () => {
    expect(getDocumentType('bill').label).toBe('Bill');
    // @ts-expect-error deliberately not a category, which is what a stale record holds
    expect(getDocumentType('nothing-like-this').id).toBe('other');
  });
});

import { describe, expect, it } from 'vitest';

import { getDocumentType } from '@/data/document-types';
import {
  fromGenerated,
  orEmpty,
  fromVerified,
  primarySource,
  provenanceFor,
  provenanceNote,
  worthShowing,
  type DisplayGuidance,
} from '@/domain/renewal-guidance';
import type { Guidance } from '@/lib/guidance';

/**
 * The claims here are the honest ones this feature turns on: a generated answer
 * is never presented as a verified one, an answer with no sources is never
 * called well-grounded, and an empty answer is not given a heading.
 */

const generated = (over: Partial<Guidance> = {}): Guidance => ({
  summary: 'Renewed online through the state portal.',
  where: 'Department of Motor Vehicles',
  steps: ['Sign in to the portal', 'Pay the fee'],
  typicalCost: '$45',
  lateFee: '$10 after 30 days',
  processingTime: 'About a week',
  needed: ['Proof of address'],
  standing: 'good',
  sources: [{ title: 'DMV renewals', url: 'https://dmv.ca.gov/renew', official: true }],
  checkedOn: '2026-09-06',
  ...over,
});

describe('provenanceFor', () => {
  it('uses the checked guides where there are checked guides', () => {
    expect(provenanceFor('ae')).toBe('verified');
  });

  it('generates everywhere else, rather than saying nothing', () => {
    expect(provenanceFor('us')).toBe('generated');
    expect(provenanceFor('eg')).toBe('generated');
  });

  it('generates when the country is not known yet', () => {
    expect(provenanceFor(null)).toBe('generated');
  });
});

describe('fromVerified', () => {
  it('carries the checked guide through as it is', () => {
    const type = getDocumentType('emirates-id');
    const shown = fromVerified(type, 'A typing centre');

    expect(shown.provenance).toBe('verified');
    expect(shown.standing).toBe('good');
    expect(shown.steps).toEqual(type.guide.steps);
    expect(shown.where).toBe('A typing centre');
  });

  it('claims no sources, because it is not quoting a page', () => {
    expect(fromVerified(getDocumentType('passport'), '').sources).toEqual([]);
  });
});

describe('fromGenerated', () => {
  it('keeps what the search established', () => {
    const shown = fromGenerated(generated());
    expect(shown.provenance).toBe('generated');
    expect(shown.steps).toHaveLength(2);
    expect(shown.checkedOn).toBe('2026-09-06');
  });

  /*
   * The check that matters. Guidance with nothing behind it is a guess with a
   * citation-shaped hole, whatever the model thought of its own work — so the
   * app decides, not the answer.
   */
  it('calls an answer with no sources thin, whatever it claimed', () => {
    const shown = fromGenerated(generated({ standing: 'good', sources: [] }));
    expect(shown.standing).toBe('thin');
  });

  it('leaves a well-sourced answer alone', () => {
    expect(fromGenerated(generated()).standing).toBe('good');
  });

  it('does not invent a figure the search did not establish', () => {
    const shown = fromGenerated(generated({ typicalCost: '', lateFee: '' }));
    expect(shown.typicalCost).toBe('');
    expect(shown.lateFee).toBe('');
  });
});

describe('orEmpty', () => {
  /*
   * The prompt asks for an empty string when the search established nothing,
   * and mostly gets one — but Ireland came back with typicalCost: "not
   * established", which the screen then drew as a Cost row reading "not
   * established". That is precisely the row the empty string exists to
   * suppress. Prompts drift; this does not.
   */
  it('treats every way of saying nothing as nothing', () => {
    for (const value of [
      'not established',
      'Not established.',
      'not stated',
      'NOT SPECIFIED',
      'not available',
      'unknown',
      'n/a',
      'N/A',
      'none',
      'TBD',
      '--',
      '   ',
    ]) {
      expect(orEmpty(value), value).toBe('');
    }
  });

  it('leaves a real answer alone, including one that mentions none', () => {
    expect(orEmpty('AED 300')).toBe('AED 300');
    expect(orEmpty('No late fee is charged')).toBe('No late fee is charged');
    expect(orEmpty('  $45  ')).toBe('$45');
  });

  it('does not blank a fee that happens to contain a listed word', () => {
    expect(orEmpty('Free, but not available online')).toBe('Free, but not available online');
  });
});

describe('a field the search could not establish', () => {
  it('is emptied on the way in, whatever the model wrote', () => {
    const shown = fromGenerated(
      generated({ typicalCost: 'not established', processingTime: 'n/a' })
    );
    expect(shown.typicalCost).toBe('');
    expect(shown.processingTime).toBe('');
  });
});

describe('worthShowing', () => {
  it('shows an answer that established something', () => {
    expect(worthShowing(fromGenerated(generated()))).toBe(true);
  });

  it('does not put a heading over an empty box', () => {
    const empty = fromGenerated(
      generated({ steps: [], needed: [], where: '', typicalCost: '', sources: [] })
    );
    expect(worthShowing(empty)).toBe(false);
  });

  it('shows an answer that has only the authority', () => {
    const sparse = fromGenerated(
      generated({ steps: [], needed: [], typicalCost: '', where: 'The county clerk' })
    );
    expect(worthShowing(sparse)).toBe(true);
  });
});

describe('provenanceNote', () => {
  it('never lets a generated answer read as an official one', () => {
    const note = provenanceNote(fromGenerated(generated()));
    expect(note).toMatch(/not supplied by the authority/i);
    expect(note).toMatch(/check/i);
  });

  it('says so more loudly when the search found little', () => {
    const thin = fromGenerated(generated({ sources: [] }));
    expect(provenanceNote(thin)).toMatch(/starting point/i);
  });

  it('says something different about a checked guide', () => {
    const note = provenanceNote(fromVerified(getDocumentType('passport'), ''));
    expect(note).toMatch(/checked against the responsible authority/i);
  });

  it('always tells the reader to check, whatever the source', () => {
    const all: DisplayGuidance[] = [
      fromVerified(getDocumentType('passport'), ''),
      fromGenerated(generated()),
      fromGenerated(generated({ sources: [] })),
    ];
    for (const shown of all) expect(provenanceNote(shown).toLowerCase()).toContain('check');
  });
});

describe('primarySource', () => {
  it('prefers the authority over the commentary', () => {
    const shown = fromGenerated(
      generated({
        sources: [
          { title: 'A relocation blog', url: 'https://blog.example/visa', official: false },
          { title: 'ICP', url: 'https://icp.gov.ae/visa', official: true },
        ],
      })
    );
    expect(primarySource(shown)?.url).toBe('https://icp.gov.ae/visa');
  });

  it('falls back to whatever there is', () => {
    const shown = fromGenerated(
      generated({
        sources: [{ title: 'A blog', url: 'https://blog.example', official: false }],
      })
    );
    expect(primarySource(shown)?.url).toBe('https://blog.example');
  });

  it('returns nothing when there is nothing, rather than throwing', () => {
    expect(primarySource(fromGenerated(generated({ sources: [] })))).toBeUndefined();
  });
});

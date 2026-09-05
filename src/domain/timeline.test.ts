import { describe, expect, it } from 'vitest';

import { buildSections } from '@/domain/timeline';
import { inDays, makeDocument } from '@/test/factories';

describe('buildSections', () => {
  it('says nothing about an empty file', () => {
    expect(buildSections([])).toEqual([]);
  });

  it('groups by calendar month, earliest first', () => {
    const sections = buildSections([
      makeDocument('passport', { expiryDate: '2027-03-05' }),
      makeDocument('emirates-id', { expiryDate: '2026-12-01' }),
      makeDocument('car-insurance', { expiryDate: '2027-03-28' }),
    ]);

    expect(sections.map((s) => s.title)).toEqual(['December 2026', 'March 2027']);
    expect(sections[1].data).toHaveLength(2);
  });

  it('sorts within a month by date', () => {
    const sections = buildSections([
      makeDocument('passport', { expiryDate: '2027-03-28' }),
      makeDocument('emirates-id', { expiryDate: '2027-03-05' }),
    ]);
    expect(sections[0].data.map((d) => d.expiryDate)).toEqual(['2027-03-05', '2027-03-28']);
  });

  /*
   * The part worth having a test for. Filed by month, something that lapsed in
   * August sits under "August 2026" — above today, looking as settled as a
   * tenancy that ends next year. It is not history; it is the only thing on the
   * screen that cannot wait.
   */
  it('lifts anything overdue out of the calendar and pins it on top', () => {
    const sections = buildSections([
      makeDocument('passport', { expiryDate: inDays(400) }),
      makeDocument('emirates-id', { expiryDate: inDays(-30) }),
    ]);

    expect(sections[0].title).toBe('Overdue');
    expect(sections[0].data).toHaveLength(1);
    expect(sections).toHaveLength(2);
  });

  it('has no Overdue heading when nothing is', () => {
    const sections = buildSections([makeDocument('passport', { expiryDate: inDays(90) })]);
    expect(sections.map((s) => s.title)).not.toContain('Overdue');
  });

  it('keeps two years apart that share a month name', () => {
    const sections = buildSections([
      makeDocument('passport', { expiryDate: '2027-03-05' }),
      makeDocument('emirates-id', { expiryDate: '2028-03-05' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['March 2027', 'March 2028']);
  });

  it('does not modify the array it was given', () => {
    const docs = [
      makeDocument('passport', { expiryDate: '2028-01-01' }),
      makeDocument('emirates-id', { expiryDate: '2026-01-01' }),
    ];
    const before = docs.map((d) => d.id);
    buildSections(docs);
    expect(docs.map((d) => d.id)).toEqual(before);
  });
});

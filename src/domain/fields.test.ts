import { describe, expect, it } from 'vitest';

import {
  displayFields,
  fieldColumns,
  firstOfKind,
  searchableText,
  tidyFields,
  valueForColumn,
} from '@/domain/fields';
import { makeDocument } from '@/test/factories';
import type { ExtractedField } from '@/types';

const field = (
  label: string,
  value: string,
  kind: ExtractedField['kind'] = 'other'
): ExtractedField => ({ label, value, kind });

describe('tidyFields', () => {
  it('copes with a scan that returned nothing', () => {
    expect(tidyFields(undefined)).toEqual([]);
    expect(tidyFields([])).toEqual([]);
  });

  /*
   * The rule the whole file exists to keep. Somebody is going to copy an
   * Emirates ID number out of this app and paste it into a government form, so
   * a helpfully reformatted number is a wrong number.
   */
  it('never rewrites a value', () => {
    const raw = [
      field('Emirates ID', '784-1990-1234567-1', 'number'),
      field('Annual rent', 'AED 4,500 / year', 'money'),
      field('Issued', '03/09/2026', 'date'),
    ];
    expect(tidyFields(raw).map((f) => f.value)).toEqual([
      '784-1990-1234567-1',
      'AED 4,500 / year',
      '03/09/2026',
    ]);
  });

  it('collapses whitespace, because that came from the transcription', () => {
    expect(tidyFields([field('  Full   name ', ' Amal   Hassan ')])[0]).toEqual({
      label: 'Full name',
      value: 'Amal Hassan',
      kind: 'other',
    });
  });

  it('drops a field with no value, rather than showing an empty row', () => {
    expect(tidyFields([field('Policy number', '   ')])).toEqual([]);
  });

  it('drops a field with no label', () => {
    expect(tidyFields([field('', 'Amal Hassan')])).toEqual([]);
  });

  it('keeps the first of two labels that mean the same thing', () => {
    const raw = [field('Full name', 'Amal Hassan'), field('full  name', 'A. Hassan')];
    expect(tidyFields(raw)).toHaveLength(1);
    expect(tidyFields(raw)[0].value).toBe('Amal Hassan');
  });

  it('orders by what somebody looks for first', () => {
    const raw = [
      field('Issued in', 'Dubai', 'place'),
      field('Issue date', '01/01/2020', 'date'),
      field('Premium', 'AED 1,200', 'money'),
      field('Policy number', 'P-99', 'number'),
      field('Full name', 'Amal Hassan', 'name'),
    ];
    expect(tidyFields(raw).map((f) => f.kind)).toEqual([
      'name',
      'number',
      'money',
      'date',
      'place',
    ]);
  });

  it('keeps the reading order within one kind', () => {
    const raw = [
      field('Policy number', 'P-1', 'number'),
      field('Certificate number', 'C-2', 'number'),
    ];
    expect(tidyFields(raw).map((f) => f.value)).toEqual(['P-1', 'C-2']);
  });

  it('stops well short of transcribing a whole insurance schedule', () => {
    const raw = Array.from({ length: 60 }, (_, i) => field(`Field ${i}`, `Value ${i}`));
    expect(tidyFields(raw).length).toBeLessThanOrEqual(24);
  });

  it('truncates a value that is really a paragraph', () => {
    const long = 'x'.repeat(500);
    expect(tidyFields([field('Terms', long)])[0].value.length).toBeLessThanOrEqual(200);
  });

  it('defaults a missing kind rather than dropping the field', () => {
    const raw = [{ label: 'Something', value: 'Here' } as ExtractedField];
    expect(tidyFields(raw)[0].kind).toBe('other');
  });
});

describe('displayFields', () => {
  it('does not repeat what the screen already shows in its own row', () => {
    const doc = makeDocument('emirates-id', {
      title: 'Emirates ID',
      documentNumber: '784-1990-1234567-1',
      expiryDate: '2027-03-05',
      fields: [
        field('Emirates ID number', '784-1990-1234567-1', 'number'),
        field('Full name', 'Amal Hassan', 'name'),
      ],
    });

    expect(displayFields(doc).map((f) => f.label)).toEqual(['Full name']);
  });

  it('matches the number even when it is punctuated differently', () => {
    const doc = makeDocument('emirates-id', {
      documentNumber: '784 1990 1234567 1',
      fields: [field('ID number', '784-1990-1234567-1', 'number')],
    });
    expect(displayFields(doc)).toEqual([]);
  });

  it('says nothing at all about a document typed in by hand', () => {
    expect(displayFields(makeDocument('passport'))).toEqual([]);
  });
});

describe('firstOfKind', () => {
  it('finds the first field of a kind', () => {
    const doc = makeDocument('car-insurance', {
      fields: [field('Insurer', 'Salama', 'name'), field('Premium', 'AED 1,200', 'money')],
    });
    expect(firstOfKind(doc, 'money')?.value).toBe('AED 1,200');
  });

  it('returns nothing when there is none, rather than throwing', () => {
    expect(firstOfKind(makeDocument('passport'), 'money')).toBeUndefined();
  });
});

describe('searchableText', () => {
  /*
   * Most of the point of reading the fields at all: "Salama" should find the
   * insurance policy issued by Salama, even though nothing in its title says so.
   */
  it('matches a document by something only the scan knew', () => {
    const doc = makeDocument('car-insurance', {
      title: 'Car insurance',
      fields: [field('Insurer', 'Salama', 'name')],
    });
    expect(searchableText(doc)).toContain('salama');
  });

  it('still matches the things it always did', () => {
    const doc = makeDocument('passport', {
      title: 'Passport',
      owner: 'Amal',
      notes: 'renew before the trip',
      documentNumber: 'A1234567',
    });
    const text = searchableText(doc);
    for (const part of ['passport', 'amal', 'renew before', 'a1234567']) {
      expect(text).toContain(part);
    }
  });

  it('copes with a document that has almost nothing on it', () => {
    expect(() => searchableText(makeDocument('other'))).not.toThrow();
  });
});

describe('fieldColumns', () => {
  it('gives a spreadsheet one column per distinct label', () => {
    const docs = [
      makeDocument('car-insurance', {
        fields: [field('Insurer', 'Salama', 'name'), field('Premium', 'AED 1,200', 'money')],
      }),
      makeDocument('health-insurance', {
        fields: [field('Insurer', 'Daman', 'name'), field('Policy number', 'P-9', 'number')],
      }),
    ];

    expect(fieldColumns(docs)).toEqual(['Insurer', 'Policy number', 'Premium']);
  });

  it('treats labels differing only in case as one column', () => {
    const docs = [
      makeDocument('other', { fields: [field('Full name', 'A')] }),
      makeDocument('other', { fields: [field('FULL NAME', 'B')] }),
    ];
    expect(fieldColumns(docs)).toHaveLength(1);
  });

  it('has no columns for documents with no fields', () => {
    expect(fieldColumns([makeDocument('passport')])).toEqual([]);
  });
});

describe('valueForColumn', () => {
  it('finds the value however the label was capitalised', () => {
    const doc = makeDocument('other', { fields: [field('Full name', 'Amal Hassan')] });
    expect(valueForColumn(doc, 'FULL NAME')).toBe('Amal Hassan');
  });

  it('gives an empty cell rather than undefined', () => {
    expect(valueForColumn(makeDocument('passport'), 'Insurer')).toBe('');
  });
});

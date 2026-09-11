import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flatten, reconcileWithMrz, type Extraction } from './extract.ts';

/* ICAO's published specimen, whose check digits are known to be correct. */
const PASSPORT_MRZ = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

function scan(over: Partial<Extraction> = {}): Extraction {
  return {
    found: true,
    typeId: 'passport',
    title: 'Passport',
    expiryDate: '2012-04-15',
    documentNumber: 'L898902C3',
    confidence: 'high',
    typeConfidence: 'medium',
    mrz: PASSPORT_MRZ,
    note: 'Read the expiry date off the data page.',
    fields: [{ label: 'Full name', value: 'ANNA MARIA ERIKSSON', kind: 'name' }],
    ...over,
  };
}

/*
 * The scan that started this: a very clear passport whose printed name came
 * back as AEHED for HASHEM, with no way to correct it. The zone underneath is
 * the same name in a font designed to be read by a machine.
 */
test('a misread name is replaced by the one in the zone', () => {
  const fixed = reconcileWithMrz(
    scan({ fields: [{ label: 'Full name', value: 'ANNA MARJA ERIKSON', kind: 'name' }] })
  );
  assert.equal(fixed.fields[0].value, 'ANNA MARIA ERIKSSON');
  assert.match(fixed.note, /machine-readable strip/);
});

test('a name that already agrees is left exactly as it was', () => {
  const same = reconcileWithMrz(scan());
  assert.equal(same.fields[0].value, 'ANNA MARIA ERIKSSON');
  assert.equal(same.note, 'Read the expiry date off the data page.');
});

test('punctuation and case are not a disagreement', () => {
  const fixed = reconcileWithMrz(
    scan({ fields: [{ label: 'Full name', value: 'Anna-Maria  Eriksson', kind: 'name' }] })
  );
  assert.equal(fixed.note, 'Read the expiry date off the data page.');
});

test('a scan that read no name at all is given one', () => {
  const fixed = reconcileWithMrz(scan({ fields: [] }));
  assert.deepEqual(fixed.fields[0], {
    label: 'Full name',
    value: 'ANNA MARIA ERIKSSON',
    kind: 'name',
  });
});

/*
 * The most damaging mistake this app can make is reading 03/09/2027 as the
 * ninth of March. The zone writes it as 270903 and cannot be read any other
 * way, and that field is check-digit protected.
 */
test('the expiry comes from the zone when the two disagree', () => {
  const fixed = reconcileWithMrz(scan({ expiryDate: '2012-15-04' }));
  assert.equal(fixed.expiryDate, '2012-04-15');
  assert.match(fixed.note, /day and month/);
});

/*
 * The guard that matters most. A residence visa is usually photographed on the
 * page facing the passport data page, so the zone in the frame belongs to the
 * passport. Taking the visa's expiry from it would swap a correct date for a
 * real date off the wrong document.
 */
test('nothing is taken from a zone belonging to another document', () => {
  const visa = scan({ typeId: 'residence-visa', expiryDate: '2026-08-20' });
  const after = reconcileWithMrz(visa);
  assert.equal(after.expiryDate, '2026-08-20');
  assert.equal(after.typeConfidence, 'medium');
});

test('a zone whose check digits disagree is thrown away entirely', () => {
  const broken = scan({
    mrz: PASSPORT_MRZ.replace('1204159', '1204158'),
    expiryDate: '2012-04-15',
    fields: [{ label: 'Full name', value: 'WRONGLY READ', kind: 'name' }],
  });
  const after = reconcileWithMrz(broken);
  assert.equal(after.fields[0].value, 'WRONGLY READ');
  assert.equal(after.typeConfidence, 'medium');
});

test('no zone in the picture changes nothing', () => {
  const after = reconcileWithMrz(scan({ mrz: '' }));
  assert.equal(after.typeConfidence, 'medium');
});

/* A zone that checks out is the document saying what it is, so stop asking. */
test('a zone that checks out settles the category', () => {
  assert.equal(reconcileWithMrz(scan()).typeConfidence, 'high');
});

test('does not mistake a note field for the holder of the document', () => {
  const fixed = reconcileWithMrz(
    scan({
      fields: [
        { label: 'Issuing authority', value: 'MINISTRY OF THE INTERIOR', kind: 'name' },
        { label: 'Full name', value: 'ANNA MARJA ERIKSON', kind: 'name' },
      ],
    })
  );
  assert.equal(fixed.fields[0].value, 'MINISTRY OF THE INTERIOR');
  assert.equal(fixed.fields[1].value, 'ANNA MARIA ERIKSSON');
});

/**
 * 1.0.0 is live and reads these fields off the top level of the response.
 * Moving them inside `items` would break every copy of it on a phone.
 */
test('the first item stays where the shipped app looks for it', () => {
  const flat = flatten({ imageKind: 'documents', items: [scan(), scan({ title: 'Second' })] });
  assert.equal(flat.typeId, 'passport');
  assert.equal(flat.found, true);
  assert.equal(flat.items.length, 2);
  assert.equal(flat.imageKind, 'documents');
});

/*
 * The bug, from an old build's point of view. It used to be handed the first
 * subscription as a document and threw the rest away without saying so. Now it
 * is told nothing was found, and where to go instead.
 */
test('a subscriptions list tells an old build where the importer is', () => {
  const flat = flatten({ imageKind: 'subscriptions', items: [] });
  assert.equal(flat.found, false);
  assert.equal(flat.items.length, 0);
  assert.match(flat.note, /Subscriptions importer/);
});

test('an empty answer is an answer rather than a crash', () => {
  const flat = flatten({ imageKind: 'document', items: [] });
  assert.equal(flat.found, false);
  assert.equal(flat.typeId, 'other');
  assert.match(flat.note, /another photo/);
});

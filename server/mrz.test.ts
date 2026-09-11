import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkDigit, parseMrz } from './mrz.ts';

/*
 * ICAO's own specimens from Doc 9303, used because their check digits are
 * published as correct. Inventing a test MRZ means inventing its check digits
 * with the same code under test, which proves only that the code agrees with
 * itself.
 */
const TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

const TD1 = [
  'I<UTOD231458907<<<<<<<<<<<<<<<',
  '7408122F1204159UTO<<<<<<<<<<<6',
  'ERIKSSON<<ANNA<MARIA<<<<<<<<<<',
].join('\n');

test('the check digit is ICAO arithmetic and not ours', () => {
  // Worked by hand from the specimen: weights 7, 3, 1 and letters from A as 10.
  assert.equal(checkDigit('L898902C3'), 6);
  assert.equal(checkDigit('740812'), 2);
  assert.equal(checkDigit('120415'), 9);
  assert.equal(checkDigit('D23145890'), 7);
});

test('a filler counts as nothing and a stray character poisons the field', () => {
  assert.equal(checkDigit('<<<<<<'), 0);
  assert.equal(checkDigit('12 456'), -1);
});

test('a passport zone reads as a name, a number and a date', () => {
  const mrz = parseMrz(TD3);
  assert.ok(mrz);
  assert.equal(mrz.kind, 'td3');
  assert.equal(mrz.surname, 'ERIKSSON');
  assert.equal(mrz.given, 'ANNA MARIA');
  assert.equal(mrz.documentNumber, 'L898902C3');
  assert.equal(mrz.nationality, 'UTO');
  assert.equal(mrz.expiryDate, '2012-04-15');
  assert.equal(mrz.valid, true);
});

/* Given names first, which is the order somebody writes their own name. */
test('the full name reads the way a person would write it', () => {
  assert.equal(parseMrz(TD3)?.full, 'ANNA MARIA ERIKSSON');
});

test('an identity card zone reads the same way from three lines', () => {
  const mrz = parseMrz(TD1);
  assert.ok(mrz);
  assert.equal(mrz.kind, 'td1');
  assert.equal(mrz.full, 'ANNA MARIA ERIKSSON');
  assert.equal(mrz.documentNumber, 'D23145890');
  assert.equal(mrz.expiryDate, '2012-04-15');
  assert.equal(mrz.valid, true);
});

/*
 * The case this exists for. One character wrong in the date and the check
 * digit stops agreeing, which is the only signal available that the
 * transcription is not to be trusted, including the name beside it.
 */
test('a single mistyped character invalidates the whole zone', () => {
  const broken = TD3.replace('1204159', '1204158');
  const mrz = parseMrz(broken);
  assert.ok(mrz);
  assert.equal(mrz.valid, false);
});

test('a mistyped document number is caught as well', () => {
  const broken = TD3.replace('L898902C36', 'L898902C46');
  assert.equal(parseMrz(broken)?.valid, false);
});

/*
 * A zone missing a character has every field after it shifted by one, so a
 * name read out of it would be confident nonsense. Length is the cheapest
 * possible test for that, and the standard fixes both forms.
 */
test('refuses anything that is not exactly the right shape', () => {
  assert.equal(parseMrz(TD3.replace('<<<<<<<<<<<<<<<<<<<', '<<<<<<<<<<<<<<<<<<')), null);
  assert.equal(parseMrz(''), null);
  assert.equal(parseMrz('not an mrz at all'), null);
  assert.equal(parseMrz('one line only, of the wrong length entirely'), null);
});

test('reads a zone the model wrapped in spaces or lower case', () => {
  const messy = `  ${TD3.split('\n')[0].toLowerCase()}  \n\n ${TD3.split('\n')[1]} \n`;
  assert.equal(parseMrz(messy)?.full, 'ANNA MARIA ERIKSSON');
});

/*
 * A holder with one name is recorded as all surname and no given names, which
 * is common in the Gulf and must not come back as an empty string.
 */
test('a single name holder still has a name', () => {
  const single = [
    'P<AREALMARZOOQI<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
    'L898902C36ARE7408122F1204159ZE184226B<<<<<10',
  ].join('\n');
  const mrz = parseMrz(single);
  assert.equal(mrz?.surname, 'ALMARZOOQI');
  assert.equal(mrz?.given, '');
  assert.equal(mrz?.full, 'ALMARZOOQI');
});

test('a date the zone could not hold is left empty rather than guessed', () => {
  const impossible = TD3.replace('1204159', '1299159');
  const mrz = parseMrz(impossible);
  assert.equal(mrz?.expiryDate, '');
});

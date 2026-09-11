/**
 * The machine-readable zone, read by machine.
 *
 * A very clear passport scan came back with the name misspelled: AEHED for
 * HASHEM. The printed name on a data page is set in a typeface chosen to look
 * official, at whatever angle the phone was held, often over a watermark. The
 * MRZ underneath it is the same name in a monospaced font at fixed positions in
 * upper case with no diacritics, designed since 1980 to be read by a machine
 * pointed at it in bad light. So the model transcribes the MRZ and this file
 * takes the name out of it.
 *
 * One correction to how this was asked for, because it changes what can be
 * promised: the name in an MRZ is NOT check-digit protected. ICAO 9303 puts
 * check digits on the document number, the date of birth, the expiry, the
 * optional data and a composite over all of them. The name field has none.
 *
 * What the check digits still buy is evidence. They are read from the same
 * lines by the same model in the same pass, so when every one of them agrees
 * with the characters around it, that line was transcribed faithfully, and a
 * transcription that got four check digits right is not one that invented a
 * name. When any of them disagrees, nothing here is trusted at all.
 *
 * The expiry date is the one field that is both check-digit protected and the
 * thing this app exists for, and in the MRZ it is unambiguous: 260820 is the
 * twentieth of August 2026 and can be nothing else. The single most damaging
 * mistake this app can make is reading 03/09/2027 as the ninth of March, which
 * is a real risk everywhere in the Gulf and no risk at all here.
 */

export type MrzKind = 'td1' | 'td3';

export type Mrz = {
  kind: MrzKind;
  /** Surname, then given names, both as printed in the zone. */
  surname: string;
  given: string;
  /** Given names then surname, which is the order a person writes their own. */
  full: string;
  documentNumber: string;
  nationality: string;
  /** ISO, from the check-digit protected field. Empty when it did not parse. */
  expiryDate: string;
  /**
   * Whether every check digit present agreed with its field.
   *
   * The gate on using any of this. False means the transcription is wrong
   * somewhere, and a name from a line we know contains an error is worth less
   * than the printed name we were trying to improve on.
   */
  valid: boolean;
};

/**
 * ICAO's check digit: weights of 7, 3 and 1 repeating, letters counted from
 * A as 10, the filler counted as nothing, and the total taken modulo ten.
 */
export function checkDigit(field: string): number {
  const WEIGHTS = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < field.length; i += 1) {
    const char = field[i];
    let value: number;

    if (char >= '0' && char <= '9') value = char.charCodeAt(0) - 48;
    else if (char >= 'A' && char <= 'Z') value = char.charCodeAt(0) - 55;
    else if (char === '<') value = 0;
    // Anything else means this is not an MRZ line, and a number would be a lie.
    else return -1;

    sum += value * WEIGHTS[i % 3];
  }

  return sum % 10;
}

function agrees(field: string, digit: string): boolean {
  if (!/^[0-9]$/.test(digit)) return false;
  return checkDigit(field) === Number(digit);
}

/**
 * A name field into the two halves ICAO splits it into.
 *
 * The filler is a space and a double filler separates the surname from the
 * given names, so ERIKSSON<<ANNA<MARIA is Eriksson, Anna Maria. A zone with no
 * double filler is all surname, which is how a single-name holder is recorded.
 */
function readName(field: string): { surname: string; given: string } {
  const cleaned = field.replace(/<+$/, '');
  const [surname = '', given = ''] = cleaned.split('<<');
  const words = (part: string) => part.split('<').filter(Boolean).join(' ').trim();
  return { surname: words(surname), given: words(given) };
}

/** Six digits of YYMMDD to an ISO date. Expiry only, so the century is this one. */
function expiryToIso(yymmdd: string): string {
  if (!/^[0-9]{6}$/.test(yymmdd)) return '';
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = yymmdd.slice(2, 4);
  const day = yymmdd.slice(4, 6);
  if (Number(month) < 1 || Number(month) > 12) return '';
  if (Number(day) < 1 || Number(day) > 31) return '';
  return `${year}-${month}-${day}`;
}

/** Only the characters an MRZ can hold, so a stray space cannot shift a field. */
function lines(raw: string): string[] {
  return raw
    .toUpperCase()
    .split(/[\r\n]+/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length > 0);
}

/**
 * The passport form: two lines of 44. The name is on the first line, which
 * carries no check digit of its own, and every check digit is on the second.
 */
function parseTd3(raw: string[]): Mrz | null {
  const [first, second] = raw;
  if (first.length !== 44 || second.length !== 44) return null;
  if (first[0] !== 'P') return null;

  const { surname, given } = readName(first.slice(5));
  const documentNumber = second.slice(0, 9).replace(/<+$/, '');
  const expiry = second.slice(21, 27);

  const valid =
    agrees(second.slice(0, 9), second[9]) &&
    agrees(second.slice(13, 19), second[19]) &&
    agrees(expiry, second[27]) &&
    agrees(second.slice(28, 42), second[42]);

  return {
    kind: 'td3',
    surname,
    given,
    full: [given, surname].filter(Boolean).join(' '),
    documentNumber,
    nationality: second.slice(10, 13).replace(/<+$/, ''),
    expiryDate: expiryToIso(expiry),
    valid,
  };
}

/**
 * The card form: three lines of 30, which is an Emirates ID. The name is on
 * the third line and the check digits are spread across the first two.
 */
function parseTd1(raw: string[]): Mrz | null {
  const [first, second, third] = raw;
  if (first.length !== 30 || second.length !== 30 || third.length !== 30) return null;
  if (first[0] !== 'I' && first[0] !== 'A' && first[0] !== 'C') return null;

  const { surname, given } = readName(third);
  const documentNumber = first.slice(5, 14).replace(/<+$/, '');
  const expiry = second.slice(8, 14);

  const valid =
    agrees(first.slice(5, 14), first[14]) &&
    agrees(second.slice(0, 6), second[6]) &&
    agrees(expiry, second[14]);

  return {
    kind: 'td1',
    surname,
    given,
    full: [given, surname].filter(Boolean).join(' '),
    documentNumber,
    nationality: second.slice(15, 18).replace(/<+$/, ''),
    expiryDate: expiryToIso(expiry),
    valid,
  };
}

/**
 * Reads whatever the model transcribed, or null when it is not an MRZ.
 *
 * Null rather than a guess for anything that does not fit a form exactly,
 * because a zone with a character missing has every field after that point
 * shifted by one, and a name read out of a shifted field is confident
 * nonsense. Length is the cheapest test there is for that, and the forms are
 * fixed at 44 and 30 by standard.
 */
export function parseMrz(raw: string): Mrz | null {
  const found = lines(raw);
  if (found.length === 2) return parseTd3(found);
  if (found.length === 3) return parseTd1(found);
  return null;
}

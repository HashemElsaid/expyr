import type { ExtractedField, FieldKind, TrackedDocument } from '@/types';

/**
 * What a scan found, made fit to show.
 *
 * The model reads a document and reports what it says. That list arrives raw:
 * the same fact under two labels, the number the app already has its own place
 * for, an empty value where the print was illegible, and occasionally forty
 * entries off a dense insurance schedule. None of that is the model being
 * wrong — it is a transcription, and shaping a transcription for a screen is
 * this file's job rather than the prompt's.
 *
 * One rule runs through all of it: **a value is never rewritten.** Not
 * reformatted, not case-corrected, not currency-converted. A person is going to
 * copy an Emirates ID number out of this app and paste it into a government
 * form, and a helpfully normalised number is a wrong number.
 */

/** How many to keep. A dense insurance schedule can list forty. */
const MAX_FIELDS = 24;
/** Long enough for an address, short enough that nothing here is a paragraph. */
const MAX_VALUE_CHARS = 200;

/**
 * The order fields read in, which is roughly the order somebody looks for them:
 * who it is, what its number is, what it costs, when, where, then the rest.
 */
const KIND_ORDER: Record<FieldKind, number> = {
  name: 0,
  number: 1,
  money: 2,
  date: 3,
  place: 4,
  other: 5,
};

function tidy(value: string): string {
  // Collapsing runs of whitespace is the one change allowed: it comes from the
  // transcription, not from the document.
  return value.replace(/\s+/g, ' ').trim();
}

/** Two labels are the same label if only spacing, case or punctuation differ. */
function labelKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Cleans, drops and orders what the scan returned.
 *
 * Deliberately conservative about dropping: anything with a label and a value
 * survives unless it is a duplicate or empty. Deciding that a field is
 * uninteresting is the prompt's job, where a person can read the reasoning.
 */
export function tidyFields(raw: readonly ExtractedField[] | undefined): ExtractedField[] {
  if (!raw?.length) return [];

  const seenLabels = new Set<string>();
  const seenValues = new Set<string>();
  const kept: ExtractedField[] = [];

  for (const field of raw) {
    const label = tidy(field.label ?? '');
    const value = tidy(field.value ?? '').slice(0, MAX_VALUE_CHARS);
    if (!label || !value) continue;

    /*
     * The same fact twice under different names — "Name" and "Full name" — is
     * common, and so is the same label repeated for two lines of an address.
     * Either way the first wins, because the model reports them in the order
     * they appear and the first mention is usually the heading.
     */
    const byLabel = labelKey(label);
    const byValue = `${byLabel}:${valueKey(value)}`;
    if (seenLabels.has(byLabel) || seenValues.has(byValue)) continue;

    seenLabels.add(byLabel);
    seenValues.add(byValue);
    kept.push({ label, value, kind: field.kind ?? 'other' });

    if (kept.length >= MAX_FIELDS) break;
  }

  // A stable sort, so two fields of the same kind keep the order they were read.
  return kept
    .map((field, index) => ({ field, index }))
    .sort((a, b) => KIND_ORDER[a.field.kind] - KIND_ORDER[b.field.kind] || a.index - b.index)
    .map((entry) => entry.field);
}

/**
 * The fields worth showing beside a document, with the ones the app already has
 * a place of its own for removed.
 *
 * The number and the expiry date have their own rows on the detail screen, and
 * repeating them two inches lower makes the screen look like it is padding.
 */
export function displayFields(doc: TrackedDocument): ExtractedField[] {
  const own = new Set<string>();
  if (doc.documentNumber) own.add(valueKey(doc.documentNumber));
  if (doc.expiryDate) own.add(valueKey(doc.expiryDate));
  if (doc.title) own.add(valueKey(doc.title));

  return (doc.fields ?? []).filter((field) => !own.has(valueKey(field.value)));
}

/**
 * The first field of a kind, when one screen wants one particular fact.
 * Household wants the name; a subscription row wants the price.
 */
export function firstOfKind(
  doc: TrackedDocument,
  kind: FieldKind
): ExtractedField | undefined {
  return doc.fields?.find((field) => field.kind === kind);
}

/**
 * Everything about a document that a search should match, lowercased.
 *
 * Searching only titles was fine when a title was all a scan produced. Now that
 * a document knows its policy number and who issued it, "Salama" ought to find
 * the insurance policy issued by Salama even though nothing in its title says
 * so — which is most of the point of having read the fields at all.
 */
export function searchableText(doc: TrackedDocument): string {
  return [
    doc.title,
    doc.owner,
    doc.notes,
    doc.documentNumber,
    ...(doc.fields ?? []).flatMap((field) => [field.label, field.value]),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

/**
 * Every distinct field label across a set of documents, in the order the kinds
 * read. Used to give a spreadsheet export one column per label rather than one
 * unreadable cell holding everything.
 */
export function fieldColumns(documents: readonly TrackedDocument[]): string[] {
  const byLabel = new Map<string, { label: string; kind: FieldKind; first: number }>();

  documents.forEach((doc, index) => {
    for (const field of doc.fields ?? []) {
      const key = labelKey(field.label);
      if (!byLabel.has(key)) byLabel.set(key, { label: field.label, kind: field.kind, first: index });
    }
  });

  return [...byLabel.values()]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.first - b.first)
    .map((entry) => entry.label);
}

/** This document's value for a named column, or an empty string. */
export function valueForColumn(doc: TrackedDocument, label: string): string {
  const key = labelKey(label);
  return doc.fields?.find((field) => labelKey(field.label) === key)?.value ?? '';
}

import { hasGuidance, type Country } from '@/data/countries';
import { inSentence, labelForId } from '@/data/document-types';
import { findBlockers, PREREQUISITES } from '@/data/prerequisites';
import { DocumentTypeId, TrackedDocument } from '@/types';

/**
 * What is missing from somebody's file, rather than what is in it.
 *
 * A list of documents tells you what you already know. The useful question is
 * the other one: is anything about to stop something else from being renewed,
 * and is anything simply absent. Both are answerable from rules the app
 * already carries, and neither is answerable by looking at dates alone.
 *
 * The wording is careful about one distinction. Expyr cannot know what
 * somebody owns, only what they have told it about, so nothing here says a
 * person lacks a document. It says the document is not tracked, which is the
 * only thing that is actually true.
 */

/**
 * What almost every UAE resident holds, whatever their age or job. Deliberately
 * short: a driving licence, a car, a tenancy and a trade licence all depend on
 * circumstances, and guessing at those would produce nagging rather than help.
 * Health insurance is on the list because it has been mandatory in all seven
 * emirates since January 2025, and because a visa cannot be renewed without it.
 */
const EVERY_RESIDENT: DocumentTypeId[] = [
  'passport',
  'residence-visa',
  'emirates-id',
  'health-insurance',
];

export type Gap = {
  /** blocked: a verified rule is already failing. missing: a dependency is not
   * tracked at all. untracked: the ordinary papers of a resident, absent. */
  severity: 'blocked' | 'missing' | 'untracked';
  text: string;
};

export function findGaps(
  mine: TrackedDocument[],
  country: Country | null
): Gap[] {
  const gaps: Gap[] = [];
  const holds = (id: DocumentTypeId) => mine.some((doc) => doc.typeId === id);

  /*
   * Both documents are tracked and their dates already conflict — the passport
   * that will be four months short on the day the visa is renewed. This is the
   * one nobody sees coming, because both dates look perfectly fine alone.
   */
  for (const doc of mine) {
    for (const blocker of findBlockers(doc, mine)) {
      gaps.push({ severity: 'blocked', text: blocker.rule.warning });
    }
  }

  // Something that cannot be renewed on its own, with its requirement absent.
  const namedAlready = new Set<DocumentTypeId>();
  for (const rule of PREREQUISITES) {
    if (!holds(rule.dependent) || holds(rule.requires)) continue;
    namedAlready.add(rule.requires);
    gaps.push({
      severity: 'missing',
      text: `No ${inSentence(labelForId(rule.requires, country))} is tracked, and ${inSentence(
        labelForId(rule.dependent, country)
      )} cannot be renewed without one.`,
    });
  }

  /*
   * Only where the rules have been checked. Telling somebody in Cairo which
   * papers they ought to hold would be guessing, and guessing confidently is
   * the thing this app refuses to do.
   */
  if (hasGuidance(country)) {
    // Anything a rule above has already explained does not need listing twice.
    const absent = EVERY_RESIDENT.filter((id) => !holds(id) && !namedAlready.has(id)).map((id) =>
      labelForId(id, country)
    );
    if (absent.length > 0) {
      gaps.push({ severity: 'untracked', text: `Not tracked: ${absent.join(', ')}.` });
    }
  }

  // The same requirement can be named by two rules; say it once.
  return gaps.filter((gap, i) => gaps.findIndex((g) => g.text === gap.text) === i);
}

/** The single line that belongs under somebody's name. */
export function gapSummary(gaps: Gap[]): Gap | undefined {
  return (
    gaps.find((g) => g.severity === 'blocked') ??
    gaps.find((g) => g.severity === 'missing') ??
    gaps.find((g) => g.severity === 'untracked')
  );
}

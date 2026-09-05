import { hasGuidance, type Country } from '@/data/countries';
import type { Guidance, GuidanceSource } from '@/lib/guidance';
import type { DocumentType } from '@/types';

/**
 * Which renewal guidance a document gets, and what it is allowed to claim.
 *
 * Two sources, and the distinction between them is the whole point of this
 * file. The UAE guides in `data/document-types.ts` were checked one authority
 * at a time — every fee against the body that charges it, every fine against
 * the rule that imposes it. Everywhere else, the app asks its service to search
 * the live web and read the answer back.
 *
 * Those are not the same kind of thing and must never look like it. A verified
 * guide can be shown as what to do. A generated one is a starting point with
 * its sources attached, and the app says so plainly, every time, without the
 * screen having to remember to.
 *
 * The generated half does not replace the verified half where one exists.
 * Keeping the checked guides is not a scaling problem — thirteen types in one
 * country is a fixed cost already paid — and a search would be a downgrade
 * there, not an upgrade. Generation is how the other two hundred countries get
 * an answer at all.
 */

export type Provenance =
  /** Checked by hand against the responsible authority. */
  | 'verified'
  /** Found by searching, and labelled as something to check. */
  | 'generated';

/** One shape, so the screen draws guidance once rather than twice. */
export type DisplayGuidance = {
  provenance: Provenance;
  /**
   * How much this is worth relying on. `good` for anything verified, and for a
   * generated answer grounded in official pages; `thin` when the search found
   * little, which the app says more loudly.
   */
  standing: 'good' | 'thin';
  summary: string;
  where: string;
  steps: string[];
  needed: string[];
  typicalCost: string;
  lateFee: string;
  processingTime: string;
  sources: GuidanceSource[];
  /** ISO date a generated answer was produced. Empty for a verified one. */
  checkedOn: string;
};

/**
 * Whether this country has hand-checked guides, or needs one generating.
 *
 * A country with no guides is not a country the app refuses to help — it is
 * one where the help comes with its sources attached and a note to check.
 */
export function provenanceFor(country: Country | null): Provenance {
  return hasGuidance(country) ? 'verified' : 'generated';
}

/** The verified guide the app ships, in the shape the screen draws. */
export function fromVerified(type: DocumentType, where: string): DisplayGuidance {
  return {
    provenance: 'verified',
    standing: 'good',
    summary: '',
    where,
    steps: type.guide.steps,
    needed: [],
    typicalCost: type.guide.typicalCost,
    lateFee: type.guide.lateFee,
    processingTime: type.guide.processingTime,
    sources: [],
    checkedOn: '',
  };
}

/** A generated answer, in the same shape. */
export function fromGenerated(guidance: Guidance): DisplayGuidance {
  return {
    provenance: 'generated',
    /*
     * Guidance with no source behind it is a guess with a citation-shaped hole,
     * whatever the model thought of its own work. The service says the same
     * thing; both ends check, because this is the claim that matters.
     */
    standing: guidance.sources.length === 0 ? 'thin' : guidance.standing,
    summary: guidance.summary,
    where: guidance.where,
    steps: guidance.steps,
    needed: guidance.needed,
    typicalCost: guidance.typicalCost,
    lateFee: guidance.lateFee,
    processingTime: guidance.processingTime,
    sources: guidance.sources,
    checkedOn: guidance.checkedOn,
  };
}

/**
 * Whether there is enough here to be worth a screen at all.
 *
 * A generated answer that established no steps, no cost and no authority is a
 * heading over an empty box. Better to say nothing and leave the tracker half
 * of the screen — which is correct everywhere — to stand on its own.
 */
export function worthShowing(guidance: DisplayGuidance): boolean {
  return (
    guidance.steps.length > 0 ||
    guidance.needed.length > 0 ||
    guidance.where !== '' ||
    guidance.typicalCost !== ''
  );
}

/**
 * The line under the heading. Written here rather than in the screen because
 * it is the app's central honesty claim about this feature, and it should be
 * impossible to draw the guidance without it.
 */
export function provenanceNote(guidance: DisplayGuidance): string {
  if (guidance.provenance === 'verified') {
    return 'Checked against the responsible authority. Figures are indicative, so confirm before you pay.';
  }
  if (guidance.standing === 'thin') {
    return 'Expyr could not find much on this. Treat it as a starting point and check with the authority before relying on any of it.';
  }
  return 'Found by searching, not supplied by the authority. Check the sources below before you rely on it.';
}

/** The link most people want: the authority's own page, if the search found one. */
export function primarySource(guidance: DisplayGuidance): GuidanceSource | undefined {
  return guidance.sources.find((source) => source.official) ?? guidance.sources[0];
}

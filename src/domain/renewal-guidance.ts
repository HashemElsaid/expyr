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
 * Whether this document has a hand-checked guide, or needs one generating.
 *
 * The country is only half the question, and treating it as the whole of it
 * was a real bug: somebody in Dubai opening iCloud+ was shown the hand-written
 * guide for the "Subscription / Membership" category, which talks about giving
 * a UAE gym thirty days' written notice. Confidently, and with a line saying it
 * had been checked against the responsible authority.
 *
 * It had — but the authority checked was the one that renews visas and Emirates
 * IDs. Nobody verified how to cancel iCloud+ in the UAE, because there is
 * nothing jurisdictional to verify: how you cancel a subscription is a fact
 * about the service, and it is the same in Dubai as in Dublin.
 *
 * So a subscription is never "verified", wherever you are. It gets an answer
 * about the actual service instead.
 */
export function provenanceFor(
  country: Country | null,
  /** True for anything that charges you rather than lapsing — see isSubscription. */
  subscription = false
): Provenance {
  if (subscription) return 'generated';
  return hasGuidance(country) ? 'verified' : 'generated';
}

/**
 * A stable, bounded name for the service a subscription is with.
 *
 * The domain when the scan found one, because it is the least ambiguous thing
 * available — icloud.com is icloud.com however somebody has titled the row.
 * Otherwise a slug of the title, which is imperfect but is what a person typed.
 *
 * Bounded on purpose: this becomes part of a cache key, and an unbounded key is
 * an unbounded number of web searches.
 */
export function serviceKey(title: string, iconDomain?: string): string {
  const source = iconDomain?.trim() || title.trim();
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
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

/**
 * What a model writes when it means "the search did not say".
 *
 * The service normalises this too, and doing it again here is not belt and
 * braces for its own sake: guidance is cached for ninety days, so entries
 * written before the service learned this are still being served. An empty
 * field is drawn as nothing; a field reading "not established" is drawn as a
 * fact, which is the opposite of what the empty string is for.
 */
const MEANS_NOTHING =
  /^(not |un)?(established|stated|specified|available|known|found|listed|determined|provided|applicable|disclosed)\.?$|^(n\/?a|unknown|none|tbd|-{1,3})\.?$/i;

export function orEmpty(value: string): string {
  const trimmed = (value ?? '').trim();
  return MEANS_NOTHING.test(trimmed) ? '' : trimmed;
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
    summary: orEmpty(guidance.summary),
    where: orEmpty(guidance.where),
    steps: guidance.steps,
    needed: guidance.needed,
    typicalCost: orEmpty(guidance.typicalCost),
    lateFee: orEmpty(guidance.lateFee),
    processingTime: orEmpty(guidance.processingTime),
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

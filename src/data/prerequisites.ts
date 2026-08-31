import { daysUntil } from '@/lib/dates';
import { DocumentTypeId, TrackedDocument } from '@/types';

/**
 * Renewals in the UAE are chained: some documents cannot be renewed unless
 * another is still valid. Every rule here was checked against the responsible
 * authority's own published requirements — see `source` on each. Anything we
 * could not verify is deliberately absent, because a confident-sounding wrong
 * warning is worse than no warning.
 */
export type Prerequisite = {
  /** The document being renewed. */
  dependent: DocumentTypeId;
  /** The document that must still be valid in order to renew it. */
  requires: DocumentTypeId;
  /**
   * How long the prerequisite must outlast the dependent's expiry. Zero means
   * it simply has to still be valid on the day.
   */
  bufferDays: number;
  /** Shown when the prerequisite falls short. Kept to one sentence. */
  warning: string;
  /** Shown on the dependent even when nothing is wrong, as a heads-up. */
  note: string;
  source: string;
};

export const PREREQUISITES: Prerequisite[] = [
  {
    dependent: 'car-registration',
    requires: 'car-insurance',
    // The RTA wants a policy that covers the whole new registration year, which
    // is why insurers sell 13-month motor policies here.
    bufferDays: 30,
    warning: 'Renew your car insurance first — registration cannot be renewed without a policy covering the new year.',
    note: 'You will need valid insurance covering the new registration year, and all traffic fines cleared.',
    source: 'Vehicle registration renewal requirements (RTA in Dubai, Abu Dhabi Mobility via TAMM, Ministry of Interior elsewhere)',
  },
  {
    dependent: 'residence-visa',
    requires: 'health-insurance',
    bufferDays: 0,
    warning: 'Renew your health insurance first — a visa cannot be issued or renewed without active cover.',
    note: 'Health insurance must be active before the visa can be renewed. It is mandatory in all seven emirates.',
    source: 'ICP / GDRFA residence visa requirements; federal health insurance mandate from 1 January 2025',
  },
  {
    dependent: 'residence-visa',
    requires: 'passport',
    // A passport must carry at least six months' validity at the point of renewal.
    bufferDays: 180,
    warning: 'Your passport needs at least six months left when you renew the visa — start the passport first.',
    note: 'Your passport must have at least six months of validity at renewal.',
    source: 'ICP / GDRFA residence visa requirements',
  },
  {
    dependent: 'driving-license',
    requires: 'emirates-id',
    bufferDays: 0,
    warning: 'Renew your Emirates ID first — a valid one is required to renew your licence.',
    note: 'You will need a valid Emirates ID, an approved eye test, and all traffic fines cleared.',
    source: 'Driving licence renewal requirements across the emirates',
  },
];

export type Blocker = {
  rule: Prerequisite;
  /** The prerequisite document the user actually holds. */
  blocking: TrackedDocument;
};

/**
 * Prerequisites the user is tracking that will not last long enough. Only
 * reports a problem when both documents are present — we never guess at
 * something the user has not told us about.
 */
export function findBlockers(doc: TrackedDocument, all: TrackedDocument[]): Blocker[] {
  const blockers: Blocker[] = [];

  for (const rule of PREREQUISITES) {
    if (rule.dependent !== doc.typeId) continue;

    for (const other of all) {
      if (other.id === doc.id || other.typeId !== rule.requires) continue;
      // Only compare documents belonging to the same person.
      if ((other.owner ?? '') !== (doc.owner ?? '')) continue;

      const shortfall = daysUntil(doc.expiryDate) + rule.bufferDays - daysUntil(other.expiryDate);
      if (shortfall > 0) blockers.push({ rule, blocking: other });
    }
  }

  return blockers;
}

/** The standing requirements for a category, shown whether or not anything is wrong. */
export function notesFor(typeId: DocumentTypeId): string[] {
  return PREREQUISITES.filter((p) => p.dependent === typeId).map((p) => p.note);
}

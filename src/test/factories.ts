import { getDocumentType } from '@/data/document-types';
import { toISODate } from '@/lib/dates';
import type { DocumentTypeId, TrackedDocument } from '@/types';

/**
 * Test documents, built the way the app builds them.
 *
 * Tests that spell out a whole TrackedDocument get long enough that the one
 * field under test disappears into the noise. These take the fields that
 * matter and fill in the rest with what the store would have filled in.
 */

let counter = 0;

/** A date this many days from today, as the app stores dates. */
export function inDays(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function makeDocument(
  typeId: DocumentTypeId,
  overrides: Partial<TrackedDocument> = {}
): TrackedDocument {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `doc-${counter}`,
    typeId,
    title: getDocumentType(typeId).label,
    expiryDate: inDays(365),
    files: [],
    leadDays: getDocumentType(typeId).defaultLeadDays,
    visibility: 'private',
    notificationIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

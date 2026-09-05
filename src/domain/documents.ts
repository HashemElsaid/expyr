import { DOCUMENT_TYPES, getDocumentType } from '@/data/document-types';
import { advance } from '@/lib/recurrence';
import { Attachment, TrackedDocument } from '@/types';

/**
 * The rules about a tracked document, with nothing underneath them.
 *
 * No storage, no notifications, no React. These are the two operations that
 * decide what a stored record means — reading an old one, and moving a
 * recurring one to its next charge — and both have shipped bugs that a test
 * would have caught. Keeping them here is what makes that test possible.
 */

/**
 * Fills in fields added after a document was first saved, so upgrading the app
 * never loses or breaks existing entries. Returns null for anything that is
 * not recognisably a document, which is how a corrupt entry is dropped without
 * taking the rest of the list with it.
 */
export function migrateDocument(raw: unknown): TrackedDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Partial<TrackedDocument> & {
    imageUri?: string;
    fileUri?: string;
    fileType?: 'image' | 'pdf';
  };
  if (!doc.id || !doc.typeId || !doc.expiryDate) return null;

  // A category removed in a later version falls back rather than disappearing.
  const typeId = DOCUMENT_TYPES.some((t) => t.id === doc.typeId) ? doc.typeId : 'other';

  /*
   * Two older shapes to carry forward: `imageUri` from before PDFs, and a
   * single `fileUri` from before multiple attachments. The files on disk keep
   * their original names, so nothing needs moving — only describing.
   */
  const legacyUri = doc.fileUri ?? doc.imageUri;
  const files: Attachment[] = doc.files?.length
    ? doc.files
    : legacyUri
      ? [{ uri: legacyUri, type: doc.fileType ?? 'image', key: 'legacy' }]
      : [];

  return {
    // Existing ids are left exactly as they are — attachment filenames on disk
    // are named after them.
    id: doc.id,
    typeId,
    title: doc.title ?? getDocumentType(typeId).label,
    expiryDate: doc.expiryDate,
    documentNumber: doc.documentNumber,
    notes: doc.notes,
    owner: doc.owner,
    files,
    leadDays: doc.leadDays?.length ? doc.leadDays : getDocumentType(typeId).defaultLeadDays,
    archivedAt: doc.archivedAt,
    snoozedUntil: doc.snoozedUntil,
    history: doc.history,
    renewsEvery: doc.renewsEvery,
    iconDomain: doc.iconDomain,
    visibility: doc.visibility ?? 'private',
    createdAt: doc.createdAt ?? new Date().toISOString(),
    // Anything saved before this field existed has not changed since it was made.
    updatedAt: doc.updatedAt ?? doc.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Moves a subscription's date past today, one period at a time, remembering
 * the dates it has been.
 *
 * Returns the document unchanged — the same object, so callers can compare by
 * identity — when there is nothing to move.
 */
export function rollForward(doc: TrackedDocument, today: Date = new Date()): TrackedDocument {
  if (!doc.renewsEvery || doc.archivedAt) return doc;

  const { next, past } = advance(doc.expiryDate, doc.renewsEvery, today);
  if (past.length === 0) return doc;

  return {
    ...doc,
    expiryDate: next,
    history: [...(doc.history ?? []), ...past],
  };
}

/**
 * The whole collection, brought up to date. Returns the same array when
 * nothing moved, so a caller can skip the write and the reminder rebalance
 * that would otherwise follow.
 */
export function rollForwardAll(
  documents: TrackedDocument[],
  today: Date = new Date()
): TrackedDocument[] {
  let moved = false;
  const next = documents.map((doc) => {
    const advanced = rollForward(doc, today);
    if (advanced !== doc) moved = true;
    return advanced;
  });
  return moved ? next : documents;
}

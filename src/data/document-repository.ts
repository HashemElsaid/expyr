import { migrateDocument } from '@/domain/documents';
import type { TrackedDocument } from '@/types';

/**
 * Where documents are kept, behind an interface.
 *
 * Today there is one implementation and it writes to this phone. That is the
 * whole of Expyr's storage story for documents, and a deliberate one rather
 * than an unfinished one: the privacy screen promises that nothing you track
 * is ever sent to a server, and this file is where that promise is kept.
 *
 * Signing in with Apple does not change it. An account holds an opaque
 * identifier and a credit balance and nothing else; no document has ever gone
 * near it, and none passes through here on its way anywhere.
 *
 * The interface exists because the day a second implementation is wanted —
 * documents that survive a lost phone, a household sharing a tenancy contract —
 * it should be a new file rather than a rewrite of every screen. So the shape
 * here is the shape a syncing store needs, and the local one simply answers
 * every question locally:
 *
 *   - changes are made one record at a time, never as a whole-list write, so
 *     two devices editing different documents do not collide;
 *   - a delete leaves a tombstone rather than a hole, because a record that
 *     merely vanished is indistinguishable from one the other device has not
 *     seen yet, and the wrong guess resurrects deleted passports;
 *   - every change is written to an outbox, which a sync implementation drains
 *     and this one simply lets grow bounded and ignores.
 *
 * None of that costs anything today. All of it is the difference between
 * adding sync later and rebuilding for it.
 */

/** The half of AsyncStorage this needs, so tests can supply their own. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type ChangeKind = 'upsert' | 'delete';

/** A local change a server has not been told about yet. */
export type PendingChange = {
  documentId: string;
  kind: ChangeKind;
  /** When the change was made on this device. */
  at: string;
};

export interface DocumentRepository {
  /** Everything still current, tombstones excluded. */
  load(): Promise<TrackedDocument[]>;
  /** Creates or replaces one record. */
  upsert(doc: TrackedDocument): Promise<void>;
  /** Marks one deleted, leaving a tombstone behind. */
  remove(id: string): Promise<void>;
  /** Replaces the entire collection — used by restore, and by nothing else. */
  replaceAll(documents: TrackedDocument[]): Promise<void>;
  /** Changes not yet sent anywhere. Always answerable, even with no server. */
  pending(): Promise<PendingChange[]>;
  /** Forgets the named changes, once something has accepted them. */
  acknowledge(documentIds: string[]): Promise<void>;
}

/* -------------------------------------------------------------- the local -- */

const DOCUMENTS_KEY = 'expyr.documents.v1';
/** Where documents lived before the app was renamed. Read once, then adopted. */
const LEGACY_DOCUMENTS_KEY = 'renewly.documents.v1';
const OUTBOX_KEY = 'expyr.outbox.v1';

/**
 * How long a tombstone is worth keeping.
 *
 * It only has a job while another device might still be carrying the record it
 * cancels. Ninety days is far longer than any sync would need and short enough
 * that a phone which has deleted a hundred items is not carrying them forever.
 */
const TOMBSTONE_DAYS = 90;

/** A record with a `deletedAt` is a tombstone: kept, but no longer a document. */
type StoredDocument = TrackedDocument & { deletedAt?: string };

/**
 * The outbox is a safety net, not a queue anybody drains yet. Bounded so a
 * phone that never syncs cannot grow it without limit.
 */
const MAX_PENDING = 500;

function isTombstone(doc: StoredDocument): boolean {
  return typeof doc.deletedAt === 'string';
}

function expired(doc: StoredDocument, now: number): boolean {
  if (!doc.deletedAt) return false;
  const at = Date.parse(doc.deletedAt);
  return Number.isFinite(at) && now - at > TOMBSTONE_DAYS * 86_400_000;
}

export class LocalDocumentRepository implements DocumentRepository {
  constructor(private readonly store: KeyValueStore) {}

  /**
   * Everything on disk, tombstones included. Kept private: callers deal in
   * documents, and a tombstone is a storage concern.
   */
  private async readAll(): Promise<StoredDocument[]> {
    const raw =
      (await this.store.getItem(DOCUMENTS_KEY)) ??
      (await this.store.getItem(LEGACY_DOCUMENTS_KEY));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const out: StoredDocument[] = [];
    for (const entry of parsed) {
      const deletedAt = (entry as { deletedAt?: unknown })?.deletedAt;
      const doc = migrateDocument(entry);
      if (!doc) continue;
      const stored: StoredDocument =
        typeof deletedAt === 'string' ? { ...doc, deletedAt } : doc;
      // A tombstone past its usefulness is simply dropped on the next read.
      if (expired(stored, now)) continue;
      out.push(stored);
    }
    return out;
  }

  private async writeAll(documents: StoredDocument[]): Promise<void> {
    await this.store.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
  }

  private async note(documentId: string, kind: ChangeKind): Promise<void> {
    try {
      const pending = await this.pending();
      // One entry per document: the latest intention is the only one that matters.
      const next = pending.filter((change) => change.documentId !== documentId);
      next.push({ documentId, kind, at: new Date().toISOString() });
      await this.store.setItem(OUTBOX_KEY, JSON.stringify(next.slice(-MAX_PENDING)));
    } catch {
      /*
       * The outbox is a record of what a future sync would need to send. Losing
       * an entry costs a document that syncs late; failing the write it belongs
       * to would cost the document itself. The document wins.
       */
    }
  }

  async load(): Promise<TrackedDocument[]> {
    const all = await this.readAll();
    return all.filter((doc) => !isTombstone(doc)).map(({ deletedAt: _drop, ...doc }) => doc);
  }

  async upsert(doc: TrackedDocument): Promise<void> {
    const all = await this.readAll();
    const at = all.findIndex((entry) => entry.id === doc.id);
    // Writing over a tombstone is how a restore brings something back.
    if (at === -1) all.push(doc);
    else all[at] = doc;

    await this.writeAll(all);
    await this.note(doc.id, 'upsert');
  }

  async remove(id: string): Promise<void> {
    const all = await this.readAll();
    const at = all.findIndex((entry) => entry.id === id);
    if (at === -1) return;

    all[at] = { ...all[at], deletedAt: new Date().toISOString() };
    await this.writeAll(all);
    await this.note(id, 'delete');
  }

  /**
   * Used by restore and by "delete everything", both of which are the user
   * saying that what is here now is the whole truth. Anything that was here
   * before and is not in the new set becomes a tombstone rather than
   * disappearing, so a second device is told about the removal rather than
   * left to re-upload it.
   */
  async replaceAll(documents: TrackedDocument[]): Promise<void> {
    const existing = await this.readAll();
    const incoming = new Set(documents.map((doc) => doc.id));
    const now = new Date().toISOString();

    const tombstones = existing
      .filter((doc) => !incoming.has(doc.id))
      .map((doc) => (isTombstone(doc) ? doc : { ...doc, deletedAt: now }));

    await this.writeAll([...documents, ...tombstones]);

    const changes: PendingChange[] = [
      ...documents.map((doc) => ({ documentId: doc.id, kind: 'upsert' as const, at: now })),
      ...tombstones.map((doc) => ({ documentId: doc.id, kind: 'delete' as const, at: now })),
    ];
    await this.store
      .setItem(OUTBOX_KEY, JSON.stringify(changes.slice(-MAX_PENDING)))
      .catch(() => {});
  }

  async pending(): Promise<PendingChange[]> {
    try {
      const raw = await this.store.getItem(OUTBOX_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (change): change is PendingChange =>
          typeof (change as PendingChange)?.documentId === 'string' &&
          ((change as PendingChange).kind === 'upsert' ||
            (change as PendingChange).kind === 'delete')
      );
    } catch {
      return [];
    }
  }

  async acknowledge(documentIds: string[]): Promise<void> {
    const done = new Set(documentIds);
    const remaining = (await this.pending()).filter((change) => !done.has(change.documentId));
    await this.store.setItem(OUTBOX_KEY, JSON.stringify(remaining));
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LocalDocumentRepository, type DocumentRepository } from '@/data/document-repository';
import { rollForwardAll } from '@/domain/documents';
import { daysUntil } from '@/lib/dates';
import { deleteAttachment, storeAttachment } from '@/lib/files';
import { newDocumentId } from '@/lib/ids';
import { deleteAllGuidance } from '@/lib/guidance';
import { deleteReading } from '@/lib/reading';
import { applyReminderPlan, cancelAllReminders, type ReminderStatus } from '@/lib/notifications';
import { snoozeDate } from '@/lib/reminder-plan';
import { useSettings } from '@/store/settings';
import { Attachment, DocumentDraft, TrackedDocument } from '@/types';

/**
 * The store owns what the screens see; the repository owns what the phone
 * keeps. Swapping the second for one that also talks to a server is the whole
 * of what adding sync would mean here — no screen and nothing in this file
 * would need to know.
 */
const repository: DocumentRepository = new LocalDocumentRepository(AsyncStorage);

/**
 * What went wrong while saving, in a sentence somebody can act on.
 *
 * This exists because the failure it describes used to be invisible. Every
 * write ended in an empty catch, so a phone that could not write to storage
 * showed the document on screen, said nothing, and lost it at the next launch.
 * A tracker that silently forgets is worse than one that refuses.
 */
export type SaveProblem = {
  message: string;
  /** Runs the same write again. */
  retry: () => Promise<void>;
};

type DocumentsContextValue = {
  /** Active items only — archived ones are kept separately. */
  documents: TrackedDocument[];
  archived: TrackedDocument[];
  loaded: boolean;
  /** Set when the last write to storage failed. Null when all is well. */
  saveProblem: SaveProblem | null;
  /** How many reminders are booked with iOS, and how many were wanted. */
  reminders: ReminderStatus;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  addDocument: (draft: DocumentDraft) => Promise<TrackedDocument>;
  updateDocument: (id: string, draft: DocumentDraft) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  /** Re-books every reminder — used after notification permission is granted. */
  rescheduleAll: () => Promise<void>;
  /** Swaps in a restored set, cancelling anything the old set had booked. */
  replaceAll: (documents: TrackedDocument[]) => Promise<void>;
  /** Wipes every document, photo and reminder. */
  deleteEverything: () => Promise<void>;
  /** Books one extra nudge, used by the Snooze action on a reminder. */
  snoozeDocument: (id: string, days?: number) => Promise<void>;
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

const NO_REMINDERS: ReminderStatus = { booked: 0, wanted: 0, unchanged: true };

/**
 * Copies any newly picked attachments into permanent storage and removes the
 * files behind attachments the user dropped. Reports what it could not store,
 * because a document saved without the photo somebody just took is a silent
 * loss they will only discover when they need it.
 */
function persistAttachments(
  next: Attachment[],
  previous: Attachment[],
  documentId: string
): { kept: Attachment[]; failed: number } {
  const kept: Attachment[] = [];
  let failed = 0;

  for (const attachment of next) {
    const stored = storeAttachment(attachment.uri, documentId, attachment.type, attachment.key);
    if (stored) kept.push(stored);
    else failed += 1;
  }

  for (const old of previous) {
    if (!next.some((a) => a.key === old.key)) deleteAttachment(old);
  }
  return { kept, failed };
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<TrackedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);
  const [reminders, setReminders] = useState<ReminderStatus>(NO_REMINDERS);
  const { settings } = useSettings();
  /** Mirror of state so writes never race against a stale closure. */
  const latest = useRef<TrackedDocument[]>([]);
  /** Same reason — it decides what a reminder can promise the user. */
  const country = useRef(settings.country);
  country.current = settings.country;

  /**
   * Shows the change, writes it, and brings the reminders in line.
   *
   * The screen updates first because the person who just typed something
   * should see it; the write is then awaited rather than fired and forgotten,
   * because it is the only moment the app can discover that a phone has no
   * room left. That used to be swallowed, which meant a document on screen,
   * nothing said, and nothing there at the next launch.
   */
  const commit = useCallback(
    async (next: TrackedDocument[], write: () => Promise<void>): Promise<void> => {
      latest.current = next;
      setDocuments(next);

      try {
        await write();
        setSaveProblem(null);
      } catch {
        setSaveProblem({
          message:
            'Expyr could not save that to this iPhone. Your other items are safe, but this change will be lost if you close the app. Freeing up storage usually fixes it.',
          retry: () => commit(latest.current, write),
        });
        // The reminders would describe a list that is not on disk. Leave them.
        return;
      }

      const status = await applyReminderPlan(next, country.current);
      setReminders(status);
    },
    []
  );

  /**
   * Brings dates and reminders up to date without changing anything the user
   * did. Runs on load and whenever the app comes back to the front, because
   * both subscriptions and reminders go stale by the passage of time alone.
   */
  const refresh = useCallback(async () => {
    const before = latest.current;
    const rolled = rollForwardAll(before);
    if (rolled !== before) {
      // Only the records that actually moved are written back.
      const moved = rolled.filter((doc, i) => doc !== before[i]);
      await commit(rolled, async () => {
        for (const doc of moved) await repository.upsert(doc);
      });
      return;
    }
    const status = await applyReminderPlan(before, country.current);
    setReminders(status);
  }, [commit]);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const stored = await repository.load();
        if (!live) return;
        latest.current = stored;
        setDocuments(stored);
      } catch {
        /*
         * Unreadable storage. The list stays empty rather than the app refusing
         * to open, and nothing is written over the top of whatever is there —
         * a later launch may well read it, and overwriting now would make sure
         * it never did.
         */
        if (live) {
          setSaveProblem({
            message:
              'Expyr could not read what it had saved on this iPhone. Nothing has been overwritten. Restarting usually fixes it; if it does not, restore from a backup.',
            retry: async () => {},
          });
        }
      } finally {
        if (live) setLoaded(true);
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  /*
   * Once the list is on screen, catch it up: subscriptions whose charge has
   * passed move to the next one, and the reminder plan is rebuilt for the
   * dates as they now are. Deliberately after the first paint — nobody should
   * wait on notification work to see their own documents.
   */
  useEffect(() => {
    if (!loaded) return;
    refresh();
  }, [loaded, refresh]);

  /*
   * And again whenever the app comes back to the front. A phone left closed
   * for two months has subscriptions that have charged twice and a reminder
   * queue describing a world that has moved on.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && loaded) refresh();
    });
    return () => sub.remove();
  }, [loaded, refresh]);

  const addDocument = useCallback(
    async (draft: DocumentDraft) => {
      const id = newDocumentId();
      const now = new Date().toISOString();
      const { kept, failed } = persistAttachments(draft.files, [], id);

      const doc: TrackedDocument = {
        ...draft,
        id,
        files: kept,
        visibility: draft.visibility ?? 'private',
        createdAt: now,
        updatedAt: now,
      };

      await commit([...latest.current, doc], () => repository.upsert(doc));
      if (failed > 0) reportAttachmentFailure(failed, setSaveProblem);
      return doc;
    },
    [commit]
  );

  const updateDocument = useCallback(
    async (id: string, draft: DocumentDraft) => {
      const previous = latest.current.find((d) => d.id === id);
      if (!previous) return;

      const { kept, failed } = persistAttachments(draft.files, previous.files, id);

      const updated: TrackedDocument = {
        ...draft,
        id,
        files: kept,
        // No screen sets this yet, so an edit must not quietly reset it.
        visibility: draft.visibility ?? previous.visibility,
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await commit(
        latest.current.map((d) => (d.id === id ? updated : d)),
        () => repository.upsert(updated)
      );
      if (failed > 0) reportAttachmentFailure(failed, setSaveProblem);
    },
    [commit]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;
      target.files.forEach(deleteAttachment);
      // The transcript is the document's contents in plain text. It must not
      // outlive the document somebody just deleted.
      deleteReading(id);
      await commit(
        latest.current.filter((d) => d.id !== id),
        () => repository.remove(id)
      );
    },
    [commit]
  );

  const rescheduleAll = useCallback(async () => {
    const status = await applyReminderPlan(latest.current, country.current);
    setReminders(status);
  }, []);

  const replaceAll = useCallback(
    async (restored: TrackedDocument[]) => {
      await cancelAllReminders();
      await commit(restored, () => repository.replaceAll(restored));
    },
    [commit]
  );

  const deleteEverything = useCallback(async () => {
    for (const doc of latest.current) {
      doc.files.forEach(deleteAttachment);
      deleteReading(doc.id);
    }
    await cancelAllReminders();
    /*
     * Guidance is public information about a jurisdiction rather than anything
     * about this person, but somebody who asked for everything to go expects
     * everything to go. It costs one look-up to have it back.
     */
    deleteAllGuidance();
    await commit([], () => repository.replaceAll([]));
  }, [commit]);

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;

      const updated: TrackedDocument = {
        ...target,
        archivedAt: archived ? new Date().toISOString() : undefined,
        // Archiving settles the matter; an outstanding snooze goes with it.
        snoozedUntil: archived ? undefined : target.snoozedUntil,
        updatedAt: new Date().toISOString(),
      };
      await commit(
        latest.current.map((d) => (d.id === id ? updated : d)),
        () => repository.upsert(updated)
      );
    },
    [commit]
  );

  /**
   * Records the snooze on the document rather than booking a notification for
   * it. The planner picks it up on the next pass, which means a later
   * rebalance carries it forward instead of cancelling something it knew
   * nothing about.
   */
  const snoozeDocument = useCallback(
    async (id: string, days = 7) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;
      const snoozed = { ...target, snoozedUntil: snoozeDate(days) };
      await commit(
        latest.current.map((d) => (d.id === id ? snoozed : d)),
        () => repository.upsert(snoozed)
      );
    },
    [commit]
  );

  const value = useMemo(
    () => ({
      documents: documents
        .filter((d) => !d.archivedAt)
        .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
      archived: documents
        .filter((d) => d.archivedAt)
        .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
      loaded,
      saveProblem,
      reminders,
      setArchived,
      addDocument,
      updateDocument,
      removeDocument,
      rescheduleAll,
      replaceAll,
      deleteEverything,
      snoozeDocument,
    }),
    [
      documents,
      loaded,
      saveProblem,
      reminders,
      setArchived,
      addDocument,
      updateDocument,
      removeDocument,
      rescheduleAll,
      replaceAll,
      deleteEverything,
      snoozeDocument,
    ]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

/**
 * The document saved but a photo did not. Said plainly rather than silently,
 * because the person who just photographed their Emirates ID has every reason
 * to believe the photo is in there.
 */
function reportAttachmentFailure(
  failed: number,
  report: (problem: SaveProblem) => void
): void {
  report({
    message:
      failed === 1
        ? 'One attachment could not be saved to this iPhone. The item was saved without it — try attaching it again.'
        : `${failed} attachments could not be saved to this iPhone. The item was saved without them — try attaching them again.`,
    retry: async () => {},
  });
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used inside DocumentsProvider');
  return ctx;
}

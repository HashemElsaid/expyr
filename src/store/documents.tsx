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

import { DOCUMENT_TYPES, getDocumentType } from '@/data/document-types';
import { daysUntil } from '@/lib/dates';
import { deleteAttachment, newAttachmentKey, storeAttachment } from '@/lib/files';
import { newDocumentId } from '@/lib/ids';
import { cancelReminders, scheduleReminders, snoozeReminder } from '@/lib/notifications';
import { useSettings } from '@/store/settings';
import { Attachment, DocumentDraft, TrackedDocument } from '@/types';

const STORAGE_KEY = 'renewly.documents.v1';

type DocumentsContextValue = {
  /** Active items only — archived ones are kept separately. */
  documents: TrackedDocument[];
  archived: TrackedDocument[];
  loaded: boolean;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  addDocument: (draft: DocumentDraft) => Promise<TrackedDocument>;
  updateDocument: (id: string, draft: DocumentDraft) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  /** Re-books every reminder — used after the reminder time changes. */
  rescheduleAll: () => Promise<void>;
  /** Swaps in a restored set, cancelling anything the old set had booked. */
  replaceAll: (documents: TrackedDocument[]) => Promise<void>;
  /** Wipes every document, photo and reminder. */
  deleteEverything: () => Promise<void>;
  /** Books one extra nudge, used by the Snooze action on a reminder. */
  snoozeDocument: (id: string, days?: number) => Promise<void>;
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

/**
 * Fills in fields added after a document was first saved, so upgrading the app
 * never loses or breaks existing entries.
 */
function migrate(raw: unknown): TrackedDocument | null {
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
    // Existing ids are left exactly as they are — scheduled notifications and
    // attachment filenames on disk are named after them.
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
    history: doc.history,
    visibility: doc.visibility ?? 'private',
    notificationIds: doc.notificationIds ?? [],
    createdAt: doc.createdAt ?? new Date().toISOString(),
    // Anything saved before this field existed has not changed since it was made.
    updatedAt: doc.updatedAt ?? doc.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Copies any newly picked attachments into permanent storage and removes the
 * files behind attachments the user dropped.
 */
function persistAttachments(
  next: Attachment[],
  previous: Attachment[],
  documentId: string
): Attachment[] {
  const kept: Attachment[] = [];
  for (const attachment of next) {
    const stored = storeAttachment(attachment.uri, documentId, attachment.type, attachment.key);
    if (stored) kept.push(stored);
  }

  for (const old of previous) {
    if (!next.some((a) => a.key === old.key)) deleteAttachment(old);
  }
  return kept;
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<TrackedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { settings } = useSettings();
  /** Mirror of state so writes never race against a stale closure. */
  const latest = useRef<TrackedDocument[]>([]);
  /** Read inside callbacks so they never capture a stale hour. */
  const reminderHour = useRef(settings.reminderHour);
  reminderHour.current = settings.reminderHour;
  /** Same reason — it decides what a reminder can promise the user. */
  const country = useRef(settings.country);
  country.current = settings.country;

  const commit = useCallback((next: TrackedDocument[]) => {
    latest.current = next;
    setDocuments(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const migrated = parsed.map(migrate).filter((d): d is TrackedDocument => d !== null);
        latest.current = migrated;
        setDocuments(migrated);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const addDocument = useCallback(
    async (draft: DocumentDraft) => {
      const id = newDocumentId();
      const now = new Date().toISOString();
      const doc: TrackedDocument = {
        ...draft,
        id,
        files: persistAttachments(draft.files, [], id),
        visibility: draft.visibility ?? 'private',
        notificationIds: [],
        createdAt: now,
        updatedAt: now,
      };
      doc.notificationIds = await scheduleReminders(doc, reminderHour.current, country.current);
      commit([...latest.current, doc]);
      return doc;
    },
    [commit]
  );

  const updateDocument = useCallback(
    async (id: string, draft: DocumentDraft) => {
      const previous = latest.current.find((d) => d.id === id);
      if (!previous) return;

      await cancelReminders(previous.notificationIds);

      const updated: TrackedDocument = {
        ...draft,
        id,
        files: persistAttachments(draft.files, previous.files, id),
        // No screen sets this yet, so an edit must not quietly reset it.
        visibility: draft.visibility ?? previous.visibility,
        notificationIds: [],
        createdAt: previous.createdAt,
        updatedAt: new Date().toISOString(),
      };
      updated.notificationIds = await scheduleReminders(
        updated,
        reminderHour.current,
        country.current
      );
      commit(latest.current.map((d) => (d.id === id ? updated : d)));
    },
    [commit]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;
      await cancelReminders(target.notificationIds);
      target.files.forEach(deleteAttachment);
      commit(latest.current.filter((d) => d.id !== id));
    },
    [commit]
  );

  const rescheduleAll = useCallback(async () => {
    const next: TrackedDocument[] = [];
    for (const doc of latest.current) {
      await cancelReminders(doc.notificationIds);
      next.push({
        ...doc,
        notificationIds: doc.archivedAt
          ? []
          : await scheduleReminders(doc, reminderHour.current, country.current),
      });
    }
    commit(next);
  }, [commit]);

  const replaceAll = useCallback(
    async (restored: TrackedDocument[]) => {
      for (const doc of latest.current) {
        await cancelReminders(doc.notificationIds);
      }
      const next: TrackedDocument[] = [];
      for (const doc of restored) {
        next.push({
          ...doc,
          notificationIds: await scheduleReminders(doc, reminderHour.current, country.current),
        });
      }
      commit(next);
    },
    [commit]
  );

  const deleteEverything = useCallback(async () => {
    for (const doc of latest.current) {
      await cancelReminders(doc.notificationIds);
      doc.files.forEach(deleteAttachment);
    }
    commit([]);
  }, [commit]);

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;

      await cancelReminders(target.notificationIds);
      const updated: TrackedDocument = {
        ...target,
        archivedAt: archived ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
        // Archived items keep no reminders; restoring one re-books them.
        notificationIds: archived
          ? []
          : await scheduleReminders(
              { ...target, archivedAt: undefined },
              reminderHour.current,
              country.current
            ),
      };
      commit(latest.current.map((d) => (d.id === id ? updated : d)));
    },
    [commit]
  );

  const snoozeDocument = useCallback(
    async (id: string, days = 7) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;
      const notificationId = await snoozeReminder(target, days);
      if (!notificationId) return;
      commit(
        latest.current.map((d) =>
          d.id === id ? { ...d, notificationIds: [...d.notificationIds, notificationId] } : d
        )
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

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used inside DocumentsProvider');
  return ctx;
}

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

import { getDocumentType } from '@/data/document-types';
import { daysUntil } from '@/lib/dates';
import { deleteFile, storeFile } from '@/lib/files';
import { cancelReminders, scheduleReminders } from '@/lib/notifications';
import { useSettings } from '@/store/settings';
import { DocumentDraft, TrackedDocument } from '@/types';

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
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

/**
 * Fills in fields added after a document was first saved, so upgrading the app
 * never loses or breaks existing entries.
 */
function migrate(raw: unknown): TrackedDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Partial<TrackedDocument> & { imageUri?: string };
  if (!doc.id || !doc.typeId || !doc.expiryDate) return null;

  // Documents saved before PDFs were supported stored a photo in `imageUri`.
  const fileUri = doc.fileUri ?? doc.imageUri;

  return {
    id: doc.id,
    typeId: doc.typeId,
    title: doc.title ?? getDocumentType(doc.typeId).label,
    expiryDate: doc.expiryDate,
    documentNumber: doc.documentNumber,
    notes: doc.notes,
    owner: doc.owner,
    fileUri,
    fileType: doc.fileType ?? (fileUri ? 'image' : undefined),
    leadDays: doc.leadDays?.length ? doc.leadDays : getDocumentType(doc.typeId).defaultLeadDays,
    archivedAt: doc.archivedAt,
    notificationIds: doc.notificationIds ?? [],
    createdAt: doc.createdAt ?? new Date().toISOString(),
  };
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
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const doc: TrackedDocument = {
        ...draft,
        id,
        fileUri: draft.fileUri
          ? storeFile(draft.fileUri, id, draft.fileType ?? 'image')
          : undefined,
        notificationIds: [],
        createdAt: new Date().toISOString(),
      };
      doc.notificationIds = await scheduleReminders(doc, reminderHour.current);
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

      // Drop the old attachment when it has been replaced or removed.
      if (previous.fileUri && previous.fileUri !== draft.fileUri) {
        deleteFile(previous.fileUri);
      }

      const updated: TrackedDocument = {
        ...draft,
        id,
        fileUri: draft.fileUri
          ? storeFile(draft.fileUri, id, draft.fileType ?? 'image')
          : undefined,
        notificationIds: [],
        createdAt: previous.createdAt,
      };
      updated.notificationIds = await scheduleReminders(updated, reminderHour.current);
      commit(latest.current.map((d) => (d.id === id ? updated : d)));
    },
    [commit]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      const target = latest.current.find((d) => d.id === id);
      if (!target) return;
      await cancelReminders(target.notificationIds);
      deleteFile(target.fileUri);
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
          : await scheduleReminders(doc, reminderHour.current),
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
        next.push({ ...doc, notificationIds: await scheduleReminders(doc, reminderHour.current) });
      }
      commit(next);
    },
    [commit]
  );

  const deleteEverything = useCallback(async () => {
    for (const doc of latest.current) {
      await cancelReminders(doc.notificationIds);
      deleteFile(doc.fileUri);
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
        // Archived items keep no reminders; restoring one re-books them.
        notificationIds: archived
          ? []
          : await scheduleReminders({ ...target, archivedAt: undefined }, reminderHour.current),
      };
      commit(latest.current.map((d) => (d.id === id ? updated : d)));
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
    ]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used inside DocumentsProvider');
  return ctx;
}

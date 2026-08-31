import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Country } from '@/data/countries';
import { getDocumentType, labelForId } from '@/data/document-types';
import { formatDate } from '@/lib/dates';
import { Attachment, TrackedDocument } from '@/types';

const BACKUP_FORMAT = 1;

type BackupDocument = Omit<TrackedDocument, 'files' | 'notificationIds'> & {
  /** Attachments travel inside the file so a restore is complete. */
  attachments?: { key: string; type: 'image' | 'pdf'; base64: string }[];
  /** Written by earlier versions, when a document had a single attachment. */
  fileBase64?: string;
  imageBase64?: string;
  fileType?: 'image' | 'pdf';
};

type BackupFile = {
  app: 'expyr';
  format: number;
  exportedAt: string;
  documents: BackupDocument[];
};

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function scratchFile(name: string): File {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create();
  const file = new File(dir, name);
  if (file.exists) file.delete();
  return file;
}

async function share(file: File, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: mimeType });
}

/** Writes every document, photos included, to a file the user can keep. */
export async function exportBackup(documents: TrackedDocument[]): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Backups are only available on the phone app.');

  const payload: BackupFile = {
    app: 'expyr',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    documents: documents.map((doc) => {
      const { files, notificationIds, ...rest } = doc;
      const attachments: BackupDocument['attachments'] = [];
      for (const file of files) {
        try {
          const handle = new File(file.uri);
          if (handle.exists) {
            attachments.push({ key: file.key, type: file.type, base64: handle.base64Sync() });
          }
        } catch {
          // A missing attachment should never abort the whole backup.
        }
      }
      return { ...rest, attachments };
    }),
  };

  const file = scratchFile(`expyr-backup-${timestamp()}.json`);
  file.create();
  file.write(JSON.stringify(payload));
  await share(file, 'application/json', 'Save your Expyr backup');
}

/** A plain spreadsheet of what you track, for people who want it readable. */
export async function exportCsv(
  documents: TrackedDocument[],
  country: Country | null = null
): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Export is only available on the phone app.');

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ['Name', 'Category', 'Expires', 'Belongs to', 'Number', 'Notes'].join(','),
    ...documents.map((doc) =>
      [
        escape(doc.title),
        escape(labelForId(doc.typeId, country)),
        escape(formatDate(doc.expiryDate)),
        escape(doc.owner ?? ''),
        escape(doc.documentNumber ?? ''),
        escape(doc.notes ?? ''),
      ].join(',')
    ),
  ];

  const file = scratchFile(`expyr-${timestamp()}.csv`);
  file.create();
  file.write(rows.join('\n'));
  await share(file, 'text/csv', 'Export your Expyr items');
}

export type RestoreResult = { documents: TrackedDocument[]; count: number };

/**
 * Reads a backup file and rebuilds the documents, writing any embedded photos
 * back into private storage. Returns documents with no notification ids — the
 * caller reschedules them.
 */
export async function importBackup(): Promise<RestoreResult | null> {
  if (Platform.OS === 'web') throw new Error('Restore is only available on the phone app.');

  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    base64: false,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const file = new File(picked.assets[0].uri);
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;

  // 'renewly' is what backups made before the rename say.
  const known = parsed.app === 'expyr' || String(parsed.app) === 'renewly';
  if (!known || !Array.isArray(parsed.documents)) {
    throw new Error('That file is not an Expyr backup.');
  }
  if ((parsed.format ?? 0) > BACKUP_FORMAT) {
    throw new Error('That backup was made by a newer version of Expyr.');
  }

  const imagesDir = new Directory(Paths.document, 'documents');
  if (!imagesDir.exists) imagesDir.create();

  const documents: TrackedDocument[] = [];
  for (const entry of parsed.documents) {
    if (!entry?.id || !entry.typeId || !entry.expiryDate) continue;

    /*
     * Backups written before multiple attachments carried a single blob under
     * `fileBase64` (or `imageBase64` before that). Normalise both into a list.
     */
    const legacyPayload = entry.fileBase64 ?? entry.imageBase64;
    const incoming =
      entry.attachments?.length
        ? entry.attachments
        : legacyPayload
          ? [{ key: 'legacy', type: entry.fileType ?? ('image' as const), base64: legacyPayload }]
          : [];

    const files: Attachment[] = [];
    for (const item of incoming) {
      try {
        const target = new File(
          imagesDir,
          `${entry.id}-${item.key}.${item.type === 'pdf' ? 'pdf' : 'jpg'}`
        );
        if (target.exists) target.delete();
        target.create();
        target.write(item.base64, { encoding: 'base64' });
        files.push({ uri: target.uri, type: item.type, key: item.key });
      } catch {
        // Restore the entry even if one attachment cannot be written.
      }
    }

    documents.push({
      id: entry.id,
      typeId: entry.typeId,
      title: entry.title ?? getDocumentType(entry.typeId).label,
      expiryDate: entry.expiryDate,
      documentNumber: entry.documentNumber,
      notes: entry.notes,
      owner: entry.owner,
      files,
      archivedAt: entry.archivedAt,
      history: entry.history,
      leadDays: entry.leadDays?.length
        ? entry.leadDays
        : getDocumentType(entry.typeId).defaultLeadDays,
      visibility: entry.visibility ?? 'private',
      notificationIds: [],
      createdAt: entry.createdAt ?? new Date().toISOString(),
      updatedAt: entry.updatedAt ?? entry.createdAt ?? new Date().toISOString(),
    });
  }

  return { documents, count: documents.length };
}

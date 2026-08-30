import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getDocumentType } from '@/data/document-types';
import { formatDate } from '@/lib/dates';
import { TrackedDocument } from '@/types';

const BACKUP_FORMAT = 1;

type BackupDocument = Omit<TrackedDocument, 'imageUri' | 'notificationIds'> & {
  /** The photo travels inside the file so a restore is complete. */
  imageBase64?: string;
};

type BackupFile = {
  app: 'renewly';
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
    app: 'renewly',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    documents: documents.map((doc) => {
      const { imageUri, notificationIds, ...rest } = doc;
      let imageBase64: string | undefined;
      if (imageUri) {
        try {
          const image = new File(imageUri);
          if (image.exists) imageBase64 = image.base64Sync();
        } catch {
          // A missing photo should never abort the whole backup.
        }
      }
      return { ...rest, imageBase64 };
    }),
  };

  const file = scratchFile(`renewly-backup-${timestamp()}.json`);
  file.create();
  file.write(JSON.stringify(payload));
  await share(file, 'application/json', 'Save your Renewly backup');
}

/** A plain spreadsheet of what you track, for people who want it readable. */
export async function exportCsv(documents: TrackedDocument[]): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Export is only available on the phone app.');

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ['Name', 'Category', 'Expires', 'Belongs to', 'Number', 'Notes'].join(','),
    ...documents.map((doc) =>
      [
        escape(doc.title),
        escape(getDocumentType(doc.typeId).label),
        escape(formatDate(doc.expiryDate)),
        escape(doc.owner ?? ''),
        escape(doc.documentNumber ?? ''),
        escape(doc.notes ?? ''),
      ].join(',')
    ),
  ];

  const file = scratchFile(`renewly-${timestamp()}.csv`);
  file.create();
  file.write(rows.join('\n'));
  await share(file, 'text/csv', 'Export your Renewly items');
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

  if (parsed.app !== 'renewly' || !Array.isArray(parsed.documents)) {
    throw new Error('That file is not a Renewly backup.');
  }
  if ((parsed.format ?? 0) > BACKUP_FORMAT) {
    throw new Error('That backup was made by a newer version of Renewly.');
  }

  const imagesDir = new Directory(Paths.document, 'documents');
  if (!imagesDir.exists) imagesDir.create();

  const documents: TrackedDocument[] = [];
  for (const entry of parsed.documents) {
    if (!entry?.id || !entry.typeId || !entry.expiryDate) continue;

    let imageUri: string | undefined;
    if (entry.imageBase64) {
      try {
        const target = new File(imagesDir, `${entry.id}.jpg`);
        if (target.exists) target.delete();
        target.create();
        target.write(entry.imageBase64, { encoding: 'base64' });
        imageUri = target.uri;
      } catch {
        // Restore the entry even if its photo cannot be written.
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
      imageUri,
      leadDays: entry.leadDays?.length
        ? entry.leadDays
        : getDocumentType(entry.typeId).defaultLeadDays,
      notificationIds: [],
      createdAt: entry.createdAt ?? new Date().toISOString(),
    });
  }

  return { documents, count: documents.length };
}

import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { Attachment } from '@/types';

/**
 * Attachments live in the app's private directory — not the camera roll — so
 * ID photos and contracts never appear in Photos or iCloud Photo Library.
 */
const FOLDER = 'documents';

export type FileType = 'image' | 'pdf';

function attachmentsDirectory(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

/** True when the URI already points inside our permanent storage. */
export function isStoredFile(uri?: string): boolean {
  if (!uri || Platform.OS === 'web') return false;
  return uri.includes(`/${FOLDER}/`);
}

export function fileTypeFor(uriOrName: string, mimeType?: string): FileType {
  if (mimeType === 'application/pdf') return 'pdf';
  return uriOrName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
}

export function newAttachmentKey(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Copies a picked file into permanent storage under a stable name. Returns the
 * attachment as stored, or undefined if the copy failed.
 */
export function storeAttachment(
  temporaryUri: string,
  documentId: string,
  type: FileType,
  key: string
): Attachment | undefined {
  if (Platform.OS === 'web') return undefined;
  if (isStoredFile(temporaryUri)) return { uri: temporaryUri, type, key };
  try {
    const source = new File(temporaryUri);
    if (!source.exists) return undefined;

    const target = new File(
      attachmentsDirectory(),
      `${documentId}-${key}.${type === 'pdf' ? 'pdf' : 'jpg'}`
    );
    if (target.exists) target.delete();
    source.copy(target);
    return { uri: target.uri, type, key };
  } catch {
    return undefined;
  }
}

export function deleteAttachment(attachment?: Attachment): void {
  if (!attachment || Platform.OS === 'web') return;
  try {
    const file = new File(attachment.uri);
    if (file.exists) file.delete();
  } catch {
    // A missing attachment is not worth surfacing to the user.
  }
}

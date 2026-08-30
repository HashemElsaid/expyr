import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

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

/**
 * Copies a picked or processed file into permanent storage. Returns the new
 * URI, or undefined if the copy failed.
 */
export function storeFile(
  temporaryUri: string,
  documentId: string,
  type: FileType
): string | undefined {
  if (Platform.OS === 'web') return undefined;
  if (isStoredFile(temporaryUri)) return temporaryUri;
  try {
    const source = new File(temporaryUri);
    if (!source.exists) return undefined;

    // Remove any previous attachment for this document, whatever its type.
    for (const extension of ['jpg', 'pdf']) {
      const existing = new File(attachmentsDirectory(), `${documentId}.${extension}`);
      if (existing.exists) existing.delete();
    }

    const target = new File(attachmentsDirectory(), `${documentId}.${type === 'pdf' ? 'pdf' : 'jpg'}`);
    source.copy(target);
    return target.uri;
  } catch {
    return undefined;
  }
}

export function deleteFile(uri?: string): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A missing attachment is not worth surfacing to the user.
  }
}

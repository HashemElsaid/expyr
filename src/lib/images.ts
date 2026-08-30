import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Document photos live in the app's private directory — not the camera roll —
 * so ID images never appear in Photos or iCloud Photo Library.
 */
const FOLDER = 'documents';

function documentsDirectory(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

/** True when the URI already points inside our permanent storage. */
export function isStoredImage(uri?: string): boolean {
  if (!uri || Platform.OS === 'web') return false;
  return uri.includes(`/${FOLDER}/`);
}

/**
 * Copies a temporary image (camera roll pick or resized scan) into permanent
 * storage. Returns the new URI, or undefined if the copy failed.
 */
export function storeImage(temporaryUri: string, documentId: string): string | undefined {
  if (Platform.OS === 'web') return undefined;
  if (isStoredImage(temporaryUri)) return temporaryUri;
  try {
    const source = new File(temporaryUri);
    if (!source.exists) return undefined;
    const target = new File(documentsDirectory(), `${documentId}.jpg`);
    if (target.exists) target.delete();
    source.copy(target);
    return target.uri;
  } catch {
    return undefined;
  }
}

export function deleteImage(uri?: string): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A missing image is not worth surfacing to the user.
  }
}

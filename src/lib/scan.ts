import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Country } from '@/data/countries';
import { DOCUMENT_TYPES, labelFor } from '@/data/document-types';
import { fileTypeFor, type FileType } from '@/lib/files';
import { tidyFields } from '@/domain/fields';
import { postJson } from '@/lib/http';
import { DocumentTypeId, ExtractedField } from '@/types';

/** Claude downsamples anything larger, so sending more pixels just costs money. */
const MAX_EDGE = 1568;
const TIMEOUT_MS = 90_000;
/** Comfortably under the 32 MB request ceiling once base64 inflates it. */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export type PickedFile = {
  uri: string;
  type: FileType;
  /** Only present for images; used to decide whether to downscale. */
  width?: number;
  height?: number;
  name?: string;
};

export type ScanResult = {
  found: boolean;
  typeId: DocumentTypeId;
  title: string;
  expiryDate: string;
  documentNumber: string;
  confidence: 'high' | 'medium' | 'low';
  note: string;
  /**
   * Everything else the document said about itself. Absent from a service that
   * has not been deployed yet, so every reader treats it as optional.
   */
  fields: ExtractedField[];
};

export async function pickImage(source: 'camera' | 'library'): Promise<PickedFile | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Expyr needs camera access to scan a document.'
        : 'Expyr needs photo access to read a screenshot.'
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, type: 'image', width: asset.width, height: asset.height };
}

/** Picks a PDF or image from Files, iCloud Drive, or anywhere else on the phone. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const type = fileTypeFor(asset.name ?? asset.uri, asset.mimeType ?? undefined);

  if (type === 'pdf' && (asset.size ?? 0) > MAX_PDF_BYTES) {
    throw new Error('That PDF is too large. Try one under 15 MB, or photograph the relevant page.');
  }

  return { uri: asset.uri, type, name: asset.name ?? undefined };
}

/** Downscales and compresses so both the upload and the stored copy stay small. */
async function processImage(file: PickedFile, includeBase64: boolean) {
  const longestEdge = Math.max(file.width ?? 0, file.height ?? 0);
  const actions: ImageManipulator.Action[] =
    longestEdge > MAX_EDGE
      ? [
          (file.width ?? 0) >= (file.height ?? 0)
            ? { resize: { width: MAX_EDGE } }
            : { resize: { height: MAX_EDGE } },
        ]
      : [];

  return ImageManipulator.manipulateAsync(file.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: includeBase64,
  });
}

/** Prepares a file for storage without spending an API call on it. */
export async function attachFile(file: PickedFile): Promise<string> {
  if (file.type === 'pdf') return file.uri;
  const processed = await processImage(file, false);
  return processed.uri;
}

async function readBase64(file: PickedFile): Promise<{ data: string; mediaType: string; uri: string }> {
  if (file.type === 'pdf') {
    // Imported lazily so the web bundle does not pull in native file APIs.
    const { File } = await import('expo-file-system');
    return {
      data: await new File(file.uri).base64(),
      mediaType: 'application/pdf',
      uri: file.uri,
    };
  }

  const processed = await processImage(file, true);
  if (!processed.base64) throw new Error('That image could not be read. Try another photo.');
  return { data: processed.base64, mediaType: 'image/jpeg', uri: processed.uri };
}

export async function scanFile(
  file: PickedFile,
  country: Country | null = null
): Promise<{ result: ScanResult; fileUri: string }> {
  const { data, mediaType, uri } = await readBase64(file);

  const result = await postJson<ScanResult>(
    '/extract',
    {
      imageBase64: data,
      mediaType,
      // Send the names this user will actually see, so the model classifies a
      // Kuwaiti civil ID as a National ID rather than reaching for "Emirates ID".
      categories: DOCUMENT_TYPES.map((t) => ({ id: t.id, label: labelFor(t, country) })),
    },
    {
      timeoutMs: TIMEOUT_MS,
      messages: {
        rateLimited: 'You have scanned a lot in a short time. Try again in a few minutes.',
        unauthorised: 'This copy of Expyr is not authorised to scan.',
        refused: 'The scanning service could not read that. Try another photo.',
        timedOut: 'Scanning took too long. Check your connection and try again.',
        unreachable: 'Could not reach the scanning service. Check your connection.',
      },
    }
  );

  // A category this build does not know about would break every screen that
  // looks one up, so an unfamiliar answer falls back rather than being trusted.
  const known = DOCUMENT_TYPES.some((t) => t.id === result.typeId);
  return {
    result: {
      ...result,
      typeId: known ? result.typeId : 'other',
      /*
       * Shaped here, at the edge, so no screen ever sees a raw transcription —
       * and so an older service that sends no fields at all becomes an empty
       * list rather than undefined.
       */
      fields: tidyFields(result.fields),
    },
    fileUri: uri,
  };
}

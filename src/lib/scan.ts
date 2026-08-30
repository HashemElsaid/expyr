import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { DOCUMENT_TYPES } from '@/data/document-types';
import { DocumentTypeId } from '@/types';

/** Claude downsamples anything larger, so sending more pixels just costs money. */
const MAX_EDGE = 1568;
const TIMEOUT_MS = 60_000;

export type PickedImage = { uri: string; width: number; height: number };

export type ScanResult = {
  found: boolean;
  typeId: DocumentTypeId;
  title: string;
  expiryDate: string;
  documentNumber: string;
  confidence: 'high' | 'medium' | 'low';
  note: string;
};

/**
 * In development the extraction service runs on the same machine as Metro, so
 * the phone can reach it at Metro's host on the service port — no config needed.
 */
function extractionEndpoint(): string {
  const explicit = process.env.EXPO_PUBLIC_EXTRACT_URL;
  if (explicit) return explicit;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8787/extract`;
}

export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Renewly needs camera access to scan a document.'
        : 'Renewly needs photo access to read a screenshot.'
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Downscales and compresses so both the upload and the stored copy stay small. */
async function processImage(image: PickedImage, includeBase64: boolean) {
  const longestEdge = Math.max(image.width, image.height);
  const actions: ImageManipulator.Action[] =
    longestEdge > MAX_EDGE
      ? [
          image.width >= image.height
            ? { resize: { width: MAX_EDGE } }
            : { resize: { height: MAX_EDGE } },
        ]
      : [];

  return ImageManipulator.manipulateAsync(image.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: includeBase64,
  });
}

/** Prepares a photo for storage without spending an API call on it. */
export async function attachImage(image: PickedImage): Promise<string> {
  const processed = await processImage(image, false);
  return processed.uri;
}

export async function scanImage(
  image: PickedImage
): Promise<{ result: ScanResult; imageUri: string }> {
  const processed = await processImage(image, true);

  if (!processed.base64) throw new Error('That image could not be read. Try another photo.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = process.env.EXPO_PUBLIC_SCAN_TOKEN;
    const response = await fetch(extractionEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-renewly-token': token } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: processed.base64,
        mediaType: 'image/jpeg',
        categories: DOCUMENT_TYPES.map((t) => ({ id: t.id, label: t.label })),
      }),
    });

    if (response.status === 429) {
      throw new Error('You have scanned a lot in a short time. Try again in a few minutes.');
    }
    if (response.status === 401) {
      throw new Error('This copy of Renewly is not authorised to scan.');
    }
    if (!response.ok) {
      throw new Error(`The scanning service returned an error (${response.status}).`);
    }

    const result = (await response.json()) as ScanResult;
    const known = DOCUMENT_TYPES.some((t) => t.id === result.typeId);
    return {
      result: known ? result : { ...result, typeId: 'other' },
      imageUri: processed.uri,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Scanning took too long. Check your connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Could not reach the scanning service. Make sure it is running on your computer.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { Attachment } from '@/types';

/**
 * Reading a document, so it can be asked questions.
 *
 * The transcript is taken once and kept on the phone, in the app's private
 * storage next to the photos. Questions then travel as text rather than as the
 * image, which is faster, far cheaper per question, and keeps the promise on
 * the privacy screen: what stays on the device stays on the device, and only
 * the question and the text needed to answer it ever leave.
 */

const FOLDER = 'reading';
const TIMEOUT_MS = 120_000;

export type Brief = {
  kind: string;
  summary: string;
  points: { label: string; detail: string; quote: string; where: string }[];
  watchOut: { detail: string; quote: string; where: string }[];
  obligations: { detail: string; daysBeforeEnd: number; quote: string }[];
};

export type Answer = {
  answered: boolean;
  answer: string;
  quote: string;
  where: string;
};

export type Turn = { question: string; answer: Answer };

function serviceBase(): string {
  const explicit = process.env.EXPO_PUBLIC_EXTRACT_URL;
  // The one configured URL points at /extract; the siblings sit beside it.
  if (explicit) return explicit.replace(/\/extract\/?$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8787`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = process.env.EXPO_PUBLIC_SCAN_TOKEN;
    const response = await fetch(`${serviceBase()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-expyr-token': token } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      throw new Error('You have asked a lot in a short time. Try again in a few minutes.');
    }
    if (response.status === 401) throw new Error('This copy of Expyr is not authorised.');
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? 'The reading service could not be reached.');
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'That took too long to read. Long or multi-page documents are the usual cause. Try again on a stronger connection, or photograph the pages that matter.'
      );
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the reading service. Check your connection.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- storage -- */

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

function transcriptFile(documentId: string): File {
  return new File(folder(), `${documentId}.txt`);
}

function briefFile(documentId: string): File {
  return new File(folder(), `${documentId}.brief.json`);
}

export function hasReading(documentId: string): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return transcriptFile(documentId).exists;
  } catch {
    return false;
  }
}

export function loadTranscript(documentId: string): string | null {
  if (Platform.OS === 'web') return null;
  try {
    const file = transcriptFile(documentId);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

export function loadBrief(documentId: string): Brief | null {
  if (Platform.OS === 'web') return null;
  try {
    const file = briefFile(documentId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as Brief;
  } catch {
    return null;
  }
}

function saveTranscript(documentId: string, transcript: string) {
  const t = transcriptFile(documentId);
  if (t.exists) t.delete();
  t.create();
  t.write(transcript);
}

function saveBrief(documentId: string, brief: Brief) {
  const b = briefFile(documentId);
  if (b.exists) b.delete();
  b.create();
  b.write(JSON.stringify(brief));
}

/** Called when a document is deleted, so its reading does not outlive it. */
export function deleteReading(documentId: string) {
  if (Platform.OS === 'web') return;
  try {
    const t = transcriptFile(documentId);
    if (t.exists) t.delete();
    const b = briefFile(documentId);
    if (b.exists) b.delete();
  } catch {
    // A stranded transcript is harmless; failing the delete is not worth raising.
  }
}

/* ----------------------------------------------------------------- reading */

export type ReadStage = 'transcribing' | 'summarising';

/**
 * Deliberately two requests rather than one, and the transcript is written to
 * disk the moment it exists.
 *
 * Transcribing a dense contract takes as long as everything else put together,
 * and the phone's own network stack gives up on a single request long before
 * our timeout does. Folding both steps into one call would make that one
 * request longer and lose everything when it failed. Split, the expensive half
 * is banked before the second half is attempted, so a failure costs the
 * summary rather than the whole document — and the transcript is what answers
 * questions, so the feature still works without it.
 */
export async function readDocumentFully(
  documentId: string,
  file: Attachment,
  onStage?: (stage: ReadStage) => void
): Promise<{ transcript: string; brief: Brief | null }> {
  if (Platform.OS === 'web') throw new Error('Reading is only available on the phone app.');

  const handle = new File(file.uri);
  if (!handle.exists) throw new Error('That attachment is missing from this phone.');

  onStage?.('transcribing');
  const { text } = await post<{ text: string }>('/read', {
    fileBase64: handle.base64Sync(),
    mediaType: file.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
  });

  if (!text || text.trim().length < 40) {
    throw new Error('There was not enough readable text in that document.');
  }
  saveTranscript(documentId, text);

  onStage?.('summarising');
  try {
    const brief = await post<Brief>('/brief', { text });
    saveBrief(documentId, brief);
    return { transcript: text, brief };
  } catch {
    // The reading survived, which is the part that took the time and the money.
    return { transcript: text, brief: null };
  }
}

/** Retries only the summary, for a document already transcribed. */
export async function summariseDocument(documentId: string): Promise<Brief> {
  const text = loadTranscript(documentId);
  if (!text) throw new Error('This document has not been read yet.');
  const brief = await post<Brief>('/brief', { text });
  saveBrief(documentId, brief);
  return brief;
}

/** Answers from the stored transcript. The document itself never travels again. */
export async function askAboutDocument(
  documentId: string,
  question: string,
  history: Turn[]
): Promise<Answer> {
  const text = loadTranscript(documentId);
  if (!text) throw new Error('This document has not been read yet.');

  return post<Answer>('/ask', {
    text,
    question,
    // Only the recent exchange is worth carrying, and the server trims further.
    history: history.slice(-6).map((t) => ({ question: t.question, answer: t.answer.answer })),
  });
}

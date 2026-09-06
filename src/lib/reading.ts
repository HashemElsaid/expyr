import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { postJson } from '@/lib/http';
import { Attachment, DocumentTypeId } from '@/types';

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
  /** Which document answered, when the question was put to more than one. */
  source?: string;
};

export type Turn = { question: string; answer: Answer };

/**
 * Every request this module makes, with the deadline and the words that suit
 * reading a whole document. Transcribing a dense contract takes far longer
 * than anything else the app asks for, and the phone's own network stack gives
 * up on a single request sooner than we would like.
 */
function post<T>(path: string, body: unknown): Promise<T> {
  return postJson<T>(path, body, {
    timeoutMs: TIMEOUT_MS,
    messages: {
      unauthorised: 'This copy of Expyr is not authorised.',
      refused: 'Expyr could not ask that just now. The reading service may need updating.',
      timedOut:
        'That took too long to read. Long or multi-page documents are the usual cause. Try again on a stronger connection, or photograph the pages that matter.',
    },
  });
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

function progressFile(documentId: string): File {
  return new File(folder(), `${documentId}.progress.json`);
}

/**
 * The batches already transcribed, keyed by the page each one starts at.
 *
 * A watermark would have done when batches ran one after another. They run at
 * once now and finish out of order, so what is banked is which batches came
 * back — not how far along a line the work has got.
 */
type Progress = { of: number; parts: Record<string, string> };

function loadProgress(documentId: string): Progress | null {
  if (Platform.OS === 'web') return null;
  try {
    const file = progressFile(documentId);
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync());
    if (typeof parsed?.of !== 'number' || typeof parsed?.parts !== 'object') return null;
    return parsed as Progress;
  } catch {
    return null;
  }
}

function saveProgress(documentId: string, progress: Progress) {
  try {
    const file = progressFile(documentId);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(progress));
  } catch {
    // Losing the marker costs a repeat, not the reading.
  }
}

function clearProgress(documentId: string) {
  try {
    const file = progressFile(documentId);
    if (file.exists) file.delete();
  } catch {
    // Harmless: the next read overwrites it.
  }
}

/**
 * Whether there is a *complete* transcript.
 *
 * The distinction matters now that a long PDF is written down as it goes. A
 * half-read contract on disk would otherwise look finished, and questions would
 * be answered from the pages that happened to arrive — confidently, and from
 * half the document.
 */
export function hasReading(documentId: string): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return transcriptFile(documentId).exists && loadProgress(documentId) === null;
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

/**
 * How many exchanges are kept on disk.
 *
 * Generous, because the file is small and the request is not: askDocuments
 * only ever sends the last six turns, so a long history costs storage rather
 * than tokens. This is the point at which a conversation stops being one.
 */
const MAX_STORED_TURNS = 40;

function turnsFile(scope: string): File {
  return new File(folder(), `${scope}.turns.json`);
}

/**
 * The conversation, kept beside the reading it is about.
 *
 * Every answer costs one of the day's questions and about ten seconds, and a
 * reload threw all of them away — including the thread the next question is
 * asked against, since the history travels with it. Nobody expects a chat to
 * survive a reload until it does not.
 *
 * Scoped the way the screen scopes it: one document, or 'all' when the
 * question was put to everything, because a different set of documents is a
 * different conversation.
 */
export function loadTurns(scope: string): Turn[] {
  if (Platform.OS === 'web') return [];
  try {
    const file = turnsFile(scope);
    if (!file.exists) return [];
    const parsed = JSON.parse(file.textSync());
    return Array.isArray(parsed) ? (parsed as Turn[]) : [];
  } catch {
    // A conversation that will not parse is one the app starts again.
    return [];
  }
}

export function saveTurns(scope: string, turns: Turn[]) {
  if (Platform.OS === 'web') return;
  try {
    const file = turnsFile(scope);
    if (file.exists) file.delete();
    if (turns.length === 0) return;
    file.create();
    file.write(JSON.stringify(turns.slice(-MAX_STORED_TURNS)));
  } catch {
    // It is still on screen. Failing to save it is not worth an alert.
  }
}

/** Called when a document is deleted, so its reading does not outlive it. */
export function deleteReading(documentId: string) {
  if (Platform.OS === 'web') return;
  try {
    const t = transcriptFile(documentId);
    if (t.exists) t.delete();
    const b = briefFile(documentId);
    if (b.exists) b.delete();
    // The conversation went with the document it was about.
    const c = turnsFile(documentId);
    if (c.exists) c.delete();
    const p = progressFile(documentId);
    if (p.exists) p.delete();
  } catch {
    // A stranded transcript is harmless; failing the delete is not worth raising.
  }
}

/* ----------------------------------------------------------------- reading */

export type ReadStage = 'transcribing' | 'summarising';

/** How far through a long document the reading has got. */
export type ReadProgress = { page: number; of: number };

/**
 * Pages per request.
 *
 * There is no page range in the model's PDF support, so the service cuts a
 * real sub-document for each batch. Four is where two costs meet: few enough
 * that a batch finishes in the time a phone will hold a connection, and that
 * its transcript clears the response ceiling comfortably; many enough that a
 * fourteen-page contract is four requests rather than fourteen.
 */
const PAGES_PER_BATCH = 4;

/**
 * How many batches are in the air together.
 *
 * Three, not four. Four was chosen so a fourteen-page contract would be one
 * round of batches, which was the right idea measured against the wrong thing:
 * every batch re-sends the whole file, so four at once means four uploads
 * sharing one uplink, and the slowest of them times out having spent its
 * budget on bytes rather than pages. Three leaves the connection room, and
 * anything that still fails is retried alone.
 */
const BATCH_CONCURRENCY = 3;

/**
 * Which documents are worth reading unprompted.
 *
 * An Emirates ID, a passport, a Mulkiya are cards: a handful of fields the scan
 * already captured, with no terms to explain and nothing to ask about. Reading
 * one costs money and answers nothing. The documents nobody reads and everybody
 * signs are the contracts and policies, so those are read on arrival and the
 * rest stay available on request.
 */
const READ_ON_ARRIVAL: DocumentTypeId[] = [
  'tenancy-ejari',
  'car-insurance',
  'health-insurance',
  'trade-license',
  'labor-card',
  'membership',
  'warranty',
  'other',
];

export function readsOnArrival(typeId: DocumentTypeId): boolean {
  return READ_ON_ARRIVAL.includes(typeId);
}

/**
 * Reading is slow and costs money, and two screens can both decide it is time:
 * the add screen starts one in the background, then the document screen opens
 * on the same unread contract. The work in progress is held here so the second
 * caller joins the first rather than paying for it twice.
 */
const inFlight = new Map<string, Promise<{ transcript: string; brief: Brief | null }>>();

export function isReading(documentId: string): boolean {
  return inFlight.has(documentId);
}

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
export function readDocumentFully(
  documentId: string,
  file: Attachment,
  onStage?: (stage: ReadStage, progress?: ReadProgress) => void
): Promise<{ transcript: string; brief: Brief | null }> {
  const existing = inFlight.get(documentId);
  if (existing) {
    // Already running. Report the stage it is most likely at and wait on it.
    onStage?.(hasReading(documentId) ? 'summarising' : 'transcribing');
    return existing;
  }

  const work = runRead(documentId, file, onStage).finally(() => inFlight.delete(documentId));
  inFlight.set(documentId, work);
  return work;
}

/**
 * A long PDF, read a few pages at a time.
 *
 * One request for a fourteen-page tenancy contract was tens of thousands of
 * tokens of generation: over two minutes, past the response ceiling, and past
 * the point the phone had given up — all behind a spinner that said nothing.
 * Cut into batches, each request finishes in the time a phone will wait, the
 * work is visible while it happens, and a failure costs one batch instead of
 * the document.
 *
 * The file goes up with every batch. That is the deliberately wasteful half of
 * the design: the service could hold it between calls and save the bandwidth,
 * but then it would be holding somebody's tenancy contract, and the app
 * promises in writing that it does not.
 */
/**
 * A long PDF, read a few pages at a time — all of them at once.
 *
 * Written first as a loop, which was the obvious shape and the wrong one. The
 * batches do not depend on each other: read sequentially, fourteen pages cost
 * four round trips end to end, and nobody waits four minutes for a tenancy
 * contract. Run together, fourteen pages cost about as long as four do.
 *
 * The page count comes from a route that only counts pages, so the fan-out can
 * start immediately rather than waiting on a first transcription to discover
 * how much work there is.
 */
async function readPdfInBatches(
  documentId: string,
  fileBase64: string,
  onStage?: (stage: ReadStage, progress?: ReadProgress) => void
): Promise<string> {
  /*
   * A service without /pages is one deployed before batching existed. Reading
   * the document whole is what it would have done anyway, and is what it is
   * still able to do — better a slow read than a route that 404s the feature
   * during the minutes between a push and a deploy.
   */
  let total: number;
  try {
    const counted = await post<{ pageCount: number }>('/pages', {
      fileBase64,
      mediaType: 'application/pdf',
    });
    total = counted.pageCount;
  } catch {
    const whole = await post<{ text: string }>('/read', {
      fileBase64,
      mediaType: 'application/pdf',
    });
    clearProgress(documentId);
    return whole.text;
  }

  const previous = loadProgress(documentId);
  const parts: Record<string, string> =
    previous && previous.of === total ? { ...previous.parts } : {};

  const starts: number[] = [];
  for (let from = 1; from <= total; from += PAGES_PER_BATCH) starts.push(from);

  /* Pages banked so far, whichever batches they came from. */
  const readSoFar = () =>
    Math.min(total, Object.keys(parts).length * PAGES_PER_BATCH);

  onStage?.('transcribing', { page: readSoFar(), of: total });

  const pending = starts.filter((from) => parts[String(from)] === undefined);
  let next = 0;
  const failed: number[] = [];

  async function fetchBatch(from: number) {
    const batch = await post<{ text: string; pageCount?: number }>('/read', {
      fileBase64,
      mediaType: 'application/pdf',
      pages: { from, to: from + PAGES_PER_BATCH - 1 },
    });

    parts[String(from)] = batch.text;
    onStage?.('transcribing', { page: readSoFar(), of: total });
    // Banked as it lands, so a failure elsewhere does not buy these pages again.
    saveProgress(documentId, { of: total, parts });
  }

  /*
   * Three at a time, and a batch that fails does not take the others with it.
   *
   * Observed on a fourteen-page contract: three batches landed and the fourth
   * timed out. Nothing was wrong with those two pages — every batch carries the
   * whole file, so four uploads share one phone's uplink, and the last one to
   * get its bytes out has spent most of its ninety seconds before the model
   * sees anything. Concurrency was helping the model and hurting the upload.
   */
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= pending.length) return;
      const from = pending[index];
      try {
        await fetchBatch(from);
      } catch {
        // Collected, not thrown: the batches still in flight are worth having.
        failed.push(from);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, pending.length) }, worker)
  );

  /*
   * The second pass runs them one at a time, which is the whole point: a batch
   * that lost the race for the uplink gets it to itself. Only a batch that
   * fails alone, with nothing to compete against, is a real failure.
   */
  for (const from of failed) {
    await fetchBatch(from);
  }

  const transcript = starts.map((from) => parts[String(from)] ?? '').join('\n\n');
  clearProgress(documentId);
  return transcript;
}

async function runRead(
  documentId: string,
  file: Attachment,
  onStage?: (stage: ReadStage, progress?: ReadProgress) => void
): Promise<{ transcript: string; brief: Brief | null }> {
  if (Platform.OS === 'web') throw new Error('Reading is only available on the phone app.');

  const handle = new File(file.uri);
  if (!handle.exists) throw new Error('That attachment is missing from this phone.');

  onStage?.('transcribing');

  /*
   * An image is one page by definition, and already downscaled on the way into
   * storage, so it goes as it always did. Only a PDF has pages to divide.
   */
  const text =
    file.type === 'pdf'
      ? await readPdfInBatches(documentId, handle.base64Sync(), onStage)
      : (
          await post<{ text: string }>('/read', {
            fileBase64: handle.base64Sync(),
            mediaType: 'image/jpeg',
          })
        ).text;

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
    // The reading survived, which is the slow and costly half.
    return { transcript: text, brief: null };
  }
}

/**
 * Reads a newly saved contract without being asked, and without the person
 * waiting on it. Saving must not hang or fail because a network call did, so
 * anything that goes wrong here is left for the document screen to offer again.
 */
export function readInBackground(
  documentId: string,
  typeId: DocumentTypeId,
  files: Attachment[],
  onRead?: () => void
): void {
  if (Platform.OS === 'web') return;
  if (!readsOnArrival(typeId)) return;
  if (files.length === 0) return;
  if (inFlight.has(documentId) || hasReading(documentId)) return;

  readDocumentFully(documentId, files[0])
    // Only a reading that produced something counts against the allowance. A
    // failure delivered nothing, so it should not be charged for.
    .then(() => onRead?.())
    .catch((error) => {
      // Silent on purpose. Nobody asked for this yet, so nobody should be
      // interrupted when it fails — but it still says so where a developer
      // can see it. The message only; never the document.
      console.warn(
        '[reading] background read failed:',
        error instanceof Error ? error.message : String(error)
      );
    });
}

/** Retries only the summary, for a document already transcribed. */
export async function summariseDocument(documentId: string): Promise<Brief> {
  const text = loadTranscript(documentId);
  if (!text) throw new Error('This document has not been read yet.');
  const brief = await post<Brief>('/brief', { text });
  saveBrief(documentId, brief);
  return brief;
}

/**
 * The most documents one question can be put to. Twelve contracts is already
 * more paperwork than a household has, and the wait grows with every one.
 */
const MAX_ASK_DOCUMENTS = 12;

/** Which of these documents have been read, and can therefore be asked. */
export function readable<T extends { id: string }>(documents: T[]): T[] {
  return documents.filter((doc) => hasReading(doc.id));
}

/**
 * Answers from the stored transcripts. The documents themselves never travel
 * again: only the text Expyr already holds, and only for what was asked.
 */
export async function askDocuments(
  entries: { id: string; title: string }[],
  question: string,
  history: Turn[],
  /*
   * Everything Expyr tracks, in one line each — including the items it has
   * never read. Their dates were scanned or typed by the user, so they are the
   * right answer to "when does my tenancy expire" even when no transcript
   * mentions it, and without them the app knows something it will not say.
   */
  records: string[] = []
): Promise<Answer> {
  const documents = entries
    .slice(0, MAX_ASK_DOCUMENTS)
    .map((entry) => ({ title: entry.title, text: loadTranscript(entry.id) }))
    .filter((doc): doc is { title: string; text: string } => Boolean(doc.text));

  if (documents.length === 0 && records.length === 0) {
    throw new Error('There is nothing to ask about yet.');
  }

  return post<Answer>('/ask', {
    documents,
    records,
    /*
     * The same question in the shape the old service understands. A phone
     * updates the moment it opens the App Store; the service updates when
     * somebody deploys it, and between those two moments this is the
     * difference between one document answering and an error. Costs one
     * repeated field, and the new service ignores it.
     */
    ...(documents.length === 1 ? { text: documents[0].text } : {}),
    question,
    // Only the recent exchange is worth carrying, and the server trims further.
    history: history.slice(-6).map((t) => ({ question: t.question, answer: t.answer.answer })),
  });
}

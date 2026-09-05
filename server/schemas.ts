import { z } from 'zod';

import { invalid } from './errors.ts';

/**
 * What each route will accept, declared rather than checked by hand.
 *
 * These were four hand-written parsers with their own ideas about what was
 * required, their own error strings, and their own places to forget a bound.
 * zod was already a dependency — it shapes the model's output — so the same
 * tool now guards the way in. Every ceiling below is a real one: they are what
 * stops a single request costing more than a day's budget.
 */

export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

/**
 * An unfamiliar media type falls back to JPEG rather than being refused. Older
 * builds send whatever they were told by the picker, and a photograph that
 * arrives labelled `image/heic` is still a photograph.
 */
const mediaType = z
  .string()
  .optional()
  .transform((value): SupportedMediaType =>
    SUPPORTED_MEDIA_TYPES.includes(value as SupportedMediaType)
      ? (value as SupportedMediaType)
      : 'image/jpeg'
  );

/**
 * A transcript is long, but not unbounded. Generous for a multi-page tenancy
 * contract and still a refusal for anything that looks like a paste attack.
 */
const MAX_TEXT_CHARS = 400_000;
const MAX_QUESTION_CHARS = 2_000;
/** At most this many documents in one question, so a large file cannot stall. */
const MAX_ASK_DOCUMENTS = 12;
/**
 * A question carries every document at once, so its ceiling is lower than the
 * one for reading a single file. Roughly forty thousand tokens: several long
 * contracts, and nowhere near enough room to use this as a general chatbot.
 */
const MAX_ASK_CHARS = 150_000;
/** One line per tracked item; enough for a household, capped so it stays small. */
const MAX_RECORDS = 60;
const MAX_RECORD_CHARS = 300;
/** Only the recent exchange is worth carrying. */
const MAX_HISTORY = 6;

export const ExtractRequest = z.object({
  imageBase64: z.string().min(1),
  mediaType,
  categories: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        hint: z.string().optional(),
      })
    )
    .min(1),
});
export type ExtractRequest = z.infer<typeof ExtractRequest>;

export const FileRequest = z.object({
  fileBase64: z.string().min(1),
  mediaType,
});
export type FileRequest = z.infer<typeof FileRequest>;

export const TextRequest = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
});
export type TextRequest = z.infer<typeof TextRequest>;

const AskDocument = z.object({ title: z.string(), text: z.string().trim().min(1) });

/**
 * Two shapes, because a phone updates when somebody opens the App Store and
 * this service updates when somebody deploys it. Between those two moments an
 * older build is still asking the only way it knows how, and the difference
 * between the shapes is the difference between an answer and an error.
 */
export const AskRequest = z
  .object({
    /** The single-document shape older builds send. */
    text: z.string().optional(),
    documents: z.array(AskDocument).optional(),
    records: z.array(z.string()).optional(),
    question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
    history: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .optional(),
  })
  .transform((body) => ({
    documents: (body.documents ?? (body.text ? [{ title: '', text: body.text }] : [])).slice(
      0,
      MAX_ASK_DOCUMENTS
    ),
    records: (body.records ?? [])
      .filter((record) => record.trim().length > 0)
      .slice(0, MAX_RECORDS)
      .map((record) => record.slice(0, MAX_RECORD_CHARS)),
    question: body.question,
    history: (body.history ?? []).slice(-MAX_HISTORY),
  }))
  .refine((body) => body.documents.length > 0 || body.records.length > 0, {
    // A question about dates needs no transcript, only Expyr's own file.
    message: 'There is nothing to answer from.',
  })
  .refine(
    (body) => body.documents.reduce((sum, doc) => sum + doc.text.length, 0) <= MAX_ASK_CHARS,
    { message: 'That is more text than we can read at once.' }
  );
export type AskRequest = z.infer<typeof AskRequest>;

/**
 * Parses a body against a schema, or raises the one error the app knows how to
 * present. The reason for failure is deliberately not relayed: it names fields
 * of a request the person holding the phone never wrote, and it can quote the
 * values in them.
 */
export function parse<T>(schema: z.ZodType<T>, raw: string): T {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw invalid('That request could not be read.');
  }

  const result = schema.safeParse(body);
  if (!result.success) throw invalid('That request could not be read.');
  return result.data;
}

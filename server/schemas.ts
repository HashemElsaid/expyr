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

/**
 * The model's own hard ceiling for a single PDF. A range beyond it could never
 * name a real page, so it is rejected at the edge rather than carried inward.
 */
const MAX_PDF_PAGES = 100;
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

/**
 * A Sign in with Apple identity token, unverified. Everything that makes it
 * trustworthy happens in apple-identity.ts; this only says it is a string of a
 * plausible size, so a megabyte of nonsense is refused before any crypto runs.
 */
export const IdentityRequest = z.object({
  identityToken: z.string().min(1).max(8_192),
});
export type IdentityRequest = z.infer<typeof IdentityRequest>;

/**
 * A purchase the phone says Apple just made.
 *
 * Every field here is a claim, and none of them is believed. The transaction
 * identifier is the only one that is used: it is what Apple is asked about,
 * and Apple's answer supplies the product and everything else. The product and
 * the token are carried for the log and for the error message when the two
 * disagree.
 */
export const RedeemRequest = z.object({
  transactionId: z.string().min(1).max(64),
  productId: z.string().min(1).max(128),
  token: z.string().max(16_384).nullish(),
  sandbox: z.boolean().optional(),
});
export type RedeemRequest = z.infer<typeof RedeemRequest>;

export const FileRequest = z.object({
  fileBase64: z.string().min(1),
  mediaType,
  /**
   * Which pages to read, counted from 1 and including both ends.
   *
   * Optional, and deliberately: a phone updates when somebody opens the App
   * Store and this service updates when somebody deploys it. A build that
   * predates batching sends no range and still gets the whole document read,
   * exactly as it did before.
   */
  pages: z
    .object({
      from: z.number().int().min(1).max(MAX_PDF_PAGES),
      to: z.number().int().min(1).max(MAX_PDF_PAGES),
    })
    .optional(),
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
 * What may be asked about, and nothing else.
 *
 * This one is stricter than the rest, and the reason is money. Each new
 * combination that is not already cached costs a live web search, so the set of
 * things that can be asked about has to be finite and small. A free-text region
 * would let one leaked app token mint an unbounded number of them.
 *
 * So: a category id in the app's own slug shape, a two-letter country code, and
 * an optional region that must also be a short slug. That bounds the key space
 * at a few thousand, and the per-day ceiling on new generations bounds the
 * spend inside that.
 */
export const GuidanceRequest = z.object({
  typeId: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,39}$/, 'typeId')
    .transform((value) => value.toLowerCase()),
  /** What it is called where the user is — shown to the model, not part of the key. */
  label: z.string().trim().min(1).max(60),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'country')
    .transform((value) => value.toLowerCase()),
  countryName: z.string().trim().min(1).max(60),
  region: z
    .string()
    .max(40)
    .optional()
    .transform((value) => (value ?? '').trim())
    .refine((value) => value === '' || /^[a-z][a-z0-9 '-]{1,39}$/i.test(value), 'region'),
  /**
   * The service a subscription is with, when this is one.
   *
   * Present, this changes the question entirely: not "how is this renewed in
   * this jurisdiction" but "how does somebody cancel or change this service" —
   * which is the same answer in Dubai and Dublin, and has nothing to do with
   * the authority that renews visas.
   *
   * Bounded like everything else here, because it becomes part of a cache key
   * and an unbounded key is an unbounded number of web searches.
   */
  service: z
    .string()
    .max(40)
    .optional()
    .transform((value) => (value ?? '').trim().toLowerCase())
    .refine((value) => value === '' || /^[a-z0-9][a-z0-9.-]{0,39}$/.test(value), 'service'),
});
export type GuidanceRequest = z.infer<typeof GuidanceRequest>;

/**
 * The cache key, and the whole of what a cached entry is keyed on. Nothing
 * about the person asking is in it, which is what makes one entry serveable to
 * everybody who asks the same question.
 */
export function guidanceKey(request: GuidanceRequest): string {
  const region = request.region.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  /*
   * A subscription is keyed on the service rather than on the category, because
   * that is what the answer is actually about. Every person tracking iCloud+
   * shares one entry, and it is not the same entry as the one for Netflix — the
   * old key made both of them "membership in the UAE" and served them the same
   * paragraph about gyms.
   *
   * The country stays in it. Most services answer the same everywhere, but a
   * gym is also a subscription and its notice period is entirely local.
   */
  if (request.service) {
    const service = request.service.replace(/[^a-z0-9]+/g, '-');
    return ['sub', service, request.country, region].filter(Boolean).join('.');
  }

  return [request.typeId, request.country, region].filter(Boolean).join('.');
}

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

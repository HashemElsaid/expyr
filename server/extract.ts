import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/**
 * Built on first use, not at import, so the server still starts (and can report
 * a clear error) when the key is missing. The key never reaches the phone —
 * that is the whole point of this service.
 */
let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) {
    // Identity-linked (user) API keys are rejected unless the request names the
    // workspace it acts in. Workspace-scoped keys don't need this.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    cachedClient = new Anthropic(
      workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}
    );
  }
  return cachedClient;
}

/** Override with EXPYR_MODEL to trade cost for accuracy (e.g. claude-opus-5). */
const MODEL = process.env.EXPYR_MODEL ?? 'claude-haiku-4-5';

/**
 * `output_config.effort` is rejected outright by the older small models, so it
 * can only be sent to models known to accept it.
 */
export const EFFORT_CAPABLE = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
];

/**
 * One thing the document says about itself.
 *
 * `kind` is not decoration. It decides how the app treats the value: a number
 * gets a copy button because the thing people do with an Emirates ID number is
 * paste it into a government form, a money field is searched and totalled
 * differently from a name, and a date is not turned into a reminder unless the
 * app asked for one. Left as a small closed set on purpose — an open
 * vocabulary would drift into forty synonyms for "number".
 */
export const FieldSchema = z.object({
  /** How it should read on screen, in the user's words: "Issuing authority". */
  label: z.string(),
  /** Exactly as printed. Never normalised, never reformatted, never guessed. */
  value: z.string(),
  kind: z.enum(['name', 'number', 'date', 'money', 'place', 'other']),
});

export type ExtractedField = z.infer<typeof FieldSchema>;

/**
 * Every field is required with an empty-string sentinel rather than optional —
 * strict structured outputs are happier with a fixed shape.
 */
export const ExtractionSchema = z.object({
  found: z.boolean(),
  typeId: z.string(),
  title: z.string(),
  expiryDate: z.string(),
  documentNumber: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string(),
  /**
   * Everything else the document says. The app was built around one date, which
   * meant a scan produced nothing a person could use until the day it mattered
   * — sometimes years later. This is what makes the scan worth something the
   * moment it happens.
   */
  fields: z.array(FieldSchema),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type Category = { id: string; label: string; hint?: string };

function buildSystemPrompt(today: string, categories: Category[]): string {
  const list = categories
    .map((c) => `- ${c.id}: ${c.label}${c.hint ? ` — ${c.hint}` : ''}`)
    .join('\n');

  return `You read expiry dates out of photos of documents for Expyr, an app that tracks documents so they get renewed before they lapse. Most users live in the Gulf.

Today's date is ${today}.

The user has photographed or uploaded one item. It is usually one of:
- an official document (Emirates ID, residence visa, passport, car registration/Mulkiya, insurance policy, tenancy contract, driving licence, trade licence)
- a warranty card, membership card, or subscription receipt
- a screenshot of an email or portal page stating when one of the above expires
- a PDF such as a tenancy contract, insurance policy or licence certificate

Return exactly one item: the single most important date on it.

Rules:
- expiryDate is the date the item EXPIRES or falls DUE, formatted YYYY-MM-DD. Never return an issue date, a date of birth, or a manufacture date. When several dates appear, choose the one that answers "when does this stop being valid, or when is this due".
- Dates in the Gulf are usually written day-first. Read 03/09/2027 as 3 September 2027, not 9 March.
- Ignore any time of day attached to a date and keep only the date itself.
- In multi-page contracts and policies, the date that matters is when cover or tenancy ENDS, not when it started and not when the document was signed. A tenancy contract running "01/09/2026 to 31/08/2027" expires on 31 August 2027.
- typeId must be one of the ids listed below. Use "other" only when nothing else fits.
- title is a short human name the user will recognise in a list, such as "Emirates ID", "Toyota Corolla registration", or "Marina Heights tenancy". Include a distinguishing detail when the photo shows one. Never put the date in the title.
- documentNumber only when an official number is clearly legible AND the category is one that actually carries a number. Otherwise return an empty string. Never guess digits that are blurred or cropped.
- confidence is "high" only when you read the date clearly and are certain it is the expiry or due date.
- note is one short plain-language sentence telling the user which date you used. No jargon.
- Always return the date even when it has already passed. Expyr deliberately tracks expired items so the user can renew or discard them, so a past date is a correct answer with found set to true. Never reject an item for being out of date.
- Set found to false only when no expiry or due date is legible anywhere in the image. In that case set expiryDate to an empty string and use note to say what you saw instead.

fields is everything else the document states about itself, so that a person gets something useful out of the scan today rather than only on the day it expires.

- Never use an em dash in a label or a value. Use a full stop, a comma, or a colon.
- Include what somebody would actually want back later: the full name as printed, the document or policy or account number, who issued it, the place it was issued, the dates it carries other than the expiry, and any amount of money on it — a premium, a rent, a subscription price, a fee.
- Include the issue date and any start date as their own fields. They are useful and they are not the expiry.
- label is what a person would call it: "Full name", "Issuing authority", "Policy number", "Annual rent", "Date of birth". Sentence case, no colon, no abbreviations they would have to decode.
- value is exactly as printed on the document. Do not reformat a date, do not add or remove spaces in a number, do not expand an abbreviation, do not convert a currency. If it is written "AED 4,500 / year", that is the value.
- kind: name for people and organisations, number for reference and account numbers, date for any date, money for any amount with a currency, place for addresses and cities and countries, other for everything else.
- Repeat the name and the number here even though they may also appear above. This list is the document as it reads; the app decides what to show twice.
- Nothing you cannot actually see. A field you are unsure of is a field you leave out — a wrong name or a mistyped number is worse than a short list, because a person will copy it into a government form without checking.
- Leave fields empty rather than padding it with the obvious. "Document type: passport" tells nobody anything.

Never invent information that is not visible in the image.

Categories:
${list}`;
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'application/pdf';

export async function extractFromImage(opts: {
  imageBase64: string;
  mediaType: SupportedMediaType;
  categories: Category[];
}): Promise<Extraction> {
  const today = new Date().toISOString().slice(0, 10);

  // PDFs go in as a document block; photos as an image block.
  const attachment =
    opts.mediaType === 'application/pdf'
      ? ({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: opts.imageBase64,
          },
        } as const)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: opts.mediaType,
            data: opts.imageBase64,
          },
        } as const);

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: buildSystemPrompt(today, opts.categories),
    output_config: {
      // Keeps thinking tokens down on the models that support it; omitted elsewhere.
      ...(EFFORT_CAPABLE.includes(MODEL) ? { effort: 'low' as const } : {}),
      format: zodOutputFormat(ExtractionSchema),
    },
    messages: [
      {
        role: 'user',
        content: [
          attachment,
          {
            type: 'text',
            text:
              opts.mediaType === 'application/pdf'
                ? 'Extract the expiry date from this document. Contracts often state a start and an end date — return the end date.'
                : 'Extract the expiry date from this image.',
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    return {
      found: false,
      typeId: 'other',
      title: '',
      expiryDate: '',
      documentNumber: '',
      confidence: 'low',
      note: "This image couldn't be processed. Try entering the details by hand.",
      fields: [],
    };
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Model response did not match the expected schema');
  }
  return parsed;
}

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

/** Override with RENEWLY_MODEL to trade cost for accuracy (e.g. claude-opus-5). */
const MODEL = process.env.RENEWLY_MODEL ?? 'claude-haiku-4-5';

/**
 * `output_config.effort` is rejected outright by the older small models, so it
 * can only be sent to models known to accept it.
 */
const EFFORT_CAPABLE_MODELS = [
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
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type Category = { id: string; label: string; hint?: string };

function buildSystemPrompt(today: string, categories: Category[]): string {
  const list = categories
    .map((c) => `- ${c.id}: ${c.label}${c.hint ? ` — ${c.hint}` : ''}`)
    .join('\n');

  return `You read expiry dates and deadlines out of photos for Renewly, an app that tracks anything that expires or falls due. Most users live in the UAE.

Today's date is ${today}.

The user has photographed one item. It is usually one of:
- an official document (Emirates ID, residence visa, passport, car registration/Mulkiya, insurance policy, tenancy contract, driving licence, trade licence)
- a product with a printed date (food packaging, supplements, medicine)
- a screenshot of an email or course portal announcing an assignment, quiz, or exam

Return exactly one item: the single most important date on it.

Rules:
- expiryDate is the date the item EXPIRES or falls DUE, formatted YYYY-MM-DD. Never return an issue date, a date of birth, or a manufacture date. When several dates appear, choose the one that answers "when does this stop being valid, or when is this due".
- Dates in the Gulf are usually written day-first. Read 03/09/2027 as 3 September 2027, not 9 March.
- On food and supplements use "Best before", "Use by", "EXP" or "Expiry". If both a best-before and a use-by date appear, use the use-by date.
- On assignment or exam screenshots use the due or submission date. Ignore any time of day and keep only the date.
- typeId must be one of the ids listed below. Use "other" only when nothing else fits.
- title is a short human name the user will recognise in a list, such as "Emirates ID", "Toyota Corolla registration", "Al Ain full cream milk", or "CS101 midterm". Include a distinguishing detail when the photo shows one. Never put the date in the title.
- documentNumber only when an official number is clearly legible AND the category is one that actually carries a number. Otherwise return an empty string. Never guess digits that are blurred or cropped.
- confidence is "high" only when you read the date clearly and are certain it is the expiry or due date.
- note is one short plain-language sentence telling the user which date you used. No jargon.
- Always return the date even when it has already passed. Renewly deliberately tracks expired items so the user can renew or discard them, so a past date is a correct answer with found set to true. Never reject an item for being out of date.
- Set found to false only when no expiry or due date is legible anywhere in the image. In that case set expiryDate to an empty string and use note to say what you saw instead.

Never invent information that is not visible in the image.

Categories:
${list}`;
}

export async function extractFromImage(opts: {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  categories: Category[];
}): Promise<Extraction> {
  const today = new Date().toISOString().slice(0, 10);

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: buildSystemPrompt(today, opts.categories),
    output_config: {
      // Keeps thinking tokens down on the models that support it; omitted elsewhere.
      ...(EFFORT_CAPABLE_MODELS.includes(MODEL) ? { effort: 'low' as const } : {}),
      format: zodOutputFormat(ExtractionSchema),
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: opts.mediaType,
              data: opts.imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract the expiry date or deadline from this image.',
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
    };
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Model response did not match the expected schema');
  }
  return parsed;
}

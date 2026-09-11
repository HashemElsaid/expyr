import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { parseMrz } from './mrz.ts';

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

/**
 * Sonnet 5, because the product is "it read the document right".
 *
 * This ran on Haiku 4.5 until three people in one afternoon scanned a
 * passport and got back an Emirates ID once and a residence visa twice. One
 * entry read "Residence Visa for AEHED SAID SHERIF", which is the wrong
 * category, the wrong guidance, the wrong lead time and a misspelled name in
 * one row. The prompt was part of it and is fixed below; the model was the
 * other part.
 *
 * About $0.015 a scan against $0.003. Ten free scans is $0.15 an install at
 * worst, against a one-off purchase clearing AED 120. Costed in
 * `business/MONEY.md`. Override with EXPYR_MODEL to trade it back.
 */
const MODEL = process.env.EXPYR_MODEL ?? 'claude-sonnet-5';

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
  /** How sure it is of the date. */
  confidence: z.enum(['high', 'medium', 'low']),
  /**
   * How sure it is of the category, which is a different question.
   *
   * Its own field rather than a share of `confidence`, because the two were
   * wrong in opposite directions on the scan that started this: the date was
   * read perfectly off a passport and the category was a residence visa. One
   * number covering both would have read "high" and interrupted nobody.
   *
   * A wrong category is wrong renewal guidance, a wrong lead time and a wrong
   * title, so anything short of high is worth one question before the form.
   */
  typeConfidence: z.enum(['high', 'medium', 'low']),
  /**
   * The machine-readable zone, transcribed character for character.
   *
   * Not for the user. `mrz.ts` parses it, checks it against its own check
   * digits and uses it to spell the name and read the expiry, both of which a
   * model reads more reliably from a monospaced strip designed for machines
   * than from a stylised line over a watermark.
   */
  mrz: z.string(),
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

WHAT THE OBJECT IS, BEFORE WHAT IT SAYS

Decide the category from the physical object in the picture, then read the
dates off it. Doing it the other way round is what makes a passport come back
as a residence visa: a passport data page names a nationality, and a residence
sticker or a visa page is often on the same spread, printed in bigger words
than the booklet it is stuck into.

The tells, which are about the object rather than the vocabulary:

- A PASSPORT is the data page of a booklet. Two machine-readable lines at the
  bottom, 44 characters each, the first beginning with P followed by <. It is
  still a passport when it names a nationality, when a visa or residence permit
  is on the facing page, and when that visa is the part in focus. Two MRZ lines
  beginning P< settle it.
- An EMIRATES ID is a plastic card headed UNITED ARAB EMIRATES and IDENTITY
  CARD, carrying a 15 digit number beginning 784, and on the back three
  machine-readable lines of 30 characters beginning with I followed by <. A
  card, never a page of a booklet.
- A RESIDENCE VISA is a passport page or an e-visa printout carrying a UID, a
  file number, a sponsor or employer, and the word RESIDENCE. It is the
  permission rather than the booklet: the printout has no MRZ of its own, and
  its fields say who is sponsoring whom.
- A DRIVING LICENCE is a card with a licence number, a traffic code or place of
  issue, and vehicle classes. No MRZ.
- A MULKIYA is a card or printout naming a plate number, a chassis or VIN, a
  make and model, and an owner.

When two of these are in one picture, the item is the one the photograph is of.
A passport data page photographed with a visa beside it is a passport.

Rules:
- expiryDate is the date the item EXPIRES or falls DUE, formatted YYYY-MM-DD. Never return an issue date, a date of birth, or a manufacture date. When several dates appear, choose the one that answers "when does this stop being valid, or when is this due".
- Dates in the Gulf are usually written day-first. Read 03/09/2027 as 3 September 2027, not 9 March.
- Ignore any time of day attached to a date and keep only the date itself.
- In multi-page contracts and policies, the date that matters is when cover or tenancy ENDS, not when it started and not when the document was signed. A tenancy contract running "01/09/2026 to 31/08/2027" expires on 31 August 2027.
- typeId must be one of the ids listed below. Use "other" only when nothing else fits.
- title is a short human name the user will recognise in a list, such as "Emirates ID", "Toyota Corolla registration", or "Marina Heights tenancy". Include a distinguishing detail when the photo shows one. Never put the date in the title.
- documentNumber only when an official number is clearly legible AND the category is one that actually carries a number. Otherwise return an empty string. Never guess digits that are blurred or cropped.
- confidence is "high" only when you read the date clearly and are certain it is the expiry or due date.
- typeConfidence is about the category alone and says nothing about the date. "high" when the tells above settle what the object is. "medium" or "low" when you are working from the words rather than the object: a title you are inferring from, two documents on one page, a crop that cuts off the machine-readable lines, a photograph too poor to tell a card from a page. The app asks the user a single question when this is not high, so saying low costs one tap and saves a wrong category. Guessing high costs somebody the wrong renewal guidance for a year.
- mrz is the machine-readable zone copied out exactly, one output line per printed line, when the picture shows one: the two lines of 44 characters at the foot of a passport data page, or the three lines of 30 characters on the back of an identity card. Copy every character including the < fillers, keep the lines in order, and do not tidy or correct anything that looks wrong to you. Return an empty string when no zone is visible, when it is cut off, or when you cannot read it with confidence. This is the one field where a faithful copy matters more than a sensible reading: it is checked against its own check digits, and a copy that has been helpfully corrected fails that check and is thrown away.
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

/**
 * The documents that carry a machine-readable zone of their own.
 *
 * The guard, and it is not a formality. A residence visa is very often
 * photographed on the page facing the passport data page, so the zone in the
 * frame belongs to the passport and not to the thing being tracked. Taking a
 * visa's expiry from it would replace a correct date with a real date off the
 * wrong document, which is worse than any misreading.
 */
const CARRIES_MRZ = new Set(['passport', 'emirates-id']);

/** Same name or not, ignoring the things that are not the spelling. */
function sameName(a: string, b: string): boolean {
  const bare = (name: string) =>
    name
      .toUpperCase()
      .replace(/[^A-Z ]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .join(' ');
  return bare(a) === bare(b);
}

/**
 * Takes the name and the expiry from the machine-readable zone when there is
 * one to be trusted.
 *
 * Only when every check digit in the zone agrees with the field beside it. The
 * name itself has no check digit, so this is evidence rather than proof: a
 * transcription that got four check digits right is not one that invented a
 * name. When any of them disagrees the whole zone is dropped, because a single
 * wrong character means the line was misread and the name sits on that line.
 *
 * Exported for its own tests, and pure so that they need no model.
 */
export function reconcileWithMrz(item: Extraction): Extraction {
  if (!CARRIES_MRZ.has(item.typeId)) return item;

  const mrz = parseMrz(item.mrz);
  if (!mrz || !mrz.valid || !mrz.full) return item;

  const fields = [...item.fields];
  const index = fields.findIndex(
    (field) => field.kind === 'name' && field.label.toLowerCase().includes('name')
  );

  let nameFixed = false;
  if (index === -1) {
    fields.unshift({ label: 'Full name', value: mrz.full, kind: 'name' });
  } else if (!sameName(fields[index].value, mrz.full)) {
    fields[index] = { ...fields[index], value: mrz.full };
    nameFixed = true;
  }

  const dateFixed = mrz.expiryDate !== '' && mrz.expiryDate !== item.expiryDate;

  /*
   * Said plainly, because somebody is about to check this against the document
   * in their hand and should know why the app disagrees with what they can see
   * printed on it.
   */
  const said = dateFixed
    ? 'The date is read from the machine-readable strip, which cannot be confused for day and month.'
    : nameFixed
      ? 'The name is read from the machine-readable strip, which spells it the same way and is easier to read.'
      : '';

  return {
    ...item,
    expiryDate: dateFixed ? mrz.expiryDate : item.expiryDate,
    // A zone that checks out is the document telling us what it is.
    typeConfidence: 'high',
    note: said ? `${item.note} ${said}`.trim() : item.note,
    fields,
  };
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
      typeConfidence: 'low',
      mrz: '',
      note: "This image couldn't be processed. Try entering the details by hand.",
      fields: [],
    };
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Model response did not match the expected schema');
  }
  return reconcileWithMrz(parsed);
}

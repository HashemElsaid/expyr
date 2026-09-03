import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/**
 * Reading a document, rather than pulling one date out of it.
 *
 * One rule shapes every prompt here: this reads the document back to the user,
 * it does not advise them. It quotes what the paper says and where, and when
 * the paper is silent it says so rather than reasoning from what contracts
 * usually contain. A confident guess about a tenancy agreement is the worst
 * thing this feature could produce.
 */

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    cachedClient = new Anthropic(
      workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}
    );
  }
  return cachedClient;
}

/** Transcription is close to OCR, so the cheap model does it well. */
const READ_MODEL = process.env.EXPYR_READ_MODEL ?? 'claude-haiku-4-5';

/**
 * Briefing and answering are different jobs, and measuring them said so.
 *
 * Answering is precision on one question, and Haiku does it well: on a dense
 * tenancy contract it quoted the right clauses, and it refused to invent a pet
 * deposit that did not exist rather than welding the pets clause to the deposit
 * clause. Questions are also the thing people do repeatedly, so this is the
 * cost worth keeping down.
 *
 * Briefing is recall: find every trap in the document, including the ones
 * nobody would think to ask about. Haiku found four and missed the automatic
 * renewal clause, which is the one that quietly costs a year of rent. Sonnet
 * found seven, that one included. It runs once per document, so the expensive
 * model sits where the cost is bounded and the misses are expensive.
 */
const BRIEF_MODEL = process.env.EXPYR_BRIEF_MODEL ?? 'claude-sonnet-5';
const ASK_MODEL = process.env.EXPYR_ASK_MODEL ?? 'claude-haiku-4-5';

/** Adaptive thinking is rejected outright by the older small models. */
const THINKING_CAPABLE = [
  'claude-fable-5',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
];

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'application/pdf';

function attachmentBlock(base64: string, mediaType: SupportedMediaType) {
  return mediaType === 'application/pdf'
    ? ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as const)
    : ({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      } as const);
}

/* ------------------------------------------------------------------ read -- */

const READ_SYSTEM = `You transcribe documents for Expyr, so they can be questioned later.

Write out everything the document says, in the order it says it.

- Keep clause and section numbers exactly as printed. They are how an answer is later pointed back at the page, so losing them costs more than losing formatting.
- Keep headings. Keep tables as simple rows of text.
- Transcribe. Do not summarise, shorten, explain, or correct spelling and grammar.
- Where text is genuinely illegible write [illegible] rather than guessing.
- Transcribe every page, in order.

Return the transcription only, with no preamble.`;

export async function readDocument(opts: {
  fileBase64: string;
  mediaType: SupportedMediaType;
}): Promise<string> {
  const response = await getClient().messages.create({
    model: READ_MODEL,
    max_tokens: 16000,
    system: READ_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          attachmentBlock(opts.fileBase64, opts.mediaType),
          { type: 'text', text: 'Transcribe this document.' },
        ],
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/* ----------------------------------------------------------------- brief -- */

export const BriefSchema = z.object({
  kind: z.string(),
  summary: z.string(),
  points: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      quote: z.string(),
      where: z.string(),
    })
  ),
  watchOut: z.array(
    z.object({
      detail: z.string(),
      quote: z.string(),
      where: z.string(),
    })
  ),
  obligations: z.array(
    z.object({
      detail: z.string(),
      daysBeforeEnd: z.number(),
      quote: z.string(),
    })
  ),
});

export type Brief = z.infer<typeof BriefSchema>;

const BRIEF_SYSTEM = `You brief people on documents they have signed but never read, for Expyr. Most users live in the UAE.

Almost nobody reads an agreement before signing it. Your job is to tell them what they actually agreed to, in the order that matters to them.

What matters, roughly in order: money they will owe, things they are forbidden from doing, notice they must give and by when, what happens if they break it, and how it ends.

Rules:
- Everything you state comes from the text in front of you. Never fill a gap with what such documents usually say.
- Every point carries the wording it came from, copied word for word, in "quote". Put a pointer such as "Clause 8.3" or "Section 4, Termination" in "where", or leave "where" empty when the document is not numbered.
- Write "detail" in plain language somebody can act on. No legalese, no hedging, and no advice about what they should do.
- kind is a short human name for the document, such as "Residential tenancy contract" or "Car rental agreement".
- summary is one or two sentences: what this is, between whom, and for how long.
- points: the six to ten things a person would want to know. Fewer if the document is short.
- watchOut: clauses that cost money or take away a right. Penalties, forfeited deposits, automatic renewal, liability, anything forbidden. Leave it empty if there genuinely are none.
- obligations: only things the person must DO by a deadline measured from the end of the agreement, such as giving notice to leave. daysBeforeEnd is how many days before the end date it must happen. Leave this array empty unless the document states such a deadline plainly.

You are reading the document back to them. You are not their lawyer, and you never tell them what they are allowed to do.`;

export async function briefDocument(text: string): Promise<Brief> {
  const model = BRIEF_MODEL;
  const response = await getClient().messages.parse({
    model,
    max_tokens: 8000,
    system: BRIEF_SYSTEM,
    ...(THINKING_CAPABLE.includes(model) ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: { format: zodOutputFormat(BriefSchema) },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Here is the document:\n\n${text}`,
            // Cached, so questions asked afterwards are much cheaper.
            cache_control: { type: 'ephemeral' },
          },
          { type: 'text', text: 'Brief me on this document.' },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Could not read that document');
  return parsed;
}

/* ------------------------------------------------------------------- ask -- */

export const AnswerSchema = z.object({
  answered: z.boolean(),
  answer: z.string(),
  quote: z.string(),
  where: z.string(),
  /** Which document answered, when more than one was searched. */
  source: z.string(),
});

export type Answer = z.infer<typeof AnswerSchema>;

/**
 * One prompt, whether there is one document or a household's worth.
 *
 * It answers from two things, and the difference between them matters. Expyr's
 * file is a line per tracked item — what it is, when it expires, whose it is —
 * and those dates were scanned or entered by the person, so they are the right
 * answer to "when does my tenancy expire" even when no contract text says it.
 * The transcripts are the authority on what a document actually says. Losing
 * that distinction is how an assistant either invents clauses or, as this one
 * did, claims not to know something the app had written down.
 */
const ASK_SYSTEM = `You answer questions about somebody's own documents, for Expyr. Most users live in the UAE.

You are given two things.

1. Expyr's file: one line for every item this person tracks — what it is, when it expires, whose it is, and whether its full text has been read. These dates and names came from their own documents and are reliable.
2. The full text of the documents that have been read. Some tracked items will not be here.

Answer only from those two, and know which one you are using.

- A question about when something expires, whose it is, its number, or what is being tracked: answer from the file. Set answered true, and leave "quote" empty, because a record is not a clause. Give the date as it is written in the file.
- "source" is only ever the item's name — the words before the colon in the file, such as "Marina Heights tenancy". Never the type, the date, or the whole line.
- A question about what a document says: answer from its text. Set answered true, put the answer in plain language, copy the exact wording into "quote", and put the clause or section into "where".
- A question about what a document says when that document is in the file but its text is not here: say you know when it expires but have not read it, and that reading it in Expyr would let you answer questions about its wording. Set answered false and name it in "source".
- A question neither the file nor the text covers: set answered false and say so plainly. Leave quote and where empty. Do not reason from what such documents usually contain, do not infer from silence, and do not offer what is likely. Silence is a real and useful answer, because it tells the person their papers do not restrict them, which is a different thing from their papers permitting them.
- Where several documents are relevant, answer from the one that addresses the question most directly and name it. If two genuinely conflict, say so and name both.
- Never give legal advice and never tell the person what they may or may not do. Report what their papers say and let them decide.
- Keep the answer to a few sentences. Quote the clause rather than paraphrasing it at length.
- Where a document is ambiguous, say what it says and name the ambiguity rather than resolving it.`;

export async function askDocument(opts: {
  documents: { title: string; text: string }[];
  /**
   * Expyr's own file: one line per tracked item, including the ones never read.
   * Dates in here were scanned or typed by the person, so they are the best
   * answer to "when does it expire" even when no contract text mentions it.
   */
  records?: string[];
  question: string;
  history?: { question: string; answer: string }[];
}): Promise<Answer> {
  const model = ASK_MODEL;
  const across = opts.documents.length !== 1;
  /*
   * The whole file of papers goes in one cached block, so a conversation of
   * ten questions pays to read them once rather than ten times.
   */
  const corpus = across
    ? opts.documents.map((doc) => `=== ${doc.title} ===\n\n${doc.text}`).join('\n\n\n')
    : (opts.documents[0]?.text ?? '');
  /*
   * Expyr's own file goes in first, and goes in even when there is no document
   * text at all. It is what lets the app answer "when does my tenancy expire"
   * about a contract it has never read, which it always knew and could not say.
   */
  const file = opts.records?.length
    ? `Expyr's file — everything this person tracks:\n${opts.records
        .map((record) => `- ${record}`)
        .join('\n')}\n\n`
    : '';
  const priorTurns = (opts.history ?? []).flatMap((turn) => [
    { role: 'user' as const, content: turn.question },
    { role: 'assistant' as const, content: turn.answer },
  ]);

  const response = await getClient().messages.parse({
    model,
    max_tokens: 4000,
    system: ASK_SYSTEM,
    ...(THINKING_CAPABLE.includes(model) ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: { format: zodOutputFormat(AnswerSchema) },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: !corpus
              ? `${file}No document text this time — answer from the file above.`
              : across
                ? `${file}Here are the documents that have been read:\n\n${corpus}`
                : `${file}Here is the document that has been read:\n\n${corpus}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: across
              ? 'I will ask you questions about these documents.'
              : 'I will ask you questions about this document.',
          },
        ],
      },
      { role: 'assistant', content: 'Understood. I will answer only from the text.' },
      ...priorTurns,
      { role: 'user', content: opts.question },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Could not answer that');
  return parsed;
}

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

const ASK_SYSTEM = `You answer questions about a document somebody has signed, for Expyr. Most users live in the UAE.

You have the full text. Answer only from it.

- When the document answers the question: set answered true, give the answer in plain language, copy the exact wording into "quote", and put the clause or section into "where".
- When the document does not address it: set answered false and say so plainly in "answer". Leave quote and where empty. Do not reason from what such documents usually contain, do not infer from silence, and do not offer what is likely. Silence is a real and useful answer, because it tells the person the paper does not restrict them, which is a different thing from the paper permitting them.
- Never give legal advice and never tell the person what they may or may not do. Report what the document says and let them decide.
- Keep the answer to a few sentences. Quote the clause rather than paraphrasing it at length.
- Where the document is ambiguous, say what it says and name the ambiguity rather than resolving it.
- Leave "source" empty. There is only one document here.`;

/**
 * The same rules, over somebody's whole file of papers. The difference that
 * matters is attribution: an answer that does not say which document it came
 * from cannot be checked, and two contracts can say opposite things without
 * either being wrong.
 */
const ASK_ACROSS_SYSTEM = `You answer questions about the documents somebody has signed, for Expyr. Most users live in the UAE.

You have the full text of several documents, each under a heading with its name. Answer only from them.

- When a document answers the question: set answered true, give the answer in plain language, copy the exact wording into "quote", put the clause or section into "where", and put the document's name into "source".
- When more than one document is relevant, answer from the one that addresses the question most directly and name it. If two documents genuinely conflict, say so and name both in "answer".
- When none of them address it: set answered false and say so plainly in "answer". Leave quote, where and source empty. Do not reason from what such documents usually contain, do not infer from silence, and do not offer what is likely. Silence is a real and useful answer, because it tells the person their papers do not restrict them, which is a different thing from their papers permitting them.
- Never give legal advice and never tell the person what they may or may not do. Report what the documents say and let them decide.
- Keep the answer to a few sentences. Quote the clause rather than paraphrasing it at length.
- Where a document is ambiguous, say what it says and name the ambiguity rather than resolving it.`;

export async function askDocument(opts: {
  documents: { title: string; text: string }[];
  question: string;
  history?: { question: string; answer: string }[];
}): Promise<Answer> {
  const model = ASK_MODEL;
  const across = opts.documents.length > 1;
  /*
   * The whole file of papers goes in one cached block, so a conversation of
   * ten questions pays to read them once rather than ten times.
   */
  const corpus = across
    ? opts.documents.map((doc) => `=== ${doc.title} ===\n\n${doc.text}`).join('\n\n\n')
    : (opts.documents[0]?.text ?? '');
  const priorTurns = (opts.history ?? []).flatMap((turn) => [
    { role: 'user' as const, content: turn.question },
    { role: 'assistant' as const, content: turn.answer },
  ]);

  const response = await getClient().messages.parse({
    model,
    max_tokens: 4000,
    system: across ? ASK_ACROSS_SYSTEM : ASK_SYSTEM,
    ...(THINKING_CAPABLE.includes(model) ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: { format: zodOutputFormat(AnswerSchema) },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: across
              ? `Here are the documents:\n\n${corpus}`
              : `Here is the document:\n\n${corpus}`,
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

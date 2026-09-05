import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { getClient, THINKING_CAPABLE } from './comprehend.ts';

/**
 * How to renew a thing, in a place, worked out on demand.
 *
 * The app carries hand-checked renewal steps for the UAE — every fee and fine
 * verified against the authority that charges it. That does not scale. There
 * are two hundred countries and fifty US states, each with its own rules for
 * each of thirteen document types, and hand-checking that is not a backlog, it
 * is a different company.
 *
 * So everywhere the app has no verified guide, it asks for one: a search of the
 * live web, read back as steps, with the pages it came from attached. This is
 * generated text about somebody's visa, so three rules shape everything below.
 *
 *  1. It never speaks with more confidence than it has. The schema carries a
 *     `standing` the app is required to show, and the prompt is told to return
 *     `thin` rather than fill gaps with what such processes usually involve.
 *  2. Every answer carries its sources, and the app links out to them. A person
 *     about to spend a morning at a service centre should be able to check.
 *  3. It is never presented as official. That wording lives in the app, but it
 *     is the reason this file exists in the shape it does.
 */

const RESEARCH_MODEL = process.env.EXPYR_GUIDANCE_MODEL ?? 'claude-sonnet-5';
/** Structuring prose that has already been researched is cheap work. */
const SHAPE_MODEL = process.env.EXPYR_GUIDANCE_SHAPE_MODEL ?? 'claude-haiku-4-5';

/**
 * Searches per request. Enough for an official page and a corroborating one;
 * few enough that a single request cannot run away.
 */
const MAX_SEARCHES = 6;

/**
 * A server tool can hand the turn back mid-flight and ask to be continued.
 * Bounded so a pathological exchange cannot loop forever.
 */
const MAX_CONTINUATIONS = 4;

export const SourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  /** True when the host looks like the responsible authority rather than a blog. */
  official: z.boolean(),
});

export const GuidanceSchema = z.object({
  /** One or two sentences: what renewing this actually involves here. */
  summary: z.string(),
  /** The authority or portal that does it. Empty when the search did not say. */
  where: z.string(),
  /** In order. Empty rather than invented when the search did not establish them. */
  steps: z.array(z.string()),
  /** What it costs, as found. Empty when no figure was established. */
  typicalCost: z.string(),
  /** What being late costs. Empty when nothing was established. */
  lateFee: z.string(),
  /** How long it takes. Empty when nothing was established. */
  processingTime: z.string(),
  /** What to bring or upload. */
  needed: z.array(z.string()),
  /**
   * How much of this the search actually established.
   *
   * `good` means official sources were found and agreed. `thin` means the
   * search found little and the answer is a starting point rather than a
   * procedure — the app says so differently, and more loudly.
   */
  standing: z.enum(['good', 'thin']),
});

export type Guidance = z.infer<typeof GuidanceSchema> & {
  sources: z.infer<typeof SourceSchema>[];
  /** ISO date this was generated, shown so a person can judge its age. */
  checkedOn: string;
};

export type GuidanceRequest = {
  /** The app's category id, used only for the cache key. */
  typeId: string;
  /** What this document is called where the user is: "Residence Visa". */
  label: string;
  /** ISO-3166 alpha-2, lowercased. */
  country: string;
  /** Emirate, state or province. Empty when the user has not said. */
  region: string;
  /** The country's name, so the prompt does not have to decode a code. */
  countryName: string;
};

const RESEARCH_SYSTEM = `You research how to renew official documents, for Expyr — an app that tracks documents so they get renewed before they lapse.

Somebody is about to spend a morning on this. Your job is to find out what they will actually have to do, from the authority that actually does it.

How to work:
- Search for the responsible authority's own pages first: the government department, the ministry, the licensing body, the official portal. Those are the answer. News articles, law-firm blogs and relocation-agency guides are worth reading to find the official page, and are not themselves the answer.
- Look for the current fee, the current penalty for being late, and how long processing takes. These change, so prefer a page that shows when it was updated.
- Note what a person has to bring or upload, and any prerequisite document that must still be valid.

What matters more than completeness:
- Never state a fee, a fine, or a deadline you did not find. A wrong number about somebody's money or their visa is worse than no number — they will budget for it, or miss a date because of it.
- Where the search does not establish something, say plainly that it did not. Do not fill the gap with what such processes usually involve.
- Do not generalise from a neighbouring country or a different emirate or state. Jurisdictions differ precisely in the details a person needs.
- If the rules genuinely differ by sub-region and you were not told which one, say so rather than picking one.

Write your findings as plain prose, in this order: what renewing this involves, who does it, the steps in order, what to bring, the fee, the penalty for lateness, how long it takes. Say explicitly which of those you could not establish.`;

const SHAPE_SYSTEM = `You turn research notes about renewing a document into the exact structure an app will display.

Rules:
- Use only what the notes say. Never add a step, a fee, a document or a duration that is not in them.
- Where the notes say something could not be established, leave that field an empty string, or that array empty. An empty field is displayed as "not established"; a plausible-sounding invention is displayed as fact.
- steps are what the person does, in order, one action each, in plain language. No preamble, no numbering — the app numbers them.
- needed is what they have to bring or upload, one item each.
- typicalCost, lateFee and processingTime are short phrases as the notes state them, keeping the currency and the units the source used.
- standing is "good" only if the notes are grounded in the responsible authority's own pages and cover the steps and at least the fee. Otherwise "thin".
- Write for somebody who has never done this before and does not know the jargon.`;

/** A search result the model actually read, as opposed to one it remembers. */
type FoundSource = { title: string; url: string; official: boolean };

/**
 * Hosts that are the authority rather than a commentator. Deliberately
 * conservative: a domain not on this list is not called official, which
 * understates rather than overstates.
 */
const OFFICIAL_HOST = /(^|\.)(gov|gob|govt|gouv)(\.[a-z]{2})?$|(^|\.)gov\.[a-z]{2}$|\.go\.[a-z]{2}$|(^|\.)(europa\.eu|admin\.ch)$/i;

function looksOfficial(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (OFFICIAL_HOST.test(host)) return true;
    // The Gulf authorities that do not sit under a .gov domain.
    return /(^|\.)(mohre|icp|gdrfa|tamm|rta|dha|moi|ejari|dubai|abudhabi|u\.ae)\./.test(host);
  } catch {
    return false;
  }
}

/**
 * Every page the search actually opened, in the order it read them.
 *
 * Taken from the tool result blocks rather than from anything the model wrote,
 * so a URL shown to a user is one that exists and was read — not one recalled
 * from training and typed out plausibly.
 */
function sourcesFrom(content: Anthropic.ContentBlock[]): FoundSource[] {
  const found = new Map<string, FoundSource>();

  for (const block of content) {
    if (block.type !== 'web_search_tool_result') continue;

    /*
     * A server tool reports failure as HTTP 200 with an error object where the
     * list of results would be. Branching on the shape is the only way to tell.
     */
    const results = block.content;
    if (!Array.isArray(results)) continue;

    for (const result of results) {
      if (result.type !== 'web_search_result') continue;
      if (found.has(result.url)) continue;
      found.set(result.url, {
        title: result.title || result.url,
        url: result.url,
        official: looksOfficial(result.url),
      });
    }
  }

  // Authorities first — it is the link most people want.
  return [...found.values()].sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 6);
}

/** True when every search this turn failed, which is worth failing the request over. */
function everySearchFailed(content: Anthropic.ContentBlock[]): boolean {
  const results = content.filter((block) => block.type === 'web_search_tool_result');
  if (results.length === 0) return false;
  return results.every((block) => !Array.isArray(block.content));
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * Step one: read the live web.
 *
 * Handles `pause_turn`, which is how a server tool hands the turn back partway
 * through a long search and asks to be continued. Ignoring it truncates the
 * research silently.
 */
async function research(request: GuidanceRequest): Promise<{
  notes: string;
  sources: FoundSource[];
}> {
  const where = request.region
    ? `${request.region}, ${request.countryName}`
    : request.countryName;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `How does somebody renew a ${request.label} in ${where}?

Find the responsible authority's own current pages. Report the steps, what to bring, the fee, the penalty for renewing late, and how long it takes — and say which of those you could not establish.`,
    },
  ];

  const collected: Anthropic.ContentBlock[] = [];

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn += 1) {
    const response = await getClient().messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 8000,
      system: RESEARCH_SYSTEM,
      ...(THINKING_CAPABLE.includes(RESEARCH_MODEL)
        ? { thinking: { type: 'adaptive' as const } }
        : {}),
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: MAX_SEARCHES,
        },
      ],
      messages,
    });

    collected.push(...response.content);

    // Declined outright — nothing useful will come of continuing.
    if (response.stop_reason === 'refusal') {
      throw new Error('The research request was declined.');
    }

    if (response.stop_reason === 'pause_turn') {
      // Hand back exactly what came out, which is what continuing means.
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    break;
  }

  if (everySearchFailed(collected)) {
    throw new Error('The web search did not answer.');
  }

  const notes = textOf(collected);
  if (notes.length < 80) throw new Error('The research came back empty.');

  return { notes, sources: sourcesFrom(collected) };
}

/** Step two: shape the prose into what the app draws. Cheap, and no web access. */
async function shape(request: GuidanceRequest, notes: string): Promise<z.infer<typeof GuidanceSchema>> {
  const where = request.region
    ? `${request.region}, ${request.countryName}`
    : request.countryName;

  const response = await getClient().messages.parse({
    model: SHAPE_MODEL,
    max_tokens: 4000,
    system: SHAPE_SYSTEM,
    output_config: { format: zodOutputFormat(GuidanceSchema) },
    messages: [
      {
        role: 'user',
        content: `Notes on renewing a ${request.label} in ${where}:\n\n${notes}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('The guidance could not be structured.');
  return parsed;
}

/**
 * Renewal guidance for one document type in one place.
 *
 * Two calls rather than one on purpose. The research needs the live web and a
 * model with judgment about which page is the authority; shaping the result is
 * mechanical and belongs on the cheap model. Splitting them also means the URLs
 * shown to a person come from the search results themselves rather than from
 * whatever the model typed, which is the difference between a link that works
 * and a link that looks right.
 */
export async function generateGuidance(request: GuidanceRequest): Promise<Guidance> {
  const { notes, sources } = await research(request);
  const structured = await shape(request, notes);

  return {
    ...structured,
    sources,
    /*
     * Guidance with no source behind it is a guess with a citation-shaped hole.
     * The app is told it is thin whatever the model thought of itself.
     */
    standing: sources.length === 0 ? 'thin' : structured.standing,
    checkedOn: new Date().toISOString().slice(0, 10),
  };
}

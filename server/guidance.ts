import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { getClient, THINKING_CAPABLE } from './comprehend.ts';
import { EFFORT_CAPABLE } from './extract.ts';

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
 * Searches per request.
 *
 * Started at six, which was wrong for a reason worth writing down: this is the
 * one request in the app where a person is watching a spinner rather than
 * getting on with something, and six searches at full effort took over four
 * minutes — longer than the app's own timeout, so nobody would ever have seen
 * the answer. Three finds the authority's page and one corroborating source,
 * which is what the answer is actually built from.
 */
const MAX_SEARCHES = 3;

/**
 * Low effort, deliberately.
 *
 * The work here is finding the right page and reporting what it says, not
 * reasoning about it — the judgment that matters is "is this the authority or a
 * blog", which is a shallow question. Effort bought minutes and no accuracy on
 * a task shaped like this one, and minutes are the whole problem.
 */
const RESEARCH_EFFORT = 'low' as const;

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
  /**
   * Which of the hosts it was shown belong to the authority.
   *
   * A pattern cannot answer this. Ireland runs driver licensing on ndls.ie and
   * publishes passports on ireland.ie; neither looks like a government from the
   * outside, and enumerating two hundred countries' domains is not a rule, it
   * is a list that is always wrong somewhere. The model has just read the pages
   * and knows which one is the licensing authority, so it is asked.
   */
  officialHosts: z.array(z.string()),
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
  /** The service, when this is a subscription. Empty when it is a document. */
  service?: string;
};

const RESEARCH_SYSTEM = `You research how to renew official documents, for Expyr, an app that tracks documents so they get renewed before they lapse.

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

Search no more than three times. The authority's own page is usually the first result for "<document> renewal <place> official"; go there rather than reading around it.

Write your findings as terse notes, not an essay, in this order: what renewing this involves, who does it, the steps in order, what to bring, the fee, the penalty for lateness, how long it takes. One line each. Name explicitly which of those you could not establish. Do not restate the question, do not explain your search, and do not add a conclusion.`;

/**
 * The other half of the job, and it is a different job.
 *
 * A document is renewed at an authority, in a place, under rules that differ by
 * jurisdiction. A subscription is cancelled or changed with the company that
 * charges you, under terms that are the same everywhere they operate. Asking
 * the first question about the second is how somebody in Dubai opening iCloud+
 * was told about giving a gym thirty days' written notice.
 *
 * The country is still mentioned, because it is not always irrelevant: a gym is
 * a subscription too, and its notice period is entirely local.
 */
const SUBSCRIPTION_SYSTEM = `You research how to cancel or change a subscription, for Expyr, an app that warns people before a subscription charges them again.

Somebody has been told this charges them in a few days and wants to know what they can actually do about it.

How to work:
- Search for the company's own help pages: their support site, their cancellation page, their billing FAQ. That is the answer. Review sites, "how to cancel anything" listicles and affiliate pages are not.
- Find the exact route a person takes. For services billed through an app store, that route is the app store's own subscription settings rather than the company's website, and saying so is the useful answer.
- Find the notice period if there is one, what happens to access when you cancel, and whether a refund is possible.
- Find the current price if the page states it.

What matters more than completeness:
- Never state a price, a notice period or a refund rule you did not find. A person will act on it.
- Where the search does not establish something, say plainly that it did not. Do not fill the gap with what subscriptions usually do.
- Do not describe a different company's process. If the search did not find this service, say so rather than answering about a similar one.
- Most of this is the same in every country. Mention the country only where it genuinely changes the answer — a local gym's notice period, or a price stated in that market's currency.

Search no more than three times.

Write your findings as terse notes, not an essay, in this order: what this service is and how it bills, who to cancel with, the steps in order, anything needed, the price, the notice period or deadline, and what happens after cancelling. One line each. Name explicitly which of those you could not establish. Do not restate the question and do not add a conclusion.`;

const SHAPE_SYSTEM = `You turn research notes about renewing a document into the exact structure an app will display.

Rules:
- Use only what the notes say. Never add a step, a fee, a document or a duration that is not in them.
- Where the notes say something could not be established, leave that field an empty string, or that array empty. An empty field is displayed as "not established"; a plausible-sounding invention is displayed as fact.
- steps are what the person does, in order, one action each, in plain language. No preamble, no numbering, because the app numbers them.
- needed is what they have to bring or upload, one item each.
- typicalCost, lateFee and processingTime are short phrases as the notes state them, keeping the currency and the units the source used.
- standing is "good" only if the notes are grounded in the responsible authority's own pages and cover the steps and at least the fee. Otherwise "thin".
- officialHosts: of the hosts listed at the end of the notes, return those belonging to the government, the licensing authority, or the state body that actually performs this renewal, as bare hostnames, copied exactly from the list. Include state bodies that do not use a government-style domain. Exclude anything commercial, any blog, any encyclopedia, any law firm, any insurance broker and any relocation agency, however useful their page was. When in doubt, leave it out.
- Write for somebody who has never done this before and does not know the jargon.
- Never use an em dash in anything you write. Use a full stop, a comma, or a colon. This is a house style rule and it has no exceptions.`;

/** A search result the model actually read, as opposed to one it remembers. */
type FoundSource = { title: string; url: string; official: boolean };

/**
 * Hosts that are the authority rather than somebody writing about it.
 *
 * There is no global registry of "this domain is a government", so this is a
 * best effort that deliberately **understates**: a domain it does not
 * recognise is shown without the official mark rather than with a wrong one.
 * A missing mark costs a person one extra glance; a wrong one costs them the
 * reason to check at all.
 *
 * The awkward cases are the governments that do not sit under a .gov-shaped
 * domain — Ireland publishes passport renewal on ireland.ie, and the first
 * version of this called the Department of Foreign Affairs a blog. Those are
 * listed rather than pattern-matched, because there is no pattern.
 */
const GOVERNMENT_SUFFIX =
  /(^|\.)(gov|gob|govt|gouv|go)(\.[a-z]{2,3})?(\.[a-z]{2})?$|(^|\.)gov$/i;

/** Governments whose own domain looks like anybody else's. */
const GOVERNMENT_HOST =
  /(^|\.)(ireland\.ie|europa\.eu|admin\.ch|bund\.de|belgium\.be|norge\.no|suomi\.fi|works\.gov\.sg|u\.ae|tamm\.abudhabi|dubai\.ae|mohre\.gov\.ae|icp\.gov\.ae|gdrfad\.gov\.ae|rta\.ae|dha\.gov\.ae|moi\.gov\.[a-z]{2}|ejari\.gov\.ae|nhs\.uk|police\.uk)$/i;

/** Exported for the suite; the rule above is easier to get wrong than it looks. */
export function looksOfficialForTests(url: string): boolean {
  return looksOfficial(url);
}

/** The bare hostname, or an empty string when it is not a URL at all. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function looksOfficial(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return GOVERNMENT_SUFFIX.test(host) || GOVERNMENT_HOST.test(host);
}

/**
 * What the model writes when it means "the search did not say".
 *
 * The prompt asks for an empty string, and it mostly obliges — but it also
 * writes "not established", and once that reaches the app it is rendered as a
 * value: a Cost row reading "not established", which is exactly the row the
 * empty string existed to suppress. Prompts drift; this does not.
 */
const MEANS_NOTHING =
  /^(not |un)?(established|stated|specified|available|known|found|listed|determined|provided|applicable|disclosed)\.?$|^(n\/?a|unknown|none|tbd|-{1,3})\.?$/i;

function orEmpty(value: string): string {
  return MEANS_NOTHING.test(value.trim()) ? '' : value.trim();
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

  const subscription = Boolean(request.service);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: subscription
        ? `How does somebody cancel or change their "${request.label}" subscription? They are in ${where}.

Find the company's own current help pages. Report how it bills, where to cancel, the steps in order, the price, any notice period, and what happens to access afterwards — and say which of those you could not establish.`
        : `How does somebody renew a ${request.label} in ${where}?

Find the responsible authority's own current pages. Report the steps, what to bring, the fee, the penalty for renewing late, and how long it takes — and say which of those you could not establish.`,
    },
  ];

  const collected: Anthropic.ContentBlock[] = [];

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn += 1) {
    /*
     * Streamed rather than awaited whole. Several web searches take long enough
     * that a plain request risks the SDK's own HTTP timeout, and a request that
     * dies at the transport after paying for three searches is the worst of
     * both. `getFinalMessage` gives back the same message either way.
     */
    const response = await getClient().messages
      .stream({
        model: RESEARCH_MODEL,
        max_tokens: 4000,
        system: subscription ? SUBSCRIPTION_SYSTEM : RESEARCH_SYSTEM,
        ...(THINKING_CAPABLE.includes(RESEARCH_MODEL)
          ? { thinking: { type: 'adaptive' as const } }
          : {}),
        ...(EFFORT_CAPABLE.includes(RESEARCH_MODEL)
          ? { output_config: { effort: RESEARCH_EFFORT } }
          : {}),
        tools: [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: MAX_SEARCHES,
          },
        ],
        messages,
      })
      .finalMessage();

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
async function shape(
  request: GuidanceRequest,
  notes: string,
  hosts: string[]
): Promise<z.infer<typeof GuidanceSchema>> {
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
        content:
          (request.service
            ? `Notes on cancelling or changing "${request.label}":\n\n${notes}\n\n`
            : `Notes on renewing a ${request.label} in ${where}:\n\n${notes}\n\n`) +
          `Hosts these notes came from:\n${hosts.map((host) => `- ${host}`).join('\n')}`,
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

  const hosts = [...new Set(sources.map((source) => hostOf(source.url)).filter(Boolean))];
  const structured = await shape(request, notes, hosts);

  /*
   * Either judgement is enough to earn the mark, and neither can take it away.
   * The pattern knows a .gov when it sees one and nothing else; the model knows
   * that ndls.ie is Ireland's licensing authority and could be talked into
   * anything. Together they are wrong less often than either alone, and the
   * prompt is told to leave it out when in doubt.
   */
  const named = new Set(
    structured.officialHosts.map((host) => host.toLowerCase().replace(/^www\./, ''))
  );
  const marked = sources.map((source) => ({
    ...source,
    official: source.official || named.has(hostOf(source.url)),
  }));

  // Authorities first, now that more of them are recognised as such.
  marked.sort((a, b) => Number(b.official) - Number(a.official));

  return {
    ...structured,
    /*
     * An empty field is shown as nothing at all; a field reading "not
     * established" is shown as a fact. Normalised here so a cached entry —
     * which lives ninety days — cannot carry the noise for a quarter.
     */
    where: orEmpty(structured.where),
    typicalCost: orEmpty(structured.typicalCost),
    lateFee: orEmpty(structured.lateFee),
    processingTime: orEmpty(structured.processingTime),
    sources: marked,
    /*
     * Guidance with no source behind it is a guess with a citation-shaped hole.
     * The app is told it is thin whatever the model thought of itself.
     */
    standing: marked.length === 0 ? 'thin' : structured.standing,
    checkedOn: new Date().toISOString().slice(0, 10),
  };
}

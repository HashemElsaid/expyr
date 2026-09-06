import { fetchBrandIcon, isDomain } from './brand-icon.ts';
import { askDocument, briefDocument, readDocument } from './comprehend.ts';
import { invalid, ServiceError, unavailable } from './errors.ts';
import { extractFromImage } from './extract.ts';
import { FileGuidanceStore, isFresh, LayeredGuidanceStore } from './guidance-cache.ts';
import { generateGuidance, type Guidance } from './guidance.ts';
import { canIssueTokens, issueInstallToken } from './install-token.ts';
import { openPdf, pagesOf, pdfPageCount } from './pdf.ts';
import type { LogFields } from './log.ts';
import {
  AskRequest,
  ExtractRequest,
  FileRequest,
  GuidanceRequest,
  guidanceKey,
  parse,
  TextRequest,
} from './schemas.ts';
import { readSubscriptions } from './subscriptions.ts';

/**
 * The routes, as a table.
 *
 * This was one four-hundred-line function: routing, CORS, body reading,
 * authentication, two kinds of rate limit and every handler, in a single chain
 * of `if`s. Reading it meant holding all of it. Splitting it into a table costs
 * the two types below and buys the ability to see, in one screen, exactly which
 * routes need a credential and which are metered — which is a security question
 * that should never need archaeology to answer.
 */

export type RequestContext = {
  /** The raw request body. Empty for GET routes. */
  body: string;
  /** Query parameters, for the one route that has any. */
  query: URLSearchParams;
  /**
   * Fields to add to this request's log line. Counts and sizes only — never
   * anything that came out of the body. See the note in log.ts.
   */
  note: (fields: Partial<LogFields>) => void;
};

/** What a handler gives back: parsed JSON, or bytes with a content type. */
export type Result =
  | { kind: 'json'; body: unknown; status?: number }
  | { kind: 'bytes'; body: Buffer; type: string; cacheSeconds: number };

const json = (body: unknown): Result => ({ kind: 'json', body });
/** 202: started, not finished. The caller asks again in a moment. */
const working = (body: unknown): Result => ({ kind: 'json', body, status: 202 });

export type Route = {
  method: 'GET' | 'POST';
  /** Requires the shared app token. */
  auth: boolean;
  /** Counted against the caller's rate limit and the day's budget. */
  metered: boolean;
  /**
   * Whether this route reaches the model. Everything that does is counted
   * against the daily spend; `/register` and `/icon` cost a signature and a
   * cached favicon, so they are limited but not budgeted.
   */
  costs: boolean;
  handle: (ctx: RequestContext) => Promise<Result>;
};

/**
 * Where generated guidance lives between requests.
 *
 * Set EXPYR_GUIDANCE_DIR to a path the host actually keeps and entries survive
 * restarts; leave it unset and the cache is memory only, which still saves
 * every request after the first until the process ends. Either way a miss costs
 * one regeneration, never a wrong answer.
 */
const guidanceDir = process.env.EXPYR_GUIDANCE_DIR;
const guidanceDisk = guidanceDir ? new FileGuidanceStore<Guidance>(guidanceDir) : null;
export const guidanceCache = new LayeredGuidanceStore<Guidance>(guidanceDisk);

/**
 * What the cache is actually doing, as opposed to what it was asked to do.
 *
 * Being configured with a directory and being able to write to one are
 * different things: a host with no persistent disk mounted at that path accepts
 * the setting and then fails every write. The service copes — it degrades to
 * memory, which costs a regeneration per restart and nothing worse — but a
 * health check that reported "disk" on the strength of an environment variable
 * would be reporting the intention rather than the fact, and the whole point of
 * this line is to tell somebody deploying which one they got.
 */
async function guidanceCacheKind(): Promise<'disk' | 'memory'> {
  if (!guidanceDisk) return 'memory';
  return (await guidanceDisk.writable()) ? 'disk' : 'memory';
}

/**
 * How many *new* jurisdictions may be researched in one day.
 *
 * The route's rate limits meter requests; this meters spend, which is not the
 * same thing. A cached answer costs nothing however often it is asked for, and
 * a miss costs a live web search — so this is the ceiling that matters, and it
 * is deliberately far below the number of requests allowed. Thirteen document
 * types across a handful of regions is a busy launch day; forty is generous.
 */
const DAILY_NEW_GUIDANCE = Number(process.env.EXPYR_GUIDANCE_DAILY_NEW ?? 40);

let guidanceDay = '';
let guidanceGenerated = 0;

function mayGenerate(now = Date.now()): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== guidanceDay) {
    guidanceDay = today;
    guidanceGenerated = 0;
  }
  return guidanceGenerated < DAILY_NEW_GUIDANCE;
}

export const ROUTES: Record<string, Route> = {
  '/health': {
    method: 'GET',
    auth: false,
    metered: false,
    costs: false,
    handle: async () =>
      json({
        ok: true,
        apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
        registrationConfigured: canIssueTokens,
        /*
         * Whether guidance survives a restart. Reported because it is the
         * difference between one web search per jurisdiction and one per
         * deploy, and it is otherwise completely silent.
         */
        guidanceCache: await guidanceCacheKind(),
        guidanceHeld: guidanceDisk ? await guidanceDisk.size() : undefined,
      }),
  },

  /*
   * Fetched on the phone's behalf so the icon providers never see the person
   * asking, and cached hard because a service's logo does not change on a
   * Tuesday. Unauthenticated, because on the web this is an <img> src and an
   * image tag cannot carry a header — but metered, so it cannot be used as
   * somebody else's free bandwidth.
   */
  '/icon': {
    method: 'GET',
    auth: false,
    metered: true,
    costs: false,
    handle: async (ctx) => {
      const domain = ctx.query.get('domain');
      if (!isDomain(domain)) throw invalid('domain is required');

      const icon = await fetchBrandIcon(domain);
      if (!icon) throw new ServiceError('not_found', 'No icon found');

      ctx.note({ n_bytes: icon.body.length });
      return { kind: 'bytes', body: icon.body, type: icon.type, cacheSeconds: 2_592_000 };
    },
  },

  /*
   * Handing out a credential costs nothing but a signature, so it answers
   * before the daily model budget is touched. The bucket on it is the ceiling
   * on how fast a leaked app token can mint credentials.
   */
  '/register': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: false,
    handle: async () => {
      if (!canIssueTokens) throw unavailable('Registration is not configured.');
      return json({ token: issueInstallToken() });
    },
  },

  '/extract': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const request = parse(ExtractRequest, ctx.body);
      const result = await extractFromImage(request);
      // The count, never the fields. They are the document.
      ctx.note({ note: `confidence=${result.confidence}`, n_fields: result.fields.length });
      return json(result);
    },
  },

  /*
   * How many pages, and nothing else.
   *
   * The phone needs the count before it can divide the work up, and asking for
   * it by transcribing the first batch made every read serial: one round trip
   * before any of the others could start. This is pdf-lib alone — no model, no
   * cost, and back in the time it takes to parse the file.
   */
  '/pages': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: false,
    handle: async (ctx) => {
      const { fileBase64, mediaType } = parse(FileRequest, ctx.body);
      if (mediaType !== 'application/pdf') return json({ pageCount: 1 });
      const pageCount = await pdfPageCount(fileBase64);
      ctx.note({ n_pages: pageCount });
      return json({ pageCount });
    },
  },

  '/read': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const { fileBase64, mediaType, pages } = parse(FileRequest, ctx.body);

      /*
       * Only a PDF has pages to count, and only a PDF ever needed splitting:
       * an image is one page by definition and already arrives downscaled.
       *
       * The count goes back on every batch, not just the first, because it is
       * how the phone learns how many batches there are — and a phone that
       * gets no count is talking to a service old enough not to split, which
       * means the text it just received is the whole document.
       */
      let payload = fileBase64;
      let pageCount: number | undefined;

      if (mediaType === 'application/pdf') {
        // Parsed once and used for both. It used to be parsed twice per batch.
        const doc = await openPdf(fileBase64);
        pageCount = doc.getPageCount();
        if (pages) payload = await pagesOf(doc, pages.from, pages.to);
      }

      const text = await readDocument({ fileBase64: payload, mediaType });
      // Lengths and counts, never the text. The text is the document.
      ctx.note({ n_chars: text.length, ...(pageCount === undefined ? {} : { n_pages: pageCount }) });
      return json({ text, pageCount });
    },
  },

  '/brief': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const { text } = parse(TextRequest, ctx.body);
      const brief = await briefDocument(text);
      ctx.note({ n_points: brief.points.length, n_obligations: brief.obligations.length });
      return json(brief);
    },
  },

  '/ask': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const request = parse(AskRequest, ctx.body);
      const answer = await askDocument(request);
      // The question and the answer are the user's business; only the shape.
      ctx.note({ n_documents: request.documents.length, note: `answered=${answer.answered}` });
      return json(answer);
    },
  },

  /*
   * How to renew something, where the app has no hand-checked guide.
   *
   * The UAE guides in the app were verified one authority at a time, and they
   * remain the answer there. This is what happens everywhere else: a live
   * search, read back as steps, with the pages it came from attached — and
   * labelled in the app as guidance to check rather than instruction to follow.
   *
   * Cached by document type and region, so the two thousandth person to ask
   * about renewing a driving licence in Sharjah costs nothing at all.
   */
  '/guidance': {
    method: 'POST',
    auth: true,
    metered: true,
    // Answering from cache costs nothing; the ceiling below meters the misses.
    costs: false,
    handle: async (ctx) => {
      const request = parse(GuidanceRequest, ctx.body);
      const key = guidanceKey(request);
      const existing = await guidanceCache.get(key);

      // The key is a jurisdiction, not a person. Safe to log, and useful.
      if (isFresh(existing)) {
        ctx.note({
          note: `key=${key} cached=true standing=${existing.value.standing}`,
          n_sources: existing.value.sources.length,
        });
        return json(existing.value);
      }

      if (!existing && !mayGenerate()) {
        throw unavailable(
          'Expyr has not looked this one up yet, and cannot right now. Please try again tomorrow.'
        );
      }

      /*
       * Told plainly rather than answered with another "working on it", so the
       * app stops asking. A polled route that keeps saying "working" about
       * something that will not work is how one unanswerable question spends a
       * day's search budget.
       */
      if (guidanceCache.failedRecently(key)) {
        ctx.note({ note: `key=${key} failed-recently` });
        throw unavailable(
          'Expyr could not find out how this one is renewed where you are. It will keep the date and remind you in time.'
        );
      }

      /*
       * Started, not awaited — and this is the whole shape of the route.
       *
       * Researching a jurisdiction takes the better part of a minute, during
       * which a synchronous handler sends no bytes at all. Proxies close
       * connections that go quiet: Render's edge returned a 502 at twenty-one
       * seconds, so the answer was produced, cached, and thrown away with the
       * connection nobody was listening on any more.
       *
       * So the request says "working on it" straight away and the caller asks
       * again in a moment. The generation carries on regardless of who is still
       * listening, which means the second ask is served from cache in a
       * millisecond — and a phone that gave up, backgrounded, or lost signal
       * costs nothing extra when it comes back.
       */
      void guidanceCache
        .fetch(key, async () => {
          guidanceGenerated += 1;
          return generateGuidance(request);
        })
        .catch(() => {
          // Reported to the next caller as a failure to produce, not swallowed
          // here into a promise nobody is holding.
        });

      ctx.note({ note: `key=${key} cached=false started` });
      return working({ status: 'working' });
    },
  },

  '/subscriptions': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const { fileBase64, mediaType } = parse(FileRequest, ctx.body);
      if (mediaType === 'application/pdf') throw invalid('Send a screenshot, not a PDF.');

      const today = new Date().toISOString().slice(0, 10);
      const found = await readSubscriptions({ imageBase64: fileBase64, mediaType, today });
      // The names and prices are the user's business; only the count is logged.
      ctx.note({ n_found: found.subscriptions.length });
      return json(found);
    },
  },
};

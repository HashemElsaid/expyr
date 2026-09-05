import { fetchBrandIcon, isDomain } from './brand-icon.ts';
import { askDocument, briefDocument, readDocument } from './comprehend.ts';
import { invalid, ServiceError, unavailable } from './errors.ts';
import { extractFromImage } from './extract.ts';
import { canIssueTokens, issueInstallToken } from './install-token.ts';
import type { LogFields } from './log.ts';
import { AskRequest, ExtractRequest, FileRequest, parse, TextRequest } from './schemas.ts';
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
  | { kind: 'json'; body: unknown }
  | { kind: 'bytes'; body: Buffer; type: string; cacheSeconds: number };

const json = (body: unknown): Result => ({ kind: 'json', body });

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

  '/read': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: true,
    handle: async (ctx) => {
      const { fileBase64, mediaType } = parse(FileRequest, ctx.body);
      const text = await readDocument({ fileBase64, mediaType });
      // The length, not the text. The text is the document.
      ctx.note({ n_chars: text.length });
      return json({ text });
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

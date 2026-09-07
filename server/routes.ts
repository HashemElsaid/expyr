import { fetchBrandIcon, isDomain } from './brand-icon.ts';
import { askDocument, briefDocument, readDocument } from './comprehend.ts';
import { invalid, ServiceError, unavailable } from './errors.ts';
import { extractFromImage } from './extract.ts';
import { FileGuidanceStore, isFresh, LayeredGuidanceStore } from './guidance-cache.ts';
import { generateGuidance, type Guidance } from './guidance.ts';
import { accountKeyFor, appleKeys, verifyAppleIdentityToken } from './apple-identity.ts';
import { appleCredentials, appleKeyUsable, fetchTransaction } from './apple-store.ts';
import {
  accountFor,
  balanceOf,
  FileCreditStore,
  link,
  MemoryCreditStore,
  redeem,
  sellable,
  type CreditStore,
} from './credit-ledger.ts';
import { canIssueTokens, issueInstallToken } from './install-token.ts';
import { openPdf, pagesOf, pdfPageCount } from './pdf.ts';
import { grantFor } from './products.ts';
import type { LogFields } from './log.ts';
import {
  AskRequest,
  ExtractRequest,
  FileRequest,
  GuidanceRequest,
  IdentityRequest,
  RedeemRequest,
  TextRequest,
  guidanceKey,
  parse,
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
  /**
   * Which install is asking, when it presented a credential this service
   * signed. Null for an older build that has none. Credits belong to somebody,
   * so the routes that touch them need to know who.
   */
  install: string | null;
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
/**
 * Where balances live.
 *
 * Configured with a directory or not at all, and the difference decides
 * whether this service may sell credits: `grant` refuses outright when the
 * store is not durable, so a deployment with no disk cannot take money for
 * something it will forget. Render's free plan has no persistent disk, which
 * is exactly the case that rule exists for.
 *
 * The directory being unusable is a third case, and it took the whole service
 * down once. EXPYR_CREDITS_DIR was set to a path on a disk that had not been
 * attached yet, FileCreditStore's constructor tried to create it, and the
 * EACCES from that killed the process at import. Scanning, reading, guidance
 * and reminders all went with it, because of a directory none of them use.
 *
 * So a bad directory now falls back to memory, which refuses to sell rather
 * than selling into a hole, and says so loudly on the way past. Exactly the
 * rule the Apple credentials already follow: refusing to start is never the
 * right answer to "this one feature is not configured".
 */
function openCreditStore(): CreditStore {
  const dir = process.env.EXPYR_CREDITS_DIR;
  if (!dir) return new MemoryCreditStore();

  try {
    return new FileCreditStore(dir);
  } catch (error) {
    /*
     * Deliberately shouted. Somebody who set this variable meant to sell
     * credits, and is now running a service that will refuse every purchase.
     * That has to be findable in the logs without reading this file.
     */
    console.error(
      `[expyr] EXPYR_CREDITS_DIR is set to ${dir} but it cannot be written to, so credits cannot be sold. Attach a disk mounted there, or unset the variable. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return new MemoryCreditStore();
  }
}

export const creditStore: CreditStore = openCreditStore();

/**
 * The bundle identifier every genuine Apple identity token is issued for. A
 * token for a different app is a valid Apple token and nothing to do with us.
 */
const BUNDLE_ID = process.env.EXPYR_BUNDLE_ID ?? 'com.expyr.app';

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
         * Whether credits can be sold, and it is reported for the same reason
         * the guidance cache is: it is otherwise completely silent. A deploy
         * whose disk did not mount serves every other route perfectly and
         * refuses every purchase, and there is no way to tell from outside.
         */
        creditStore: creditStore.durable ? 'disk' : 'memory',
        /*
         * Not whether the Apple key is set, which proves nothing, but whether
         * it can sign. A .p8 pasted into a field that ate its newlines is
         * still a string and still fails at the first real purchase, as a 401
         * from Apple with no explanation.
         */
        appleKeyUsable: appleKeyUsable(appleCredentials()),
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
  /**
   * Signing in, so credits outlive the phone that bought them.
   *
   * Apple keeps no record of spent consumables and the keychain does not
   * survive a device wipe, so a balance tied to an install is a balance that
   * ends with the install. This is the only route that establishes who
   * somebody is, and everything about that verification is in
   * apple-identity.ts rather than here.
   *
   * Linking moves whatever the install had onto the account, once. Somebody who
   * bought credits and then signed in keeps them; signing in a second time
   * moves nothing, because the alternative is an app that invents money every
   * time a request is retried.
   */
  '/account/link': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: false,
    handle: async (ctx) => {
      const { identityToken } = parse(IdentityRequest, ctx.body);
      if (!ctx.install) throw invalid('this build cannot be identified');

      const identity = await verifyAppleIdentityToken(identityToken, BUNDLE_ID, appleKeys);
      const account = accountKeyFor(identity);
      const balance = await link(creditStore, ctx.install, account);

      // The account key is a hash, not a person. Safe to log, and useful.
      ctx.note({ note: `linked account=${account} sellable=${sellable(creditStore)}` });
      return json({ account, balance, sellable: sellable(creditStore) });
    },
  },

  /** What this account has left, for a phone that has just been set up. */
  '/account/balance': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: false,
    handle: async (ctx) => {
      const { identityToken } = parse(IdentityRequest, ctx.body);
      const identity = await verifyAppleIdentityToken(identityToken, BUNDLE_ID, appleKeys);
      const account = accountKeyFor(identity);
      return json({ account, balance: await balanceOf(creditStore, account) });
    },
  },

  /**
   * Turns a purchase into credits, or into Pro.
   *
   * The phone is not believed about any of it. It supplies a transaction
   * identifier, Apple is asked what that transaction actually was, and the
   * catalogue in products.ts decides what the answer is worth. A phone
   * claiming to have bought the largest pack gets whatever Apple says it
   * bought, which for a fabricated identifier is nothing.
   *
   * Safe to call repeatedly, and it will be: iOS replays every unfinished
   * transaction on each launch, and the phone deliberately does not finish one
   * until this route has answered. So the ordinary path includes redeeming the
   * same purchase twice, and the ledger pays it once.
   */
  '/purchase/redeem': {
    method: 'POST',
    auth: true,
    metered: true,
    costs: false,
    handle: async (ctx) => {
      const claim = parse(RedeemRequest, ctx.body);
      if (!ctx.install) throw invalid('this build cannot be identified');

      const credentials = appleCredentials();
      if (!credentials) {
        // Nothing is granted on trust. Better a refusal the phone can retry
        // than credits handed out because a key was not configured.
        throw unavailable('purchases cannot be checked with Apple just yet');
      }

      const transaction = await fetchTransaction(
        credentials,
        claim.transactionId,
        claim.sandbox === true
      );

      /*
       * Apple's answer wins over the phone's claim. They should never differ;
       * if they do, the phone is either broken or lying and neither is a
       * reason to grant anything.
       */
      if (transaction.productId !== claim.productId) {
        throw invalid('that purchase was for a different product');
      }

      const grant = grantFor(transaction.productId);
      if (!grant) {
        /*
         * A real purchase of something this service has not been taught yet.
         * Refusing leaves it unfinished with Apple, so it can be redeemed
         * after a deploy rather than being lost.
         */
        throw invalid('this version does not know that product yet');
      }

      const account = await accountFor(creditStore, ctx.install);

      if (grant.kind === 'pro') {
        /*
         * Nothing to store. A non-consumable lives with Apple for ever and
         * comes back from getAvailablePurchases on any phone the buyer signs
         * into, so Apple is already the record and a second one here could
         * only disagree with it.
         */
        ctx.note({ note: `redeemed pro txn=${transaction.transactionId}` });
        return json({ productId: transaction.productId, pro: true });
      }

      if (!sellable(creditStore)) {
        throw unavailable('credits cannot be granted just yet');
      }

      const { balance, granted } = await redeem(
        creditStore,
        account,
        transaction.transactionId,
        grant.credits
      );

      ctx.note({
        note: `redeemed ${transaction.productId} txn=${transaction.transactionId} granted=${granted} account=${account}`,
      });
      return json({ productId: transaction.productId, credits: grant.credits, balance, granted });
    },
  },

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

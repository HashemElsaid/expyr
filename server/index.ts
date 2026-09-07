import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, rateLimited, ServiceError, toServiceError, tooLarge, unauthorised } from './errors.ts';
import { verifyInstallToken } from './install-token.ts';
import { log, newRequestId, type LogFields } from './log.ts';
import { BUCKETS, limiter } from './rate-limit.ts';
import { ROUTES, type RequestContext, type Result } from './routes.ts';

/**
 * The reading service.
 *
 * It exists for one reason: the Anthropic API key must never ship inside the
 * phone app, where anyone could extract it and spend the credits. Everything
 * else here follows from that — the routes are thin, nothing is stored, and the
 * layers below are all about making sure a leaked app token costs a day's
 * quota rather than a bill.
 *
 * This file is now only the wiring: read the body, work out who is asking,
 * apply the ceilings, dispatch, and answer. What each route does lives in
 * routes.ts; what it will accept lives in schemas.ts.
 */

const PORT = Number(process.env.PORT ?? 8787);

/**
 * The shared secret the app sends. It ships inside the bundle, so a determined
 * person can extract it — it raises the bar, and buys exactly one thing: the
 * right to ask for an install credential, which is what everything else is
 * counted against.
 *
 * The old name is still read because it is what is set in Render's dashboard
 * today. Dropping it would not fail loudly — the constant would simply be
 * undefined and the check below would wave every request through.
 */
const APP_TOKEN = process.env.EXPYR_APP_TOKEN ?? process.env.RENEWLY_APP_TOKEN;

/**
 * Base64 inflates by about a third, and PDFs are far larger than photos.
 * Claude accepts a 32 MB request, so this leaves room while staying below it.
 */
const MAX_BODY_BYTES = 24 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(tooLarge('That file is too large to read. Try a smaller one.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Behind a proxy the real client address arrives in x-forwarded-for. */
function addressOf(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
  return first ?? req.socket.remoteAddress ?? 'unknown';
}

function send(res: ServerResponse, status: number, result: Result, requestId: string) {
  const headers: Record<string, string> = { 'x-request-id': requestId };

  if (result.kind === 'bytes') {
    res.writeHead(status, {
      ...headers,
      'Content-Type': result.type,
      'Content-Length': String(result.body.length),
      'Cache-Control': `public, max-age=${result.cacheSeconds}`,
    });
    res.end(result.body);
    return;
  }

  res.writeHead(status, { ...headers, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body));
}

function sendError(res: ServerResponse, error: ServiceError, requestId: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': requestId,
  };
  if (error.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(error.retryAfterSeconds);
  }
  res.writeHead(error.status, headers);
  /*
   * `error` is the field the app has always read, so it stays. `code` is the
   * new part: something to branch on that is not the text of a sentence.
   */
  res.end(JSON.stringify({ error: error.message, code: error.code, request: requestId }));
}

const server = createServer(async (req, res) => {
  const requestId = newRequestId();
  const started = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-expyr-token, x-renewly-token, x-expyr-install');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'x-request-id, Retry-After');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const route = ROUTES[path];

  /** Fields this request wants in its one log line. */
  const fields: LogFields = { request: requestId, route: path };
  const note = (extra: Partial<LogFields>) => Object.assign(fields, extra);

  try {
    /*
     * HEAD is GET without the body, and HTTP says so. Anything answering GET
     * has to answer HEAD, and node discards the body for us.
     *
     * This was found the hard way: an uptime monitor reported the service down
     * while it was demonstrably serving every request, because it led with
     * HEAD and got a 404. Load balancers, uptime checkers and platform health
     * probes nearly all do, so the service read as broken to every automated
     * thing that looked at it while looking perfect to everything that used
     * it.
     */
    const wanted = req.method === 'HEAD' ? 'GET' : req.method;
    if (!route || route.method !== wanted) {
      throw new ServiceError('not_found', 'Not found');
    }

    if (route.auth && APP_TOKEN) {
      // Both header names, so a phone running a cached bundle is not locked out.
      const sent = req.headers['x-expyr-token'] ?? req.headers['x-renewly-token'];
      if (sent !== APP_TOKEN) throw unauthorised();
    }

    /*
     * Every limit is counted against the install when there is one, and against
     * the address when there is not. Older builds have no install credential and
     * keep working on the address alone, which is exactly the weaker footing
     * this is meant to move phones off.
     */
    const install = verifyInstallToken(req.headers['x-expyr-install']);
    fields.install = install?.id ?? 'anonymous';
    const client = install ? `install:${install.id}` : `ip:${addressOf(req)}`;

    if (route.metered) {
      const limit = limiter.check(client, path);
      if (!limit.allowed) {
        const what = BUCKETS[path]?.label ?? 'requests';
        throw rateLimited(
          `Too many ${what} in a short time. Try again shortly.`,
          limit.retryAfterSeconds
        );
      }

      if (install) {
        const daily = limiter.installBudget(install.id, path);
        if (!daily.ok) {
          throw rateLimited('That is as much as Expyr can do today. It starts again tomorrow.', 3600);
        }
      }
    }

    /*
     * The day's ceiling for everything that reaches the model. Addresses are
     * free, so a stolen token driven from a hundred of them would pass every
     * limit above; this is the line that cannot be walked around, and crossing
     * it is worth shouting about because it should never happen in normal use.
     */
    if (route.costs) {
      const budget = limiter.dailyBudget();
      if (!budget.ok) {
        log('error', {
          request: requestId,
          route: path,
          code: 'budget_spent',
          n_used: budget.used,
          n_max: budget.max,
        });
        throw new ServiceError(
          'unavailable',
          'Expyr is unusually busy right now. Please try again later.',
          3600
        );
      }
    }

    // Deliberately never logged — these are people's ID documents and contracts.
    const body = req.method === 'POST' ? await readBody(req) : '';
    const ctx: RequestContext = {
      body,
      query: url.searchParams,
      note,
      install: install?.id ?? null,
    };

    const result = await route.handle(ctx);
    const status = result.kind === 'json' ? (result.status ?? 200) : 200;
    send(res, status, result, requestId);
    log('info', { ...fields, status, ms: Date.now() - started });
  } catch (raw) {
    const error = toServiceError(raw);
    sendError(res, error, requestId);

    /*
     * The description is for us and never leaves the process. It is truncated
     * and never the error object, because an upstream failure can carry back a
     * fragment of whatever was sent, and a log is the last place somebody's
     * tenancy contract should turn up.
     */
    log(error.code === 'internal' ? 'error' : 'warn', {
      ...fields,
      status: error.status,
      ms: Date.now() - started,
      code: error.code,
      note: error.code === 'internal' ? describe(raw) : undefined,
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY is not set — scanning will fail until you add it.');
  }
  if (!process.env.EXPYR_INSTALL_SECRET) {
    console.warn('⚠  EXPYR_INSTALL_SECRET is not set — every phone falls back to the shared token.');
  }
  console.log(`Expyr reading service listening on http://0.0.0.0:${PORT}`);
});

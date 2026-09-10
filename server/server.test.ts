import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

/**
 * The service, actually started.
 *
 * The tests beside this one exercise modules in isolation, which is where the
 * logic lives — but they all import their subject, and importing is not
 * running. Node executes these TypeScript sources directly with no build step,
 * and its type stripping refuses a handful of things `tsc --noEmit` is
 * perfectly happy with. A constructor parameter property typechecked cleanly,
 * passed every unit test, and crashed the service on boot.
 *
 * So this boots it, over a real socket, and asks it the questions that need no
 * API key: does it start, does it route, does it refuse what it should refuse,
 * and does it say why in the shape the app expects.
 */

const PORT = 8899;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'test-app-token';

let child: ChildProcess;

async function get(path: string, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, { headers });
}

async function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
}

const authed = { 'x-expyr-token': TOKEN };

before(async () => {
  child = spawn(process.execPath, ['index.ts'], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      EXPYR_APP_TOKEN: TOKEN,
      EXPYR_INSTALL_SECRET: 'a-secret-long-enough-for-tests',
      // No ANTHROPIC_API_KEY on purpose: nothing here should reach the model.
      ANTHROPIC_API_KEY: '',
    },
    stdio: 'ignore',
  });

  // Wait for it to answer rather than guessing at a delay.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await get('/health');
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the service did not start');
});

after(() => {
  child?.kill();
});

describe('starting up', () => {
  it('answers /health without a credential', async () => {
    const response = await get('/health');
    assert.equal(response.status, 200);

    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.ok, true);
    // It reports what it is configured for rather than pretending.
    assert.equal(body.apiKeyConfigured, false);
    assert.equal(body.registrationConfigured, true);
  });

  it('puts a request id on every answer', async () => {
    const response = await get('/health');
    assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{8}$/);
  });
});

describe('routing', () => {
  it('refuses a path it does not have', async () => {
    const response = await get('/nope');
    assert.equal(response.status, 404);
    assert.equal(((await response.json()) as { code: string }).code, 'not_found');
  });

  it('refuses the right path with the wrong method', async () => {
    const response = await post('/health');
    assert.equal(response.status, 404);
  });

  /*
   * An uptime monitor reported the service down while it was serving every
   * request perfectly. It led with HEAD, as load balancers and platform health
   * probes nearly all do, and got a 404.
   */
  it('answers HEAD wherever it answers GET', async () => {
    const response = await fetch(`${BASE}/health`, { method: 'HEAD' });
    assert.equal(response.status, 200);
  });

  it('still refuses HEAD on a path it does not have', async () => {
    const response = await fetch(`${BASE}/nope`, { method: 'HEAD' });
    assert.equal(response.status, 404);
  });

  /* HEAD must not become a way around the method check on a POST route. */
  it('does not let HEAD reach a route that only takes POST', async () => {
    const response = await fetch(`${BASE}/register`, { method: 'HEAD' });
    assert.equal(response.status, 404);
  });

  it('answers a preflight so a browser will follow up', async () => {
    const response = await fetch(`${BASE}/extract`, { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('access-control-allow-headers') ?? '', /x-expyr-install/);
  });
});

describe('the credential', () => {
  it('turns away a request with no app token', async () => {
    const response = await post('/register');
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as { code: string }).code, 'unauthorised');
  });

  it('turns away a request with the wrong one', async () => {
    const response = await post('/register', {}, { 'x-expyr-token': 'guess' });
    assert.equal(response.status, 401);
  });

  it('issues an install credential to a request with the right one', async () => {
    const response = await post('/register', {}, authed);
    assert.equal(response.status, 200);

    const body = (await response.json()) as { token?: string };
    assert.equal(typeof body.token, 'string');
    assert.equal(body.token?.split('.').length, 3);
  });

  it('leaves /icon open, because on the web it is an image tag', async () => {
    // A domain that cannot be one: refused for being invalid, not for being anonymous.
    const response = await get('/icon?domain=' + encodeURIComponent('...'));
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'invalid_request');
  });
});

describe('what it will accept', () => {
  it('refuses a body that is not the shape of the route', async () => {
    const response = await post('/extract', { nothing: 'useful' }, authed);
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'invalid_request');
  });

  it('refuses a body that is not JSON at all', async () => {
    const response = await fetch(`${BASE}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authed },
      body: 'not json',
    });
    assert.equal(response.status, 400);
  });

  /*
   * The reason is deliberately not relayed. It names fields of a request the
   * person holding the phone never wrote, and it can quote the values in them.
   */
  it('does not tell the caller which field was wrong', async () => {
    const response = await post('/ask', { question: '' }, authed);
    const body = (await response.json()) as { error: string };
    assert.doesNotMatch(body.error, /question|documents|records|expected/i);
  });

  it('answers every failure with a code and a request id', async () => {
    const response = await post('/extract', {}, authed);
    const body = (await response.json()) as { error?: string; code?: string; request?: string };
    assert.equal(typeof body.error, 'string');
    assert.equal(typeof body.code, 'string');
    assert.equal(typeof body.request, 'string');
  });
});

describe('what guidance will be asked about', () => {
  /*
   * Stricter than the other routes because each uncached combination costs a
   * live web search. A free-text region would let one leaked app token mint an
   * unbounded number of them, so the key space is bounded at the door.
   */
  const good = {
    typeId: 'residence-visa',
    label: 'Residence Visa',
    country: 'AE',
    countryName: 'United Arab Emirates',
    region: 'Dubai',
  };

  it('refuses a country that is not a country code', async () => {
    const response = await post('/guidance', { ...good, country: 'Atlantis' }, authed);
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'invalid_request');
  });

  it('refuses a region long enough to be a cache-busting string', async () => {
    const response = await post('/guidance', { ...good, region: 'x'.repeat(300) }, authed);
    assert.equal(response.status, 400);
  });

  it('refuses a typeId that is not the app’s own slug shape', async () => {
    const response = await post('/guidance', { ...good, typeId: '../../secrets' }, authed);
    assert.equal(response.status, 400);
  });

  it('needs the app token like every other route that costs money', async () => {
    const response = await post('/guidance', good);
    assert.equal(response.status, 401);
  });

  /*
   * The route must answer immediately for a jurisdiction it has never seen,
   * rather than holding the connection open for the minute the research takes.
   * A request that sends no bytes for that long is one a proxy closes — Render's
   * edge returned 502 at twenty-one seconds, and the answer was produced,
   * cached, and thrown away down a connection nobody was listening on.
   *
   * There is no API key in this suite, so the research fails the moment it
   * starts. That is exactly the point: the answer below must arrive anyway.
   */
  it('says "working on it" at once rather than holding the connection', async () => {
    const started = Date.now();
    const response = await post('/guidance', { ...good, region: 'Fujairah' }, authed);
    const took = Date.now() - started;

    assert.equal(response.status, 202);
    assert.equal(((await response.json()) as { status: string }).status, 'working');
    assert.ok(took < 5000, `answered in ${took}ms; it must not wait on the research`);
  });
});

describe('the ceilings', () => {
  /*
   * Minting install credentials is the one thing the bundled app token can do,
   * so five a day is the ceiling on how fast a leaked one spreads. Proved
   * through a real socket rather than against the limiter, because the wiring
   * between the two is the part that could be missing.
   */
  it('stops a leaked app token minting credentials without limit', async () => {
    let refused = 0;
    for (let i = 0; i < 8; i += 1) {
      const response = await post('/register', {}, authed);
      if (response.status === 429) refused += 1;
    }

    assert.ok(refused > 0, 'expected the registration bucket to refuse eventually');
  });

  it('says how long to wait when it refuses', async () => {
    let retryAfter: string | null = null;
    for (let i = 0; i < 8 && !retryAfter; i += 1) {
      const response = await post('/register', {}, authed);
      if (response.status === 429) retryAfter = response.headers.get('retry-after');
    }

    assert.match(retryAfter ?? '', /^\d+$/);
  });
});

/*
 * The route that turns money into credits. These run against the real service
 * with no Apple key configured, which is the state every deploy starts in, and
 * they pin the two properties that matter most in that state: nothing is
 * granted, and the refusal is one the phone can retry rather than a crash.
 *
 * They also prove the route boots at all. That is the whole reason this file
 * exists: node strips types rather than checking them, so a route can
 * typecheck perfectly and still take the service down on start.
 */
describe('redeeming a purchase', () => {
  it('needs the app credential like everything else that costs', async () => {
    const response = await post('/purchase/redeem', {
      transactionId: '2000000123456789',
      productId: 'credits.large',
    });
    assert.equal(response.status, 401);
  });

  it('refuses a body that is not a purchase', async () => {
    const response = await post('/purchase/redeem', { transactionId: '' }, authed);
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'invalid_request');
  });

  /*
   * With no key configured the service cannot ask Apple anything, and the one
   * thing it must not do is take the phone's word for it. A refusal leaves the
   * transaction unfinished with Apple, so the purchase survives and is
   * redeemed once a key is set.
   */
  it('grants nothing at all when it cannot ask Apple', async () => {
    const response = await post(
      '/purchase/redeem',
      { transactionId: '2000000123456789', productId: 'credits.large', sandbox: true },
      authed
    );

    assert.notEqual(response.status, 200, 'must never grant on trust');
    const body = (await response.json()) as { credits?: number; balance?: number };
    assert.equal(body.credits, undefined);
    assert.equal(body.balance, undefined);
  });
});

/*
 * A directory that cannot be written to took the whole service down once:
 * EXPYR_CREDITS_DIR pointed at a disk that had not been attached, the store's
 * constructor tried to create it, and the EACCES killed the process at import.
 * Scanning, reading, guidance and reminders all went with it, over a directory
 * none of them use.
 */
describe('a credits directory that cannot be written to', () => {
  const BROKEN_PORT = 8898;
  const BROKEN = `http://127.0.0.1:${BROKEN_PORT}`;
  let broken: ChildProcess;
  /** An ordinary file. Nothing can be created underneath it. */
  const blocker = join(mkdtempSync(join(tmpdir(), 'expyr-nodisk-')), 'not-a-directory');

  before(async () => {
    writeFileSync(blocker, 'this is a file, not a mount point');
    broken = spawn(process.execPath, ['index.ts'], {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        PORT: String(BROKEN_PORT),
        EXPYR_APP_TOKEN: TOKEN,
        EXPYR_INSTALL_SECRET: 'a-secret-long-enough-for-tests',
        ANTHROPIC_API_KEY: '',
        /*
         * A directory inside a *file*, which no operating system will create.
         *
         * The first attempt used an absolute unix path that cannot exist on
         * Linux, and on Windows it was cheerfully created at C:\proc — so the
         * store opened, the service started for the ordinary reason, and the
         * test passed while proving nothing.
         */
        EXPYR_CREDITS_DIR: join(blocker, 'credits'),
      },
      stdio: 'ignore',
    });

    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        if ((await fetch(`${BROKEN}/health`)).ok) return;
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('the service died over a directory it did not need');
  });

  after(() => {
    broken?.kill();
  });

  it('still starts, and still serves everything that has nothing to do with selling', async () => {
    assert.equal((await fetch(`${BROKEN}/health`)).status, 200);
  });

  it('refuses to sell rather than selling into a hole', async () => {
    const response = await fetch(`${BROKEN}/purchase/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-expyr-token': TOKEN },
      body: JSON.stringify({ transactionId: '2000000123456789', productId: 'credits.large' }),
    });
    assert.notEqual(response.status, 200, 'must never grant into a store it cannot write');
  });
});

/*
 * Every price used to be arithmetic on the phone, and a balance in local
 * storage is a number its owner can edit. These run against the booted service
 * and pin the parts that do not need an API key: the route exists, it is
 * behind the credential, and it reports what can be spent rather than what the
 * caller claims.
 */
describe('what the service says can be spent', () => {
  it('needs the app credential like everything that costs', async () => {
    assert.equal((await post('/account/available')).status, 401);
  });

  it('needs an install credential, since that is what it resolves', async () => {
    const response = await post('/account/available', {}, authed);
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'invalid_request');
  });

  /*
   * Reading and asking are charged before the model is called, so a request
   * with no credential must not reach the model at all. Without an API key the
   * service cannot answer anyway, and the point is that it fails on the
   * credential rather than on the key.
   */
  it('turns away reading and asking without the credential', async () => {
    assert.equal((await post('/read', { fileBase64: 'x', mediaType: 'image/jpeg' })).status, 401);
    assert.equal((await post('/ask', { question: 'x', documents: [] })).status, 401);
  });
});

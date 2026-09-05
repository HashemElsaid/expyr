import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
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

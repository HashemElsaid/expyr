import assert from 'node:assert/strict';
import { generateKeyPairSync, verify as verifySignature } from 'node:crypto';
import { test } from 'node:test';

import {
  appleCredentials,
  appleKeyUsable,
  decodeSignedPayload,
  fetchTransaction,
  PurchaseNotVerified,
  signToken,
  type AppleCredentials,
} from './apple-store.ts';

/** A real P-256 key, so the signing is exercised rather than described. */
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

const CREDENTIALS: AppleCredentials = {
  keyId: '2AX49534J2',
  issuerId: '51eccb44-a2ab-4d3c-852f-362796657233',
  privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  bundleId: 'com.expyr.app',
};

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);
const NEWLINE = String.fromCharCode(10);

function fromBase64Url(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Builds a reply shaped like Apple's, signed by nobody, which is enough. */
function signedPayload(claims: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `header.${body}.signature`;
}

function replying(claims: Record<string, unknown>, status = 200): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ signedTransactionInfo: signedPayload(claims) }),
    }) as unknown as Response) as unknown as typeof fetch;
}

const GENUINE = {
  transactionId: '2000000123456789',
  originalTransactionId: '2000000123456789',
  productId: 'credits.large',
  bundleId: 'com.expyr.app',
  environment: 'Sandbox',
  quantity: 1,
};

// ------------------------------------------------------------------- signing

test('the token is signed the way Apple requires', () => {
  const token = signToken(CREDENTIALS, NOW);
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

  const header = JSON.parse(fromBase64Url(encodedHeader).toString('utf8'));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, CREDENTIALS.keyId);

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
  assert.equal(payload.iss, CREDENTIALS.issuerId);
  assert.equal(payload.aud, 'appstoreconnect-v1');
  assert.equal(payload.bid, 'com.expyr.app');
  assert.equal(payload.iat, Math.floor(NOW / 1000));
  assert.ok(payload.exp > payload.iat, 'expires after it was issued');
  assert.ok(payload.exp - payload.iat <= 3600, 'Apple rejects anything over an hour');

  /*
   * The detail that fails silently. JWT wants the signature as raw r‖s and
   * node's EC signing produces DER unless told otherwise; a DER signature is
   * not an error here, it is a 401 from Apple with no explanation. A raw
   * P-256 signature is exactly 64 bytes and DER is not.
   */
  const signature = fromBase64Url(encodedSignature);
  assert.equal(signature.length, 64, 'must be raw r‖s, not DER');

  assert.ok(
    verifySignature(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      signature
    ),
    'the signature verifies against the public half'
  );
});

test('a fresh token is issued for each call', () => {
  const early = signToken(CREDENTIALS, NOW);
  const later = signToken(CREDENTIALS, NOW + 60_000);
  assert.notEqual(early, later);
});

// ------------------------------------------------------------------ decoding

test('reads the body of a signed payload', () => {
  assert.deepEqual(decodeSignedPayload(signedPayload({ productId: 'credits.small' })), {
    productId: 'credits.small',
  });
});

test('refuses anything that is not a signed payload', () => {
  for (const rubbish of [undefined, null, 42, '', 'not.a.jws.at.all', 'onepart']) {
    assert.throws(() => decodeSignedPayload(rubbish), PurchaseNotVerified);
  }
});

// -------------------------------------------------------------- the checks

test('accepts a genuine purchase of ours', async () => {
  const transaction = await fetchTransaction(
    CREDENTIALS,
    '2000000123456789',
    true,
    replying(GENUINE),
    NOW
  );
  assert.equal(transaction.productId, 'credits.large');
  assert.equal(transaction.bundleId, 'com.expyr.app');
});

/*
 * A real Apple transaction from somebody else's app is still nothing to do
 * with us. Without this, any purchase made anywhere on the store buys credits.
 */
test('refuses a genuine purchase from another app', async () => {
  await assert.rejects(
    () =>
      fetchTransaction(
        CREDENTIALS,
        '2000000123456789',
        true,
        replying({ ...GENUINE, bundleId: 'com.someone.else' }),
        NOW
      ),
    /different app/
  );
});

/* Apple gave the money back, so the credits are not theirs. */
test('refuses a refunded purchase', async () => {
  await assert.rejects(
    () =>
      fetchTransaction(
        CREDENTIALS,
        '2000000123456789',
        true,
        replying({ ...GENUINE, revocationDate: NOW }),
        NOW
      ),
    /refunded/
  );
});

test('refuses when Apple describes a different transaction', async () => {
  await assert.rejects(
    () =>
      fetchTransaction(
        CREDENTIALS,
        '2000000123456789',
        true,
        replying({ ...GENUINE, transactionId: '2000000999999999' }),
        NOW
      ),
    /different transaction/
  );
});

test('refuses a transaction Apple has never heard of', async () => {
  await assert.rejects(
    () => fetchTransaction(CREDENTIALS, '2000000123456789', true, replying({}, 404), NOW),
    /no record/
  );
});

test('says so plainly when Apple refuses our key', async () => {
  await assert.rejects(
    () => fetchTransaction(CREDENTIALS, '2000000123456789', true, replying({}, 401), NOW),
    /refused our key/
  );
});

/* Not worth a request, and keeps anything odd out of the URL. */
test('refuses an identifier that is not one', async () => {
  for (const bad of ['', 'abc', '../../etc', '1'.repeat(40)]) {
    await assert.rejects(
      () => fetchTransaction(CREDENTIALS, bad, true, replying(GENUINE), NOW),
      /not a transaction identifier/
    );
  }
});

test('asks the sandbox about sandbox purchases and production about the rest', async () => {
  const asked: string[] = [];
  const spy = (async (url: string) => {
    asked.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ signedTransactionInfo: signedPayload(GENUINE) }),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  await fetchTransaction(CREDENTIALS, '2000000123456789', true, spy, NOW);
  await fetchTransaction(CREDENTIALS, '2000000123456789', false, spy, NOW);

  assert.match(asked[0], /storekit-sandbox\.itunes\.apple\.com/);
  assert.match(asked[1], /api\.storekit\.itunes\.apple\.com/);
  assert.doesNotMatch(asked[1], /sandbox/);
});

// ------------------------------------------------------------- credentials

/*
 * The service does plenty that has nothing to do with selling. Refusing to
 * start without payment keys would take scanning and reading down with it.
 */
test('reports missing credentials rather than refusing to start', () => {
  assert.equal(appleCredentials({}), null);
  assert.equal(appleCredentials({ EXPYR_APPLE_KEY_ID: 'x' }), null);
  assert.equal(appleCredentials({ EXPYR_APPLE_KEY_ID: 'x', EXPYR_APPLE_ISSUER_ID: 'y' }), null);
});

/* Render hands multi-line values through with the newlines escaped. */
test('unescapes a key pasted as one line', () => {
  const credentials = appleCredentials({
    EXPYR_APPLE_KEY_ID: 'x',
    EXPYR_APPLE_ISSUER_ID: 'y',
    EXPYR_APPLE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIG\\n-----END PRIVATE KEY-----',
  });
  assert.ok(credentials);
  assert.ok(credentials.privateKeyPem.includes('\n'));
  assert.ok(!credentials.privateKeyPem.includes('\\n'));
});

test('defaults the bundle identifier to ours', () => {
  const credentials = appleCredentials({
    EXPYR_APPLE_KEY_ID: 'x',
    EXPYR_APPLE_ISSUER_ID: 'y',
    EXPYR_APPLE_KEY: 'z',
  });
  assert.equal(credentials?.bundleId, 'com.expyr.app');
});

/*
 * The failure this exists to catch. A .p8 pasted into a dashboard field that
 * eats newlines is still a string, passes every presence check, and fails at
 * the first real purchase as a 401 from Apple with no explanation.
 */
test('says a real key can sign', () => {
  assert.equal(appleKeyUsable(CREDENTIALS), true);
});

test('says a mangled key cannot', () => {
  assert.equal(
    appleKeyUsable({ ...CREDENTIALS, privateKeyPem: CREDENTIALS.privateKeyPem.split(NEWLINE).join(' ') }),
    false
  );
  assert.equal(appleKeyUsable({ ...CREDENTIALS, privateKeyPem: 'not a key at all' }), false);
  assert.equal(appleKeyUsable({ ...CREDENTIALS, privateKeyPem: '' }), false);
});

test('says nothing is usable when nothing is configured', () => {
  assert.equal(appleKeyUsable(null), false);
});

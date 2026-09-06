import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { test } from 'node:test';

import {
  accountKeyFor,
  InvalidIdentityToken,
  verifyAppleIdentityToken,
  type AppleKey,
} from './apple-identity.ts';

/**
 * These tests sign real tokens with a real key and hand the verifier the
 * matching public key, so it has no idea it is not talking to Apple. Nothing
 * about the verification is stubbed, which is the point: this is the one place
 * in the service where a mistake hands somebody's balance to a stranger.
 */

const AUDIENCE = 'com.expyr.app';
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);

function makeKeypair(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256' } as AppleKey;
  return { privateKey, jwk };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(
  privateKey: KeyObject,
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  return `${signingInput}.${base64url(signer.sign(privateKey))}`;
}

const real = makeKeypair('apple-key-1');
const keys = async () => [real.jwk];

function token(overrides: { header?: object; payload?: object; key?: KeyObject } = {}) {
  return sign(
    overrides.key ?? real.privateKey,
    { alg: 'RS256', kid: 'apple-key-1', ...overrides.header },
    {
      iss: 'https://appleid.apple.com',
      aud: AUDIENCE,
      sub: '001234.abcdef.5678',
      exp: Math.floor(NOW / 1000) + 600,
      email: 'someone@privaterelay.appleid.com',
      email_verified: 'true',
      ...overrides.payload,
    }
  );
}

test('accepts a genuine token and returns the stable subject', async () => {
  const identity = await verifyAppleIdentityToken(token(), AUDIENCE, keys, NOW);
  assert.equal(identity.subject, '001234.abcdef.5678');
  assert.equal(identity.emailVerified, true);
});

/*
 * The classic one. A verifier that reads the algorithm out of the token it is
 * verifying will accept "none" and then anybody can mint a token for anybody.
 */
test('refuses a token that asks not to be verified', async () => {
  const unsigned = `${base64url(JSON.stringify({ alg: 'none', kid: 'apple-key-1' }))}.${base64url(
    JSON.stringify({ iss: 'https://appleid.apple.com', aud: AUDIENCE, sub: 'x', exp: 9e9 })
  )}.`;
  await assert.rejects(
    () => verifyAppleIdentityToken(unsigned, AUDIENCE, keys, NOW),
    InvalidIdentityToken
  );
});

test('refuses a token signed by somebody else', async () => {
  const impostor = makeKeypair('apple-key-1');
  await assert.rejects(
    () => verifyAppleIdentityToken(token({ key: impostor.privateKey }), AUDIENCE, keys, NOW),
    /signature does not match/
  );
});

test('refuses a token whose body was edited after signing', async () => {
  const [header, , signature] = token().split('.');
  const tampered = { iss: 'https://appleid.apple.com', aud: AUDIENCE, sub: 'somebody-else', exp: 9e9 };
  const forged = `${header}.${base64url(JSON.stringify(tampered))}.${signature}`;
  await assert.rejects(
    () => verifyAppleIdentityToken(forged, AUDIENCE, keys, NOW),
    /signature does not match/
  );
});

test('refuses a token issued by anyone but Apple', async () => {
  await assert.rejects(
    () =>
      verifyAppleIdentityToken(
        token({ payload: { iss: 'https://not-apple.example' } }),
        AUDIENCE,
        keys,
        NOW
      ),
    /did not come from Apple/
  );
});

/* A valid Apple token for a different app is still nothing to do with us. */
test('refuses a token minted for another app', async () => {
  await assert.rejects(
    () => verifyAppleIdentityToken(token({ payload: { aud: 'com.someone.else' } }), AUDIENCE, keys, NOW),
    /issued for a different app/
  );
});

test('accepts the audience when Apple sends it as a list', async () => {
  const identity = await verifyAppleIdentityToken(
    token({ payload: { aud: ['com.someone.else', AUDIENCE] } }),
    AUDIENCE,
    keys,
    NOW
  );
  assert.equal(identity.subject, '001234.abcdef.5678');
});

test('refuses an expired token', async () => {
  await assert.rejects(
    () =>
      verifyAppleIdentityToken(
        token({ payload: { exp: Math.floor(NOW / 1000) - 1 } }),
        AUDIENCE,
        keys,
        NOW
      ),
    /expired/
  );
});

test('refuses a token signed with a key Apple does not publish', async () => {
  await assert.rejects(
    () => verifyAppleIdentityToken(token({ header: { kid: 'unknown' } }), AUDIENCE, keys, NOW),
    /does not publish/
  );
});

test('refuses rubbish rather than throwing something unhelpful', async () => {
  for (const rubbish of ['', 'not.a.token', 'a.b', null, undefined, 42, {}]) {
    await assert.rejects(
      () => verifyAppleIdentityToken(rubbish, AUDIENCE, keys, NOW),
      InvalidIdentityToken
    );
  }
});

test('the account key cannot collide with an install id or escape a path', () => {
  const key = accountKeyFor({ subject: '../../etc/passwd', emailVerified: false });
  assert.equal(key, 'apple_etcpasswd');
  assert.ok(key.startsWith('apple_'));
});

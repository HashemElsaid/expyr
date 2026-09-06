import { createPublicKey, verify as verifySignature } from 'node:crypto';

/**
 * Who somebody is, according to Apple.
 *
 * Credits are money, and money needs an owner that outlives a phone. An
 * install id does not: Apple keeps no record of spent consumables, the
 * keychain trick that would survive a delete is undocumented behaviour Apple
 * itself says not to lean on, and none of it survives a device wipe. Sign in
 * with Apple gives a stable subject that follows the person to a new phone.
 *
 * Written against node:crypto rather than a JWT library on purpose. This is
 * the one place in the service where getting it wrong hands somebody else's
 * balance to a stranger, and a dependency here is a dependency that has to be
 * trusted with exactly that.
 */

/** Apple's issuer, which every genuine token carries. */
const ISSUER = 'https://appleid.apple.com';

/** Where the signing keys live. */
export const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

/**
 * The only algorithm Apple signs with, and the only one accepted.
 *
 * Pinned rather than read from the token's own header. A verifier that trusts
 * the header to say how to verify accepts "alg": "none", and then anybody can
 * mint a token for anybody.
 */
const ALGORITHM = 'RS256';

export type AppleKey = { kid: string; kty: string; alg?: string; n: string; e: string };

export class InvalidIdentityToken extends Error {
  constructor(why: string) {
    super(`That sign-in could not be verified: ${why}`);
    this.name = 'InvalidIdentityToken';
  }
}

function fromBase64Url(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseJson(part: string, what: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fromBase64Url(part).toString('utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new InvalidIdentityToken(`the ${what} could not be read`);
  }
}

export type AppleIdentity = {
  /** Stable for this person and this app, forever. The account key. */
  subject: string;
  email?: string;
  /** Whether Apple says the email is real rather than a relay it made up. */
  emailVerified: boolean;
};

/**
 * Verifies a token and returns who it is for.
 *
 * `fetchKeys` is injected so the checks can be tested against a key we
 * control. Nothing about the verification changes: the tests sign real tokens
 * with a real key and this function has no idea it is not talking to Apple.
 */
export async function verifyAppleIdentityToken(
  token: unknown,
  audience: string,
  fetchKeys: () => Promise<AppleKey[]>,
  now = Date.now()
): Promise<AppleIdentity> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new InvalidIdentityToken('there was no token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new InvalidIdentityToken('it is not a signed token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = parseJson(encodedHeader, 'header');
  if (header.alg !== ALGORITHM) {
    // Covers "none" and every other downgrade, because the answer is pinned.
    throw new InvalidIdentityToken('it is not signed the way Apple signs');
  }
  if (typeof header.kid !== 'string') throw new InvalidIdentityToken('it names no key');

  const keys = await fetchKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new InvalidIdentityToken('it was signed with a key Apple does not publish');

  const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' });
  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
  const signature = fromBase64Url(encodedSignature);
  if (!verifySignature('RSA-SHA256', signed, publicKey, signature)) {
    throw new InvalidIdentityToken('the signature does not match');
  }

  const payload = parseJson(encodedPayload, 'body');

  if (payload.iss !== ISSUER) throw new InvalidIdentityToken('it did not come from Apple');

  /*
   * Apple sends `aud` as a string, and the spec allows an array. Both are
   * checked for the exact bundle identifier: a token minted for a different
   * app is a valid Apple token and still nothing to do with us.
   */
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) {
    throw new InvalidIdentityToken('it was issued for a different app');
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) {
    throw new InvalidIdentityToken('it has expired');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new InvalidIdentityToken('it names nobody');
  }

  return {
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    // Apple sends this as a string sometimes and a boolean others.
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}

/**
 * Apple's keys, kept for an hour.
 *
 * They rotate rarely and the endpoint is not ours to hammer, but a cache that
 * never refreshes breaks every sign-in the day a key changes. So: an hour, and
 * an immediate refresh whenever a token names a key we have not seen, which is
 * exactly what a rotation looks like from here.
 */
const KEY_CACHE_MS = 60 * 60 * 1000;
let cached: { keys: AppleKey[]; at: number } | null = null;

export async function appleKeys(now = Date.now()): Promise<AppleKey[]> {
  if (cached && now - cached.at < KEY_CACHE_MS) return cached.keys;

  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    // Serving a stale key beats refusing every sign-in while Apple is unwell.
    if (cached) return cached.keys;
    throw new InvalidIdentityToken('Apple could not be reached to check it');
  }

  const body = (await response.json()) as { keys?: AppleKey[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    if (cached) return cached.keys;
    throw new InvalidIdentityToken('Apple published no keys');
  }

  cached = { keys: body.keys, at: now };
  return body.keys;
}

/** For tests, and for a service that has been running long enough to go stale. */
export function forgetAppleKeys(): void {
  cached = null;
}

/** The ledger key for a signed-in person. Prefixed so it cannot collide with an install. */
export function accountKeyFor(identity: AppleIdentity): string {
  return `apple_${identity.subject.replace(/[^A-Za-z0-9_-]/g, '')}`;
}

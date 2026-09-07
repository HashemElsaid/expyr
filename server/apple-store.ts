import { createPrivateKey, sign as signWith } from 'node:crypto';

/**
 * Asking Apple whether a purchase actually happened.
 *
 * The phone says "I bought credits.large, transaction 2000000123". That claim
 * is worth nothing on its own, so this asks the App Store Server API about
 * that transaction id and believes only what comes back.
 *
 * Deliberately not verifying the signature on Apple's reply. The reply arrives
 * over TLS from Apple's own host, in answer to a request signed with a private
 * key only we hold, so the transport and the authentication already establish
 * who is speaking. Checking the JWS chain as well would mean maintaining Apple
 * root certificates in order to re-derive a fact TLS has already settled. What
 * is checked is the content: that the transaction is for this app, for a
 * product we sell, and has not been refunded.
 *
 * The alternative was a third party sitting between Expyr and its revenue.
 * This way Apple is the only authority and there is nothing else to trust.
 */

/** Apple's hosts. Sandbox purchases exist only in the sandbox one. */
const HOSTS = {
  production: 'https://api.storekit.itunes.apple.com',
  sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
} as const;

/** Apple rejects anything longer lived than an hour. Ours is far shorter. */
const TOKEN_LIFETIME_SECONDS = 15 * 60;

export class PurchaseNotVerified extends Error {
  constructor(why: string) {
    super(`That purchase could not be verified: ${why}`);
    this.name = 'PurchaseNotVerified';
  }
}

export type AppleCredentials = {
  /** From App Store Connect, Users and Access, Integrations. */
  keyId: string;
  issuerId: string;
  /** The contents of the .p8, PEM and all. Never logged, never in the repo. */
  privateKeyPem: string;
  bundleId: string;
};

/**
 * The transaction as Apple describes it, which is the only description that
 * counts. Only the fields anything here actually reads.
 */
export type AppleTransaction = {
  transactionId: string;
  originalTransactionId?: string;
  productId: string;
  bundleId: string;
  /** Set when the purchase was refunded or revoked. Present means do not grant. */
  revocationDate?: number;
  environment?: string;
  quantity?: number;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * The bearer token Apple wants, signed with the in-app purchase key.
 *
 * ES256, and the one detail that silently breaks this: JWT wants the signature
 * as raw r‖s, and node's EC signing produces DER unless told otherwise. A DER
 * signature here is not an error, it is a 401 from Apple with no explanation.
 */
export function signToken(credentials: AppleCredentials, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: 'ES256', kid: credentials.keyId, typ: 'JWT' };
  const payload = {
    iss: credentials.issuerId,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    aud: 'appstoreconnect-v1',
    bid: credentials.bundleId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = signWith(
    'sha256',
    Buffer.from(signingInput, 'utf8'),
    {
      key: createPrivateKey({ key: credentials.privateKeyPem, format: 'pem' }),
      dsaEncoding: 'ieee-p1363',
    }
  );

  return `${signingInput}.${base64url(signature)}`;
}

/** Reads the body of one of Apple's signed payloads. */
export function decodeSignedPayload(jws: unknown): Record<string, unknown> {
  if (typeof jws !== 'string') throw new PurchaseNotVerified('Apple sent nothing to read');
  const parts = jws.split('.');
  if (parts.length !== 3) throw new PurchaseNotVerified('Apple sent something unreadable');
  try {
    const parsed = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new PurchaseNotVerified('Apple sent something unreadable');
  }
}

/**
 * Asks Apple about one transaction.
 *
 * `fetcher` is injected so every check below can be tested against replies we
 * control, exactly as the identity verifier does. Nothing about the checks
 * changes when it is the real Apple.
 */
export async function fetchTransaction(
  credentials: AppleCredentials,
  transactionId: string,
  sandbox: boolean,
  fetcher: typeof fetch = fetch,
  now = Date.now()
): Promise<AppleTransaction> {
  if (!/^[0-9]{1,32}$/.test(transactionId)) {
    // Apple's ids are digits. Anything else is not worth a request.
    throw new PurchaseNotVerified('that is not a transaction identifier');
  }

  const host = sandbox ? HOSTS.sandbox : HOSTS.production;
  const response = await fetcher(`${host}/inApps/v1/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${signToken(credentials, now)}` },
  });

  if (response.status === 404) throw new PurchaseNotVerified('Apple has no record of it');
  if (response.status === 401) throw new PurchaseNotVerified('Apple refused our key');
  if (!response.ok) throw new PurchaseNotVerified('Apple could not be reached');

  const body = (await response.json()) as { signedTransactionInfo?: unknown };
  const claims = decodeSignedPayload(body.signedTransactionInfo);

  const transaction: AppleTransaction = {
    transactionId: String(claims.transactionId ?? ''),
    originalTransactionId:
      typeof claims.originalTransactionId === 'string' ? claims.originalTransactionId : undefined,
    productId: String(claims.productId ?? ''),
    bundleId: String(claims.bundleId ?? ''),
    revocationDate: typeof claims.revocationDate === 'number' ? claims.revocationDate : undefined,
    environment: typeof claims.environment === 'string' ? claims.environment : undefined,
    quantity: typeof claims.quantity === 'number' ? claims.quantity : undefined,
  };

  /*
   * A genuine Apple transaction for somebody else's app is still nothing to do
   * with us, and would otherwise be a way to buy credits with a purchase made
   * anywhere on the store.
   */
  if (transaction.bundleId !== credentials.bundleId) {
    throw new PurchaseNotVerified('it belongs to a different app');
  }

  /* Refunded. Apple has given the money back, so the credits are not theirs. */
  if (transaction.revocationDate !== undefined) {
    throw new PurchaseNotVerified('it was refunded');
  }

  /*
   * Apple was asked about one transaction and described another. Should never
   * happen, and if it does the answer is not the one that was asked for.
   */
  if (transaction.transactionId !== transactionId) {
    throw new PurchaseNotVerified('Apple described a different transaction');
  }

  return transaction;
}

/**
 * The credentials, from the environment, or null when they are not set.
 *
 * Null rather than a throw at import: the service does plenty that has nothing
 * to do with selling, and refusing to start because it cannot take payments
 * would take scanning and reading down with it. The route refuses instead.
 */
export function appleCredentials(env = process.env): AppleCredentials | null {
  const keyId = env.EXPYR_APPLE_KEY_ID;
  const issuerId = env.EXPYR_APPLE_ISSUER_ID;
  const privateKeyPem = env.EXPYR_APPLE_KEY;
  const bundleId = env.EXPYR_BUNDLE_ID ?? 'com.expyr.app';
  if (!keyId || !issuerId || !privateKeyPem) return null;
  return { keyId, issuerId, privateKeyPem: privateKeyPem.replace(/\\n/g, '\n'), bundleId };
}

/**
 * Whether the configured key can actually sign anything.
 *
 * Presence is not the same as usability. A .p8 pasted into a dashboard field
 * that eats newlines is still a string, still passes every check above, and
 * fails at the one moment that matters: the first real purchase, as a 401 from
 * Apple with no explanation.
 *
 * So this signs a throwaway token at boot and reports whether it worked. It is
 * the difference between finding out now and finding out from somebody whose
 * money has already left their account.
 */
export function appleKeyUsable(credentials: AppleCredentials | null): boolean {
  if (!credentials) return false;
  try {
    return signToken(credentials).split('.').length === 3;
  } catch {
    return false;
  }
}

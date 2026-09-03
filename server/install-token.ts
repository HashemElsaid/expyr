import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * A credential per install, so a stolen one costs its thief one phone's worth
 * of quota rather than the whole service.
 *
 * The app token that ships inside the bundle can be pulled out by anyone who
 * cares to. It stays, but it now buys only one thing: the right to ask for an
 * install token, which is rate limited hard. Everything else is done with the
 * install token, and every limit is counted against the install it belongs to.
 *
 * Tokens are signed rather than stored. This service has no database and is
 * meant to keep nothing, so instead of remembering which tokens it issued it
 * signs `<id>.<issued>` with a secret only it knows and checks that signature
 * on the way back in. Nothing about the phone or its owner is inside the
 * token: the id is sixteen random bytes and means nothing anywhere else.
 */

const SECRET = process.env.EXPYR_INSTALL_SECRET ?? '';

/**
 * Tokens age out, which is the only revocation a stateless service has. The
 * app renews silently long before this, so a person never sees it happen.
 */
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export const canIssueTokens = SECRET.length >= 16;

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function issueInstallToken(now = Date.now()): string {
  const payload = `${randomBytes(16).toString('base64url')}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export type Install = { id: string; issuedAt: number };

/** Returns the install a token belongs to, or null if it is not one of ours. */
export function verifyInstallToken(token: unknown, now = Date.now()): Install | null {
  if (!canIssueTokens || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, issued, signature] = parts;

  const expected = Buffer.from(sign(`${id}.${issued}`));
  const actual = Buffer.from(signature);
  // Compared this way so the time taken cannot be used to guess the signature.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || now - issuedAt > MAX_AGE_MS || issuedAt > now + 60_000) {
    return null;
  }

  return { id, issuedAt };
}

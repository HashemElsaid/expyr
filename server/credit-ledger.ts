import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Whose credits are whose, and how many are left.
 *
 * The phone keeps a copy so it can show a balance without asking, but a
 * balance held only on the phone is not a balance — it is a number in a file
 * the owner of the phone can edit. This is the one that counts.
 *
 * It also has to outlive the install. Apple does not keep a record of spent
 * consumables, and the keychain trick that would survive a delete is an
 * undocumented implementation detail Apple's own support says not to rely on,
 * and it does not survive a device wipe. So somebody who paid and then
 * restored their phone has only whatever this service remembers.
 */

export type Account = {
  /** Whatever identity the caller was able to prove. */
  id: string;
  balance: number;
  /** Milliseconds. Used only to expire accounts that never bought anything. */
  seenAt: number;
  /**
   * Set on an install once its balance has been moved to a signed-in account.
   * Its only job is to stop the move happening twice.
   */
  linkedTo?: string;
};

export interface CreditStore {
  /**
   * Whether a balance written here will still be here tomorrow.
   *
   * The single most important thing this interface says. Selling credits into
   * a store that forgets them is taking money for nothing, so the routes that
   * sell refuse to when this is false — see `sellable`.
   */
  readonly durable: boolean;
  read(id: string): Promise<Account | null>;
  write(account: Account): Promise<void>;
}

/**
 * For development and tests. Explicitly not durable: a deploy, a restart or
 * Render spinning the container down takes every balance with it.
 */
export class MemoryCreditStore implements CreditStore {
  readonly durable = false;
  private readonly accounts = new Map<string, Account>();

  async read(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async write(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }
}

/**
 * One file per account, on a disk that survives a deploy.
 *
 * A file each rather than one ledger file: two requests for different people
 * arriving together cannot then interleave into the same write, and a corrupt
 * file costs one balance instead of all of them.
 *
 * Written to a temporary name and renamed into place, because a process that
 * dies mid-write should leave the previous balance rather than half of a new
 * one. Rename is atomic on the same filesystem.
 */
export class FileCreditStore implements CreditStore {
  readonly durable = true;
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  /** Ids are hex from an HMAC, but this is money — never trust the shape. */
  private pathFor(id: string): string {
    const safe = id.replace(/[^A-Za-z0-9_-]/g, '');
    if (safe.length === 0 || safe.length > 128) throw new Error('Unusable account id.');
    return join(this.dir, `${safe}.json`);
  }

  async read(id: string): Promise<Account | null> {
    const path = this.pathFor(id);
    if (!existsSync(path)) return null;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Account;
      if (typeof parsed?.balance !== 'number' || !Number.isFinite(parsed.balance)) return null;
      return {
        id,
        balance: Math.max(0, Math.floor(parsed.balance)),
        seenAt: parsed.seenAt ?? 0,
        // Carried through, or the guard against linking twice never sees it.
        ...(typeof parsed.linkedTo === 'string' ? { linkedTo: parsed.linkedTo } : {}),
      };
    } catch {
      /*
       * Unreadable. Returning null would silently zero somebody's balance and
       * then let the next write make that permanent, so it refuses instead and
       * the failure is visible.
       */
      throw new Error('That balance could not be read.');
    }
  }

  async write(account: Account): Promise<void> {
    const path = this.pathFor(account.id);
    const temporary = `${path}.${process.pid}.tmp`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, JSON.stringify(account), 'utf8');
    renameSync(temporary, path);
  }
}

/** Whether this service is in a state where it may take money for credits. */
export function sellable(store: CreditStore): boolean {
  return store.durable;
}

export class InsufficientCredits extends Error {
  readonly balance: number;
  readonly needed: number;
  constructor(balance: number, needed: number) {
    super('Not enough credits.');
    this.name = 'InsufficientCredits';
    this.balance = balance;
    this.needed = needed;
  }
}

export async function balanceOf(store: CreditStore, id: string, now = Date.now()): Promise<number> {
  const account = await store.read(id);
  if (account) return account.balance;
  // Never seen before. Nothing is written until something is actually granted.
  void now;
  return 0;
}

/**
 * Adds credits, after something upstream has established that they were paid
 * for. This function does not check that — validating a receipt is the
 * caller's job, and conflating the two is how a granting endpoint becomes a
 * free credit endpoint.
 */
export async function grant(
  store: CreditStore,
  id: string,
  credits: number,
  now = Date.now()
): Promise<number> {
  if (!store.durable) throw new Error('Refusing to sell credits into a store that forgets them.');
  const amount = Math.max(0, Math.floor(credits));
  const existing = await store.read(id);
  const balance = (existing?.balance ?? 0) + amount;
  await store.write({ id, balance, seenAt: now });
  return balance;
}

/**
 * Takes credits for work about to be done, and refuses rather than going
 * negative. Debiting before the work rather than after is deliberate: a
 * failure that has already cost us the model call should not also be free.
 */
export async function debit(
  store: CreditStore,
  id: string,
  credits: number,
  now = Date.now()
): Promise<number> {
  const amount = Math.max(0, Math.floor(credits));
  const existing = await store.read(id);
  const balance = existing?.balance ?? 0;
  if (balance < amount) throw new InsufficientCredits(balance, amount);
  const next = balance - amount;
  await store.write({ id, balance: next, seenAt: now });
  return next;
}

/** Gives back credits taken for work that then did not happen. */
export async function refund(
  store: CreditStore,
  id: string,
  credits: number,
  now = Date.now()
): Promise<number> {
  const amount = Math.max(0, Math.floor(credits));
  const existing = await store.read(id);
  const balance = (existing?.balance ?? 0) + amount;
  await store.write({ id, balance, seenAt: now });
  return balance;
}

/**
 * Moves an install's balance to the person who just signed in.
 *
 * Somebody buys credits before signing in, then signs in. Those credits are
 * theirs and have to follow them, or signing in to protect a balance would be
 * the thing that lost it.
 *
 * Done twice it must not pay twice, so the install records where it went and a
 * second attempt does nothing. That covers the ordinary case, which is the
 * phone retrying a request it did not hear the answer to.
 *
 * The target is credited before the install is emptied. Two writes cannot be
 * one here, so there is a window, and this is the direction to fall in: a
 * crash inside it credits somebody twice rather than taking credits they paid
 * for. A store with transactions would close it, and this one does not have
 * them, so the choice is which way to be wrong.
 */
export async function link(
  store: CreditStore,
  installId: string,
  accountId: string,
  now = Date.now()
): Promise<number> {
  if (installId === accountId) return balanceOf(store, accountId, now);

  const install = await store.read(installId);
  const target = await store.read(accountId);
  const alreadyThere = target?.balance ?? 0;

  if (!install || install.linkedTo || install.balance <= 0) {
    // Nothing to move, or it has moved already.
    if (!target) await store.write({ id: accountId, balance: alreadyThere, seenAt: now });
    return alreadyThere;
  }

  const moved = alreadyThere + install.balance;
  await store.write({ id: accountId, balance: moved, seenAt: now });
  await store.write({ id: installId, balance: 0, seenAt: now, linkedTo: accountId });
  return moved;
}

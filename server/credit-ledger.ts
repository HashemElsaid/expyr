import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

import { WELCOME_CREDITS } from './pricing.ts';
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
  /**
   * Set on an install whenever somebody signs in on it: whose balance this
   * phone is spending now.
   *
   * Deliberately not the same field as `linkedTo`, although the first version
   * tried to be. They are two different facts and they come apart in two
   * ordinary cases. A phone with no credits that signs in has nothing to move,
   * so `linkedTo` is never set, and a phone stamped only by the move would go
   * on spending as itself for ever. And somebody signing in on a phone already
   * linked to another account should spend as the account they just proved,
   * while the old move must still never repeat.
   */
  signedInAs?: string;
  /**
   * Apple transaction identifiers already credited to this account.
   *
   * iOS hands back every unfinished transaction on each app launch, which is
   * how a purchase survives a crash between paying and being credited. So the
   * same purchase arrives here repeatedly in the ordinary course of working,
   * and without this each arrival would be paid again.
   *
   * Bounded, because a file that only grows is a file that eventually breaks
   * something. Five hundred is far beyond any real buyer, and a transaction
   * old enough to fall off the end was finished with Apple long ago and will
   * never be offered again.
   */
  redeemed?: string[];
  /**
   * Whether this account has had its opening balance.
   *
   * Its own field rather than inferred from the balance, because a balance of
   * zero is exactly what somebody who has spent all of theirs looks like, and
   * guessing would hand them another thirty pages every time they ran out.
   */
  welcomed?: boolean;
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
  /**
   * Erases a record entirely. Guideline 5.1.1(v) requires an app that supports
   * accounts to let somebody delete theirs from inside the app, and a delete
   * that leaves the balance behind under the same key is not a delete.
   */
  remove(id: string): Promise<void>;
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

  async remove(id: string): Promise<void> {
    this.accounts.delete(id);
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
        // And this one, or a phone forgets who it signed in as at every deploy.
        ...(typeof parsed.signedInAs === 'string' ? { signedInAs: parsed.signedInAs } : {}),
        // And this, or every purchase becomes redeemable again after a deploy.
        ...(Array.isArray(parsed.redeemed)
          ? { redeemed: parsed.redeemed.filter((t): t is string => typeof t === 'string') }
          : {}),
        // And this, or the free thirty pages arrive again at every deploy.
        ...(parsed.welcomed === true ? { welcomed: true } : {}),
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

  async remove(id: string): Promise<void> {
    const path = this.pathFor(id);
    // Already gone is the outcome asked for, so it is not a failure.
    if (existsSync(path)) rmSync(path);
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
  await store.write({ ...existing, id, balance, seenAt: now });
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
  await store.write({ ...existing, id, balance: next, seenAt: now });
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
  await store.write({ ...existing, id, balance, seenAt: now });
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
    // Nothing to move, or it has moved already. The phone is still signed in.
    if (!target) await store.write({ id: accountId, balance: alreadyThere, seenAt: now });
    await store.write({
      id: installId,
      balance: install?.balance ?? 0,
      seenAt: now,
      linkedTo: install?.linkedTo,
      signedInAs: accountId,
    });
    return alreadyThere;
  }

  const moved = alreadyThere + install.balance;
  await store.write({ id: accountId, balance: moved, seenAt: now });
  await store.write({
    id: installId,
    balance: 0,
    seenAt: now,
    linkedTo: accountId,
    signedInAs: accountId,
  });
  return moved;
}

/**
 * Whose balance this install is spending.
 *
 * A phone that signed in once must never be made to show Apple's sheet again
 * just to read its own balance. Apple's identity token expires in minutes and
 * the only way to get a fresh one is to put the sheet in front of somebody, so
 * a service that wanted one on every request would be a service that
 * interrupted every request.
 *
 * It does not need one. Signing in stamps the install durably, and the install
 * token is already sent on every call, so it resolves the account on its own.
 * The sheet is needed exactly twice in a person's life: to claim an account,
 * and to reclaim it on a new phone.
 *
 * An install that has never signed in spends as itself, which is what every
 * install did before any of this existed.
 */
export async function accountFor(store: CreditStore, installId: string): Promise<string> {
  const install = await store.read(installId);
  return install?.signedInAs ?? installId;
}

/** How many transaction identifiers an account remembers. */
const MAX_REDEEMED = 500;

/**
 * Credits a verified purchase, once.
 *
 * Everything about whether the purchase is real happens before this: Apple is
 * asked, the bundle is checked, a refund is refused. This is only the last
 * step, and its whole job is that asking twice pays once.
 *
 * The transaction is recorded in the same write as the balance, so there is no
 * moment where the credits exist and the record of having granted them does
 * not. A store with transactions would guarantee that; this one gets it by
 * writing a single object.
 */
export async function redeem(
  store: CreditStore,
  accountId: string,
  transactionId: string,
  credits: number,
  now = Date.now()
): Promise<{ balance: number; granted: boolean }> {
  if (!store.durable) throw new Error('Refusing to sell credits into a store that forgets them.');

  const existing = await store.read(accountId);
  const already = existing?.redeemed ?? [];

  if (already.includes(transactionId)) {
    return { balance: existing?.balance ?? 0, granted: false };
  }

  const amount = Math.max(0, Math.floor(credits));
  const balance = (existing?.balance ?? 0) + amount;

  await store.write({
    ...existing,
    id: accountId,
    balance,
    seenAt: now,
    redeemed: [transactionId, ...already].slice(0, MAX_REDEEMED),
  });

  return { balance, granted: true };
}

/** Whether this account has already been paid for a given transaction. */
export async function alreadyRedeemed(
  store: CreditStore,
  accountId: string,
  transactionId: string
): Promise<boolean> {
  const account = await store.read(accountId);
  return (account?.redeemed ?? []).includes(transactionId);
}

/**
 * Erases an account and cuts every phone loose from it.
 *
 * Guideline 5.1.1(v) requires this to exist inside the app the moment accounts
 * do, and it has to be a real deletion rather than a flag: the balance goes,
 * the record of which purchases were redeemed goes, and the file goes.
 *
 * Unspent credits are forfeited, and the screen that calls this says so before
 * anybody taps it. There is no honest alternative. Apple handles refunds, not
 * us, and a balance kept "just in case" after somebody asked to be deleted is
 * exactly the data they asked us not to have.
 *
 * The installs pointing at it are unlinked in the same pass. Without that, the
 * phone keeps resolving to a key that no longer exists and reads as a balance
 * of zero it can never explain.
 */
export async function forget(
  store: CreditStore,
  accountId: string,
  installIds: readonly string[] = [],
  now = Date.now()
): Promise<void> {
  for (const installId of installIds) {
    const install = await store.read(installId);
    if (!install || install.signedInAs !== accountId) continue;
    /*
     * linkedTo is deliberately left alone. It is the guard that stops an
     * install's balance being moved twice, and clearing it would let the same
     * credits be claimed again by signing in to a second account.
     */
    await store.write({ ...install, seenAt: now, signedInAs: undefined });
  }

  await store.remove(accountId);
}

/**
 * Takes credits for work about to be done, opening the account on the way past.
 *
 * The welcome credits are granted here rather than claimed by the phone. The
 * phone has always shown a new install thirty free pages, and for as long as
 * that was the only place the number lived it was thirty free pages *per
 * reinstall* for anybody who noticed. Granting on first sight moves it to the
 * service, where an install is something we issued rather than something they
 * can mint.
 *
 * Debited before the work rather than after, which is the same choice `debit`
 * makes and for the same reason: a model call that has already cost us money
 * should not also be free. `refund` covers the case where it produced nothing.
 */
export async function spend(
  store: CreditStore,
  accountId: string,
  credits: number,
  now = Date.now()
): Promise<number> {
  const amount = Math.max(0, Math.floor(credits));
  const existing = await store.read(accountId);
  const opening = (existing?.balance ?? 0) + (existing?.welcomed ? 0 : WELCOME_CREDITS);

  if (opening < amount) throw new InsufficientCredits(opening, amount);

  await store.write({
    ...existing,
    id: accountId,
    balance: opening - amount,
    seenAt: now,
    welcomed: true,
  });

  return opening - amount;
}

/**
 * What this account can spend, counting an opening balance it has not claimed.
 *
 * Unlike `balanceOf`, which reports what is written down. The difference is a
 * brand new install, which has nothing written down and three hundred credits
 * to spend.
 */
export async function availableTo(store: CreditStore, accountId: string): Promise<number> {
  const account = await store.read(accountId);
  if (!account) return WELCOME_CREDITS;
  return account.welcomed ? account.balance : account.balance + WELCOME_CREDITS;
}

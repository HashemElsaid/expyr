import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { WELCOME_CREDITS } from './pricing.ts';

import {
  FileCreditStore,
  InsufficientCredits,
  MemoryCreditStore,
  accountFor,
  alreadyRedeemed,
  availableTo,
  balanceOf,
  debit,
  forget,
  grant,
  link,
  redeem,
  refund,
  sellable,
  spend,
} from './credit-ledger.ts';

function temporaryDir(): string {
  return mkdtempSync(join(tmpdir(), 'expyr-credits-'));
}

test('an account nobody has paid for has nothing', async () => {
  const store = new MemoryCreditStore();
  assert.equal(await balanceOf(store, 'someone'), 0);
});

test('spending refuses rather than going negative', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 100);
    await assert.rejects(() => debit(store, 'a', 101), InsufficientCredits);
    // And the refusal did not quietly take anything.
    assert.equal(await balanceOf(store, 'a'), 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('spending exactly the balance is allowed', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 100);
    assert.equal(await debit(store, 'a', 100), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * The whole point of the file store. A balance that does not survive a restart
 * is not a balance, and this is the assertion that says so.
 */
test('a balance survives the process that wrote it', async () => {
  const dir = temporaryDir();
  try {
    await grant(new FileCreditStore(dir), 'a', 3000);
    // A completely separate store object, as a restarted service would build.
    assert.equal(await balanceOf(new FileCreditStore(dir), 'a'), 3000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one person cannot see or spend another person’s credits', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 500);
    assert.equal(await balanceOf(store, 'b'), 0);
    await assert.rejects(() => debit(store, 'b', 1), InsufficientCredits);
    assert.equal(await balanceOf(store, 'a'), 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a refund gives back exactly what was taken', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 300);
    await debit(store, 'a', 140);
    await refund(store, 'a', 140);
    assert.equal(await balanceOf(store, 'a'), 300);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * Selling into a store that forgets is taking money for nothing. The refusal
 * lives at the lowest level so no route can forget to make it.
 */
test('refuses to sell credits into a store that forgets them', async () => {
  const store = new MemoryCreditStore();
  assert.equal(sellable(store), false);
  await assert.rejects(() => grant(store, 'a', 100), /forgets/);
});

test('a durable store is the only one that may sell', () => {
  const dir = temporaryDir();
  try {
    assert.equal(sellable(new FileCreditStore(dir)), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * A file that will not parse must not read as a zero balance. Zero would be
 * written back on the next debit and the loss would become permanent, so it
 * fails loudly instead.
 */
test('an unreadable balance raises rather than reading as zero', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 900);
    writeFileSync(join(dir, 'a.json'), '{ this is not json', 'utf8');
    await assert.rejects(() => balanceOf(store, 'a'), /could not be read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an id that would escape the directory is refused', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    // Everything unsafe is stripped, so this cannot resolve outside dir.
    await grant(store, '../../etc/passwd', 10);
    assert.equal(await balanceOf(store, '../../etc/passwd'), 10);
    await assert.rejects(() => store.read('///'), /Unusable account id/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fractional and negative amounts cannot conjure credits', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'a', 100.9);
    assert.equal(await balanceOf(store, 'a'), 100);
    await grant(store, 'a', -50);
    assert.equal(await balanceOf(store, 'a'), 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signing in moves the credits bought before signing in', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'install-1', 3000);
    assert.equal(await link(store, 'install-1', 'apple_abc'), 3000);
    assert.equal(await balanceOf(store, 'apple_abc'), 3000);
    assert.equal(await balanceOf(store, 'install-1'), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * The phone retrying a request it did not hear the answer to. Paying twice for
 * that would be the app inventing money.
 */
test('linking twice does not pay twice', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'install-1', 3000);
    await link(store, 'install-1', 'apple_abc');
    await link(store, 'install-1', 'apple_abc');
    await link(store, 'install-1', 'apple_abc');
    assert.equal(await balanceOf(store, 'apple_abc'), 3000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('linking adds to a balance the account already had', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'apple_abc', 500);
    await grant(store, 'install-2', 1500);
    assert.equal(await link(store, 'install-2', 'apple_abc'), 2000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an install with nothing on it links harmlessly', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    assert.equal(await link(store, 'install-3', 'apple_abc'), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one person signing in cannot drain another person’s install', async () => {
  const dir = temporaryDir();
  try {
    const store = new FileCreditStore(dir);
    await grant(store, 'install-1', 3000);
    await link(store, 'install-1', 'apple_thief');
    // Already spent on the thief, so the rightful owner gets nothing more.
    // The real defence is that only this phone can present its own install
    // token; this asserts the ledger does not hand it out a second time.
    assert.equal(await link(store, 'install-1', 'apple_owner'), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * Signing in is one of the two things that need a durable store: a balance
 * moved into a store that forgets it is a balance taken. So these run against
 * the real file store, which is also the only one the service will ever sell
 * into.
 */
function onDisk<T>(run: (store: FileCreditStore, dir: string) => Promise<T>): Promise<T> {
  const dir = temporaryDir();
  return run(new FileCreditStore(dir), dir).finally(() =>
    rmSync(dir, { recursive: true, force: true })
  );
}

test('a phone that has never signed in spends as itself', async () => {
  await onDisk(async (store) => {
    assert.equal(await accountFor(store, 'install-1'), 'install-1');

    await grant(store, 'install-1', 100);
    assert.equal(await accountFor(store, 'install-1'), 'install-1');
  });
});

/*
 * The bug this pair of fields exists for. A phone with nothing on it has
 * nothing to move, so link() takes its early return — and the first version,
 * which stamped the install only as a side effect of moving a balance, left
 * that phone spending as itself for ever afterwards.
 */
test('signing in with no credits still says whose account this is', async () => {
  await onDisk(async (store) => {
    await link(store, 'install-1', 'apple_abc');
    assert.equal(await accountFor(store, 'install-1'), 'apple_abc');
  });
});

test('signing in with credits moves them and says whose account this is', async () => {
  await onDisk(async (store) => {
    await grant(store, 'install-1', 300);

    assert.equal(await link(store, 'install-1', 'apple_abc'), 300);
    assert.equal(await accountFor(store, 'install-1'), 'apple_abc');
    assert.equal(await balanceOf(store, 'install-1'), 0);
    assert.equal(await balanceOf(store, 'apple_abc'), 300);
  });
});

/*
 * Somebody signs in as themselves, then hands the phone to a relative who
 * signs in as themselves. The phone must now spend the relative's credits, and
 * the first person's balance must not be moved a second time.
 */
test('a second person signing in takes over the phone without moving money again', async () => {
  await onDisk(async (store) => {
    await grant(store, 'install-1', 300);
    await link(store, 'install-1', 'apple_abc');

    await link(store, 'install-1', 'apple_xyz');

    assert.equal(await accountFor(store, 'install-1'), 'apple_xyz');
    assert.equal(await balanceOf(store, 'apple_abc'), 300, 'the first balance stays put');
    assert.equal(await balanceOf(store, 'apple_xyz'), 0, 'nothing is invented for the second');
  });
});

test('signing in twice does not pay twice', async () => {
  await onDisk(async (store) => {
    await grant(store, 'install-1', 300);

    assert.equal(await link(store, 'install-1', 'apple_abc'), 300);
    assert.equal(await link(store, 'install-1', 'apple_abc'), 300);
    assert.equal(await balanceOf(store, 'apple_abc'), 300);
  });
});

/*
 * linkedTo had this exact bug once: carried in memory, dropped by the disk
 * read, so it worked in every test and failed on the only machine that
 * matters. A phone that forgot who it signed in as would spend from an empty
 * balance after any deploy.
 */
test('who a phone signed in as survives the process that wrote it', async () => {
  const dir = temporaryDir();
  try {
    await link(new FileCreditStore(dir), 'install-1', 'apple_abc');
    assert.equal(await accountFor(new FileCreditStore(dir), 'install-1'), 'apple_abc');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * iOS hands back every unfinished transaction on each app launch, which is how
 * a purchase survives a crash between paying and being credited. The same
 * purchase therefore arrives here again and again in the ordinary course of
 * working, and paying it each time would be the most expensive bug in the app.
 */
test('a purchase pays once however many times it is redeemed', async () => {
  await onDisk(async (store) => {
    const first = await redeem(store, 'apple_abc', 'txn_1', 3000);
    assert.deepEqual(first, { balance: 3000, granted: true });

    const again = await redeem(store, 'apple_abc', 'txn_1', 3000);
    assert.deepEqual(again, { balance: 3000, granted: false });

    assert.equal(await balanceOf(store, 'apple_abc'), 3000);
  });
});

test('a genuinely different purchase is still paid', async () => {
  await onDisk(async (store) => {
    await redeem(store, 'apple_abc', 'txn_1', 1500);
    await redeem(store, 'apple_abc', 'txn_2', 1500);
    assert.equal(await balanceOf(store, 'apple_abc'), 3000);
  });
});

test('says whether a transaction has been paid already', async () => {
  await onDisk(async (store) => {
    assert.equal(await alreadyRedeemed(store, 'apple_abc', 'txn_1'), false);
    await redeem(store, 'apple_abc', 'txn_1', 1500);
    assert.equal(await alreadyRedeemed(store, 'apple_abc', 'txn_1'), true);
    assert.equal(await alreadyRedeemed(store, 'apple_abc', 'txn_2'), false);
  });
});

/*
 * The record and the balance are written as one object, so there is no moment
 * where the credits exist and the note saying they were granted does not.
 */
test('what has been redeemed survives the process that wrote it', async () => {
  const dir = temporaryDir();
  try {
    await redeem(new FileCreditStore(dir), 'apple_abc', 'txn_1', 3000);

    const later = new FileCreditStore(dir);
    assert.equal(await alreadyRedeemed(later, 'apple_abc', 'txn_1'), true);
    assert.deepEqual(await redeem(later, 'apple_abc', 'txn_1', 3000), {
      balance: 3000,
      granted: false,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * grant, debit and refund each rebuilt the record from scratch, so any field
 * they did not name was dropped. Latent while accounts held nothing else;
 * fatal the moment they remember what has been paid, because the next purchase
 * would erase the record of the previous one and make it redeemable again.
 */
test('spending does not forget what has already been paid for', async () => {
  await onDisk(async (store) => {
    await redeem(store, 'apple_abc', 'txn_1', 3000);
    await debit(store, 'apple_abc', 100);
    await refund(store, 'apple_abc', 50);
    await grant(store, 'apple_abc', 10);

    assert.equal(await alreadyRedeemed(store, 'apple_abc', 'txn_1'), true);
    assert.deepEqual(await redeem(store, 'apple_abc', 'txn_1', 3000), {
      balance: 2960,
      granted: false,
    });
  });
});

test('signing in is not forgotten by a later purchase either', async () => {
  await onDisk(async (store) => {
    await link(store, 'install-1', 'apple_abc');
    await grant(store, 'install-1', 10);
    assert.equal(await accountFor(store, 'install-1'), 'apple_abc');
  });
});

test('refuses to redeem into a store that forgets', async () => {
  await assert.rejects(
    () => redeem(new MemoryCreditStore(), 'apple_abc', 'txn_1', 3000),
    /forgets/
  );
});

/*
 * Guideline 5.1.1(v) requires an app that supports accounts to let somebody
 * delete theirs from inside it, and a delete that leaves the balance behind
 * under the same key is not a delete.
 */
test('deleting an account erases the balance and the record of it', async () => {
  await onDisk(async (store) => {
    await redeem(store, 'apple_abc', 'txn_1', 3000);
    assert.equal(await balanceOf(store, 'apple_abc'), 3000);

    await forget(store, 'apple_abc');

    assert.equal(await balanceOf(store, 'apple_abc'), 0);
    assert.equal(await store.read('apple_abc'), null, 'the record itself is gone');
  });
});

test('deleting an account nobody has is not a failure', async () => {
  await onDisk(async (store) => {
    await forget(store, 'apple_nobody');
    assert.equal(await balanceOf(store, 'apple_nobody'), 0);
  });
});

/*
 * Without this the phone keeps resolving to a key that no longer exists, and
 * reads as a balance of zero it can never explain.
 */
test('deleting an account cuts the phone loose from it', async () => {
  await onDisk(async (store) => {
    await link(store, 'install-1', 'apple_abc');
    assert.equal(await accountFor(store, 'install-1'), 'apple_abc');

    await forget(store, 'apple_abc', ['install-1']);

    assert.equal(await accountFor(store, 'install-1'), 'install-1', 'spends as itself again');
  });
});

/*
 * linkedTo is the guard against moving one install's credits twice. Clearing
 * it on deletion would let the same purchase be claimed again by signing in to
 * a second account, which is a way to mint credits out of nothing.
 */
test('deleting does not reopen the way to claim the same credits twice', async () => {
  await onDisk(async (store) => {
    await grant(store, 'install-1', 3000);
    await link(store, 'install-1', 'apple_abc');
    assert.equal(await balanceOf(store, 'apple_abc'), 3000);

    await forget(store, 'apple_abc', ['install-1']);

    // Signing in as somebody else must not hand them the same 3,000 again.
    assert.equal(await link(store, 'install-1', 'apple_xyz'), 0);
    assert.equal(await balanceOf(store, 'apple_xyz'), 0);
  });
});

test('deleting one account leaves everybody else alone', async () => {
  await onDisk(async (store) => {
    await redeem(store, 'apple_abc', 'txn_1', 1500);
    await redeem(store, 'apple_xyz', 'txn_2', 3000);

    await forget(store, 'apple_abc');

    assert.equal(await balanceOf(store, 'apple_abc'), 0);
    assert.equal(await balanceOf(store, 'apple_xyz'), 3000);
  });
});

/*
 * The welcome credits used to be claimed by the phone, which meant thirty free
 * pages per reinstall for anybody who noticed. Granted here they are given
 * once, against an install the service issued.
 */
test('a new account is opened with the welcome credits, once', async () => {
  await onDisk(async (store) => {
    assert.equal(await availableTo(store, 'install-1'), WELCOME_CREDITS);

    assert.equal(await spend(store, 'install-1', 100), WELCOME_CREDITS - 100);
    assert.equal(await spend(store, 'install-1', 100), WELCOME_CREDITS - 200);
    assert.equal(await availableTo(store, 'install-1'), WELCOME_CREDITS - 200);
  });
});

/*
 * Spending to zero is what somebody who used their free pages looks like, and
 * inferring "new" from a zero balance would hand them another thirty every
 * time they ran out. Hence a field rather than a guess.
 */
test('spending everything does not earn another welcome', async () => {
  await onDisk(async (store) => {
    await spend(store, 'install-1', WELCOME_CREDITS);
    assert.equal(await availableTo(store, 'install-1'), 0);
    await assert.rejects(() => spend(store, 'install-1', 10), InsufficientCredits);
  });
});

test('refuses rather than going negative, and takes nothing when it refuses', async () => {
  await onDisk(async (store) => {
    await assert.rejects(() => spend(store, 'install-1', WELCOME_CREDITS + 1), InsufficientCredits);
    assert.equal(await availableTo(store, 'install-1'), WELCOME_CREDITS, 'nothing was taken');
  });
});

test('credits bought are spendable on top of the welcome ones', async () => {
  await onDisk(async (store) => {
    await redeem(store, 'apple_abc', 'txn_1', 1500);
    assert.equal(await availableTo(store, 'apple_abc'), 1500 + WELCOME_CREDITS);
    assert.equal(await spend(store, 'apple_abc', 500), 1500 + WELCOME_CREDITS - 500);
  });
});

/* The refund path, for a model call that took the money and produced nothing. */
test('a refund puts back exactly what the charge took', async () => {
  await onDisk(async (store) => {
    const after = await spend(store, 'install-1', 40);
    assert.equal(await refund(store, 'install-1', 40), after + 40);
    assert.equal(await availableTo(store, 'install-1'), WELCOME_CREDITS);
  });
});

/*
 * Having been welcomed has to survive a deploy, or the free thirty pages
 * arrive again every time the service restarts. Same class of bug as linkedTo
 * and signedInAs, which both worked in memory and vanished on disk.
 */
test('having been welcomed survives the process that wrote it', async () => {
  const dir = temporaryDir();
  try {
    await spend(new FileCreditStore(dir), 'install-1', WELCOME_CREDITS);

    const later = new FileCreditStore(dir);
    assert.equal(await availableTo(later, 'install-1'), 0);
    await assert.rejects(() => spend(later, 'install-1', 10), InsufficientCredits);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one install spending does not touch another', async () => {
  await onDisk(async (store) => {
    await spend(store, 'install-1', 200);
    assert.equal(await availableTo(store, 'install-2'), WELCOME_CREDITS);
  });
});

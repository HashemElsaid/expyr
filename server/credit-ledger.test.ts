import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  balanceOf,
  debit,
  FileCreditStore,
  grant,
  InsufficientCredits,
  MemoryCreditStore,
  refund,
  sellable,
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

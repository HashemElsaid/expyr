import assert from 'node:assert/strict';
import { test } from 'node:test';

import { creditsFor, grantFor, PRODUCTS, PRO_CREDITS } from './products.ts';

test('every product on sale is worth exactly what it says', () => {
  assert.deepEqual(grantFor('pro.lifetime'), { kind: 'pro', credits: PRO_CREDITS });
  assert.deepEqual(grantFor('credits.small'), { kind: 'credits', credits: 1500 });
  assert.deepEqual(grantFor('credits.medium'), { kind: 'credits', credits: 3000 });
  assert.deepEqual(grantFor('credits.large'), { kind: 'credits', credits: 6500 });
});

/*
 * An identifier this service has never heard of is not a crisis, it is an
 * older service meeting a newer app. Refusing leaves the purchase unfinished
 * with Apple, so it can be redeemed again after a deploy. Inventing a default
 * would either hand out credits nobody paid for or swallow a real purchase.
 */
test('an unknown product grants nothing rather than guessing', () => {
  assert.equal(grantFor('credits.enormous'), null);
  assert.equal(grantFor(''), null);
  assert.equal(creditsFor('credits.enormous'), 0);
});

/*
 * Pro used to grant nothing but the lifted ceilings, so the one feature that
 * costs money per use was metered identically for somebody who had paid for
 * everything and somebody who had paid nothing.
 */
test('the one off purchase comes with credits', () => {
  assert.equal(creditsFor('pro.lifetime'), PRO_CREDITS);
  assert.equal(PRO_CREDITS, 500);
});

/*
 * The bundle is granted once per Apple transaction, and Family Sharing puts up
 * to six people on one purchase. So the worst case is six grants, and the
 * figure has to stay small enough that six of them are affordable against a
 * purchase clearing about twenty-eight dollars.
 */
test('six of the bundle still cost a fraction of the purchase', () => {
  const dollars = (PRO_CREDITS * 6) / 1000;
  assert.ok(dollars < 5, `six bundles cost $${dollars}, which is no longer a rounding error`);
});

/*
 * Apple has to be told which products can be bought again. Getting this wrong
 * on a credit pack means somebody buys it once and the store refuses ever
 * after, which looks exactly like the app being broken.
 */
test('the credit packs are consumable and the one off purchase is not', () => {
  for (const product of PRODUCTS) {
    assert.equal(
      product.kind,
      product.grant.kind === 'credits' ? 'consumable' : 'nonConsumable',
      `${product.id} is registered as the wrong kind`
    );
  }
});

test('no identifier appears twice', () => {
  const ids = PRODUCTS.map((product) => product.id);
  assert.equal(new Set(ids).size, ids.length);
});

/*
 * The identifiers are permanent: Apple does not allow one to be renamed,
 * reused or deleted once created. Changing a string here means abandoning a
 * product in App Store Connect and losing every purchase made against it, so
 * this is written down rather than left to be remembered.
 */
test('the identifiers are the ones registered with Apple', () => {
  assert.deepEqual(
    PRODUCTS.map((product) => product.id),
    ['pro.lifetime', 'credits.small', 'credits.medium', 'credits.large']
  );
});

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  FileGuidanceStore,
  LayeredGuidanceStore,
  MAX_AGE_MS,
  MemoryGuidanceStore,
  isFresh,
} from './guidance-cache.ts';
import { guidanceKey, GuidanceRequest, parse } from './schemas.ts';

/**
 * The cache is what makes generated guidance affordable — a live web search per
 * jurisdiction rather than per person — so the properties that matter are about
 * spend: is it served from cache, is it produced once when several ask at once,
 * and does a failure fall back rather than costing another search.
 */

describe('freshness', () => {
  it('serves an entry inside its life', () => {
    assert.equal(isFresh({ value: 1, at: Date.now() }), true);
  });

  it('retires one past it', () => {
    assert.equal(isFresh({ value: 1, at: Date.now() - MAX_AGE_MS - 1000 }), false);
  });

  it('treats a missing entry as not fresh rather than throwing', () => {
    assert.equal(isFresh(null), false);
  });

  it('keeps guidance for a quarter, not a week', () => {
    const days = MAX_AGE_MS / 86_400_000;
    assert.ok(days >= 30 && days <= 180, `unexpected life: ${days} days`);
  });
});

describe('the memory store', () => {
  it('reads back what it wrote', async () => {
    const store = new MemoryGuidanceStore<string>();
    await store.set('a', 'one');
    assert.equal((await store.get('a'))?.value, 'one');
  });

  it('answers for a key it has never seen', async () => {
    assert.equal(await new MemoryGuidanceStore<string>().get('nope'), null);
  });

  it('stays bounded on a long-running process', async () => {
    const store = new MemoryGuidanceStore<number>();
    for (let i = 0; i < 800; i += 1) await store.set(`k${i}`, i);
    // The oldest are gone; the most recent are still there.
    assert.equal(await store.get('k0'), null);
    assert.equal((await store.get('k799'))?.value, 799);
  });
});

describe('the file store', () => {
  let directory: string;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'expyr-guidance-'));
  });
  after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('survives being read by a different instance', async () => {
    await new FileGuidanceStore<string>(directory).set('visa.ae.dubai', 'steps');
    // A second store over the same directory is what a restart looks like.
    const reopened = new FileGuidanceStore<string>(directory);
    assert.equal((await reopened.get('visa.ae.dubai'))?.value, 'steps');
  });

  it('treats an unreadable entry as a miss rather than an error', async () => {
    const store = new FileGuidanceStore<string>(directory);
    assert.equal(await store.get('never-written'), null);
  });

  it('treats an unusable directory as a miss rather than an error', async () => {
    // A path that cannot be a directory, because a file already sits there.
    const store = new FileGuidanceStore<string>(join(directory, 'visa.ae.dubai.json', 'deeper'));
    await store.set('x', 'y');
    assert.equal(await store.get('x'), null);
  });

  it('reports how much it is holding', async () => {
    assert.ok((await new FileGuidanceStore<string>(directory).size()) >= 1);
  });
});

describe('the layered store', () => {
  it('produces on a miss and serves from cache after', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    let produced = 0;

    const first = await store.fetch('k', async () => {
      produced += 1;
      return 'answer';
    });
    const second = await store.fetch('k', async () => {
      produced += 1;
      return 'answer';
    });

    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(produced, 1, 'the second ask must not cost a second search');
  });

  /*
   * The property that matters most on a cold start. Guidance takes most of a
   * minute, so without single-flighting, the first ten phones to ask about
   * Dubai visas each begin their own web search and each pay for it.
   */
  it('runs one generation however many ask at once', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    let produced = 0;

    const produce = async () => {
      produced += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return 'answer';
    };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.fetch('same', produce))
    );

    assert.equal(produced, 1);
    for (const result of results) assert.equal(result.value, 'answer');
  });

  it('keeps different jurisdictions apart', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await store.fetch('visa.ae.dubai', async () => 'dubai');
    const other = await store.fetch('visa.ae.sharjah', async () => 'sharjah');

    assert.equal(other.value, 'sharjah');
    assert.equal(other.cached, false);
  });

  it('lets a failure reach the caller when there is nothing to fall back on', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await assert.rejects(() =>
      store.fetch('k', async () => {
        throw new Error('search is down');
      })
    );
  });

  /*
   * A stale answer beats no answer: renewal steps do not change in the hour a
   * search happens to be failing, and somebody standing in a service centre
   * would rather have last quarter's fee than an error.
   */
  it('falls back to a stale answer rather than failing', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await store.fetch('k', async () => 'old answer');

    // Age it past its life by writing directly through the store's own surface.
    const aged = await store.get('k');
    assert.ok(aged);
    (aged as { at: number }).at = Date.now() - MAX_AGE_MS - 1000;

    const result = await store.fetch('k', async () => {
      throw new Error('search is down');
    });
    assert.equal(result.value, 'old answer');
    assert.equal(result.cached, true);
  });

  /*
   * The bug polling introduced. A phone asks every few seconds until an answer
   * appears, so a key that fails reliably would start a fresh web search on
   * every ask — one unanswerable question spending the whole day's budget.
   */
  it('does not start a fresh search on every ask for something that keeps failing', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    let attempts = 0;
    const failing = async () => {
      attempts += 1;
      throw new Error('nothing findable');
    };

    await assert.rejects(() => store.fetch('hopeless', failing));
    for (let i = 0; i < 10; i += 1) {
      await assert.rejects(() => store.fetch('hopeless', failing));
    }

    assert.equal(attempts, 1, 'it must not research again while cooling off');
  });

  it('says so plainly rather than pretending to still be working', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await assert.rejects(() => store.fetch('hopeless', async () => { throw new Error('x'); }));
    assert.equal(store.failedRecently('hopeless'), true);
    assert.equal(store.failedRecently('a-different-place'), false);
  });

  it('still serves a stale answer for a key that has started failing', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await store.fetch('k', async () => 'old answer');

    const aged = await store.get('k');
    (aged as { at: number }).at = Date.now() - MAX_AGE_MS - 1000;

    let attempts = 0;
    const failing = async (): Promise<string> => {
      attempts += 1;
      throw new Error('down');
    };

    // A stale answer beats an error, so this resolves rather than rejecting —
    // and the failure is still recorded underneath.
    assert.equal((await store.fetch('k', failing)).value, 'old answer');
    assert.equal(store.failedRecently('k'), true);

    // Cooling off now, and there is something to show, so it is shown without
    // paying for another search.
    assert.equal((await store.fetch('k', failing)).value, 'old answer');
    assert.equal(attempts, 1);
  });

  it('forgets the failure once it has cooled off', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await assert.rejects(() => store.fetch('k', async () => { throw new Error('x'); }));
    // Eleven minutes on, it is allowed to try again.
    assert.equal(store.failedRecently('k', Date.now() + 11 * 60 * 1000), false);
  });

  /*
   * Deliberately not "recovers on the very next attempt". An immediate retry is
   * what the polling app does by itself, several times a minute, and honouring
   * it is the loop this cooldown exists to break. The cost of that choice is
   * that a genuinely transient failure waits — which is why the message the app
   * shows says it could not find out, rather than inviting an instant retry.
   */
  it('recovers once the cooldown has passed, not before', async () => {
    const store = new LayeredGuidanceStore<string>(null);
    await assert.rejects(() => store.fetch('k', async () => { throw new Error('down'); }));

    // Straight away: refused without producing anything.
    let produced = 0;
    await assert.rejects(() =>
      store.fetch('k', async () => {
        produced += 1;
        return 'now it works';
      })
    );
    assert.equal(produced, 0);

    // Eleven minutes on, it is willing again.
    assert.equal(store.failedRecently('k', Date.now() + 11 * 60 * 1000), false);
    const result = await store.fetch('k', async () => 'now it works');
    assert.equal(result.value, 'now it works');
  });
});

describe('recognising an authority', () => {
  /*
   * Ireland publishes passport renewal on ireland.ie, and the first version of
   * this called the Department of Foreign Affairs a blog. There is no global
   * registry of "this domain is a government", so the rule understates on
   * purpose — a missing mark costs a glance, a wrong one costs the reason to
   * check at all.
   */
  const official = [
    'https://www.dmv.ca.gov/portal/',
    'https://www.gov.uk/renew-passport',
    'https://icp.gov.ae/en/services/',
    'https://www.ireland.ie/en/dfa/passports/',
    'https://www.service-public.gouv.fr/',
    'https://u.ae/en/information-and-services',
    'https://europa.eu/youreurope/',
  ];

  const notOfficial = [
    'https://ie.iasservices.org.uk/irish-passport',
    'https://blog.example.com/how-to-renew',
    'https://www.expatica.com/ae/visas/',
    'https://govtjobs-blog.com/passports',
  ];

  it('marks the authorities', async () => {
    const { fetchBrandIcon: _ } = await import('./brand-icon.ts');
    const { looksOfficialForTests } = await import('./guidance.ts');
    for (const url of official) {
      assert.equal(looksOfficialForTests(url), true, url);
    }
  });

  it('does not mark the commentary', async () => {
    const { looksOfficialForTests } = await import('./guidance.ts');
    for (const url of notOfficial) {
      assert.equal(looksOfficialForTests(url), false, url);
    }
  });

  it('does not throw on something that is not a URL', async () => {
    const { looksOfficialForTests } = await import('./guidance.ts');
    assert.equal(looksOfficialForTests('not a url'), false);
  });
});

describe('the cache key', () => {
  const read = (body: unknown) => parse(GuidanceRequest, JSON.stringify(body));

  const base = {
    typeId: 'residence-visa',
    label: 'Residence Visa',
    country: 'AE',
    countryName: 'United Arab Emirates',
  };

  it('is the jurisdiction and nothing about the person', () => {
    assert.equal(guidanceKey(read({ ...base, region: 'Dubai' })), 'residence-visa.ae.dubai');
  });

  it('is the same however the caller cased or spaced it', () => {
    const one = guidanceKey(read({ ...base, region: 'Dubai' }));
    const two = guidanceKey(read({ ...base, country: 'ae', region: '  dubai  ' }));
    assert.equal(one, two);
  });

  it('separates two emirates, which genuinely differ', () => {
    assert.notEqual(
      guidanceKey(read({ ...base, region: 'Dubai' })),
      guidanceKey(read({ ...base, region: 'Sharjah' }))
    );
  });

  it('works with no region at all', () => {
    assert.equal(guidanceKey(read(base)), 'residence-visa.ae');
  });

  /*
   * Each uncached combination costs a live web search, so the set of things
   * that can be asked about has to be finite. A free-text region would let one
   * leaked app token mint an unbounded number of them.
   */
  it('refuses a country that is not a country code', () => {
    assert.throws(() => read({ ...base, country: 'not-a-country' }));
    assert.throws(() => read({ ...base, country: '' }));
  });

  it('refuses a region long enough to be a cache-busting string', () => {
    assert.throws(() => read({ ...base, region: 'x'.repeat(200) }));
  });

  it('refuses a typeId that is not the app’s own slug shape', () => {
    assert.throws(() => read({ ...base, typeId: '../../etc/passwd' }));
    assert.throws(() => read({ ...base, typeId: 'a'.repeat(200) }));
  });

  it('produces a key safe to use as a filename', () => {
    const key = guidanceKey(read({ ...base, region: "Ras al-Khaimah" }));
    assert.match(key, /^[a-z0-9.-]+$/);
    assert.ok(!key.includes('..'));
  });
});

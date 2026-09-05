import { beforeEach, describe, expect, it } from 'vitest';

import {
  LocalDocumentRepository,
  type KeyValueStore,
} from '@/data/document-repository';
import { makeDocument } from '@/test/factories';

/**
 * The repository is the seam a syncing store would slot into, so what is
 * tested here is mostly the behaviour that only matters once there are two
 * devices: tombstones, per-record writes, and an outbox that survives them.
 */

class FakeStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  /** Set to make the next write throw, the way a full phone would. */
  failWrites = false;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('no space left on device');
    this.values.set(key, value);
  }
}

let store: FakeStore;
let repo: LocalDocumentRepository;

beforeEach(() => {
  store = new FakeStore();
  repo = new LocalDocumentRepository(store);
});

describe('reading and writing', () => {
  it('starts empty rather than throwing', async () => {
    expect(await repo.load()).toEqual([]);
  });

  it('reads back what it wrote', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    expect(await repo.load()).toEqual([doc]);
  });

  it('replaces a record rather than adding a second copy', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    await repo.upsert({ ...doc, title: 'Renewed passport' });

    const loaded = await repo.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('Renewed passport');
  });

  it('leaves the other records untouched when one changes', async () => {
    const a = makeDocument('passport');
    const b = makeDocument('emirates-id');
    await repo.upsert(a);
    await repo.upsert(b);
    await repo.upsert({ ...a, title: 'Changed' });

    const loaded = await repo.load();
    expect(loaded.find((d) => d.id === b.id)).toEqual(b);
  });

  it('lets a write failure reach the caller instead of swallowing it', async () => {
    store.failWrites = true;
    await expect(repo.upsert(makeDocument('passport'))).rejects.toThrow();
  });

  it('adopts documents saved under the old app name', async () => {
    const doc = makeDocument('passport');
    store.values.set('renewly.documents.v1', JSON.stringify([doc]));
    expect(await repo.load()).toEqual([doc]);
  });

  it('drops a corrupt record without losing the rest', async () => {
    const good = makeDocument('passport');
    store.values.set('expyr.documents.v1', JSON.stringify([good, { nonsense: true }, null]));
    expect(await repo.load()).toEqual([good]);
  });

  it('survives storage that is not JSON at all', async () => {
    store.values.set('expyr.documents.v1', 'not json');
    await expect(repo.load()).rejects.toThrow();
  });
});

describe('tombstones', () => {
  it('hides a deleted record from load', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    await repo.remove(doc.id);

    expect(await repo.load()).toEqual([]);
  });

  /*
   * The reason deletes leave a mark. A record that merely vanished is
   * indistinguishable from one the other device has not seen yet, and guessing
   * wrong resurrects a passport somebody deliberately removed.
   */
  it('keeps the mark so another device can be told', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    await repo.remove(doc.id);

    const onDisk = JSON.parse(store.values.get('expyr.documents.v1') ?? '[]');
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].deletedAt).toEqual(expect.any(String));
  });

  it('forgets a tombstone once it is old enough to be useless', async () => {
    const doc = makeDocument('passport');
    const longAgo = new Date(Date.now() - 200 * 86_400_000).toISOString();
    store.values.set('expyr.documents.v1', JSON.stringify([{ ...doc, deletedAt: longAgo }]));

    expect(await repo.load()).toEqual([]);
    // And it is gone from disk on the next write, rather than kept forever.
    await repo.upsert(makeDocument('emirates-id'));
    expect(JSON.parse(store.values.get('expyr.documents.v1') ?? '[]')).toHaveLength(1);
  });

  it('lets a restore bring back something that was deleted', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    await repo.remove(doc.id);
    await repo.upsert(doc);

    expect(await repo.load()).toEqual([doc]);
  });

  it('does nothing when asked to delete something that is not there', async () => {
    await expect(repo.remove('never-existed')).resolves.toBeUndefined();
    expect(await repo.pending()).toEqual([]);
  });
});

describe('replaceAll', () => {
  it('makes the new set the whole truth', async () => {
    await repo.upsert(makeDocument('passport'));
    const restored = [makeDocument('emirates-id')];

    await repo.replaceAll(restored);
    expect(await repo.load()).toEqual(restored);
  });

  it('leaves a tombstone for everything the new set dropped', async () => {
    const gone = makeDocument('passport');
    await repo.upsert(gone);
    await repo.replaceAll([]);

    const changes = await repo.pending();
    expect(changes).toContainEqual(
      expect.objectContaining({ documentId: gone.id, kind: 'delete' })
    );
  });
});

describe('the outbox', () => {
  it('records every change, so a future sync knows what to send', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);

    expect(await repo.pending()).toEqual([
      { documentId: doc.id, kind: 'upsert', at: expect.any(String) },
    ]);
  });

  it('keeps one entry per document, the most recent intention', async () => {
    const doc = makeDocument('passport');
    await repo.upsert(doc);
    await repo.upsert({ ...doc, title: 'Again' });
    await repo.remove(doc.id);

    const pending = await repo.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('delete');
  });

  it('forgets what has been acknowledged, and only that', async () => {
    const a = makeDocument('passport');
    const b = makeDocument('emirates-id');
    await repo.upsert(a);
    await repo.upsert(b);

    await repo.acknowledge([a.id]);
    expect((await repo.pending()).map((c) => c.documentId)).toEqual([b.id]);
  });

  it('does not fail a document write because the outbox could not be written', async () => {
    const doc = makeDocument('passport');
    // A repository whose store refuses only the second write of each pair: the
    // document lands, the note about it does not.
    let writes = 0;
    const flaky: KeyValueStore = {
      getItem: (k) => store.getItem(k),
      setItem: async (k, v) => {
        writes += 1;
        if (k === 'expyr.outbox.v1') throw new Error('nope');
        await store.setItem(k, v);
      },
    };

    await expect(new LocalDocumentRepository(flaky).upsert(doc)).resolves.toBeUndefined();
    expect(writes).toBeGreaterThan(0);
    expect(await repo.load()).toEqual([doc]);
  });

  it('ignores an outbox that has been corrupted', async () => {
    store.values.set('expyr.outbox.v1', '{ not an array }');
    expect(await repo.pending()).toEqual([]);
  });
});

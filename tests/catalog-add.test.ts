import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { addCollection, parseCollectionManifest, type CollectionManifest } from '../scripts/catalog-add';

function manifest(): CollectionManifest {
  const title = { en: 'Quiet Light', ru: 'Тихий свет', 'zh-cn': '静谧之光', 'pt-br': 'Luz tranquila' };
  const collection = { id: '0004-quiet-light', slug: 'quiet-light', count: 2, title, description: title };
  const wallpapers = [1, 2].map((number) => ({
    id: `quiet-light-${number}`, slug: `quiet-light-${number}`, number,
    collection: collection.slug, collectionId: collection.id, s3Folder: collection.id, fileStem: collection.slug,
    category: 'abstract' as const, tags: ['light' as const], title, description: title,
  }));
  return { collection, wallpapers };
}

test('manifest validation preserves CDN identity and rejects incomplete or unsafe catalogue data', () => {
  const valid = manifest();
  expect(parseCollectionManifest(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  for (const change of [
    (item: CollectionManifest) => { item.collection.count = 3; },
    (item: CollectionManifest) => { item.collection.title.ru = ''; },
    (item: CollectionManifest) => { delete (item.collection.description as Partial<typeof item.collection.description>)['zh-cn']; },
    (item: CollectionManifest) => { item.collection.id = '0004/quiet-light'; },
    (item: CollectionManifest) => { item.wallpapers[0]!.s3Folder = '0005-quiet-light'; },
    (item: CollectionManifest) => { item.wallpapers[1]!.number = 1; },
    (item: CollectionManifest) => { item.wallpapers[0]!.number = -1; },
    (item: CollectionManifest) => { Object.assign(item.wallpapers[0]!, { category: 'unknown' }); },
    (item: CollectionManifest) => { Object.assign(item.wallpapers[0]!, { tags: ['unknown'] }); },
    (item: CollectionManifest) => { Object.assign(item.wallpapers[0]!, { extra: 'unexpected' }); },
  ]) {
    const invalid = structuredClone(valid);
    change(invalid);
    expect(() => parseCollectionManifest(invalid)).toThrow();
  }
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('collection import on a local Firestore emulator', () => {
  let app: App;
  let db: Firestore;
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST!)) throw new Error('Tests require a local Firestore emulator.');
    app = initializeApp({ projectId: 'demo-want-wallpapers' }, 'catalogue-import-tests');
    db = getFirestore(app);
  });
  beforeEach(async () => {
    await db.recursiveDelete(db.collection('collections'));
    await db.recursiveDelete(db.collection('wallpapers'));
  });
  afterAll(async () => {
    await db?.terminate();
    if (app) await deleteApp(app);
  });

  test('creates a complete collection, reads it back and preserves existing visitor data', async () => {
    const item = manifest();
    await db.doc('collections/0001-existing').set({ id: '0001-existing', slug: 'existing' });
    await db.doc('wallpapers/existing-1').set({ id: 'existing-1', collectionId: '0001-existing' });
    await db.doc('wallpapers/existing-1/ratings/visitor').set({ value: 'imba' });
    expect(await addCollection(db, item)).toBe('created');
    expect((await db.doc(`collections/${item.collection.id}`).get()).data()).toEqual(item.collection);
    for (const wallpaper of item.wallpapers) expect((await db.doc(`wallpapers/${wallpaper.id}`).get()).data()).toEqual(wallpaper);
    expect((await db.doc('wallpapers/existing-1/ratings/visitor').get()).data()).toEqual({ value: 'imba' });
    expect((await db.doc('wallpapers/existing-1').get()).data()).toEqual({ id: 'existing-1', collectionId: '0001-existing' });
    expect((await db.doc('collections/0001-existing').get()).data()).toEqual({ id: '0001-existing', slug: 'existing' });
  });

  test('an identical retry makes no write and keeps comments', async () => {
    const item = manifest();
    await addCollection(db, item);
    const ref = db.doc(`collections/${item.collection.id}`);
    const before = await ref.get();
    await db.doc('wallpapers/quiet-light-1/comments/visitor').set({ text: 'Beautiful' });
    expect(await addCollection(db, item)).toBe('unchanged');
    expect((await ref.get()).updateTime?.isEqual(before.updateTime!)).toBe(true);
    expect((await db.doc('wallpapers/quiet-light-1/comments/visitor').get()).data()).toEqual({ text: 'Beautiful' });
  });

  test('partial data blocks the import without filling or overwriting documents', async () => {
    const item = manifest();
    await db.doc('wallpapers/quiet-light-1').set(item.wallpapers[0]!);
    await rejects(addCollection(db, item), /Catalogue conflict/);
    expect((await db.doc(`collections/${item.collection.id}`).get()).exists).toBe(false);
    expect((await db.doc('wallpapers/quiet-light-2').get()).exists).toBe(false);
    expect((await db.doc('wallpapers/quiet-light-1').get()).data()).toEqual(item.wallpapers[0]);
  });

  test('changed data and a reused collection number block the import', async () => {
    const item = manifest();
    await addCollection(db, item);
    const changed = structuredClone(item);
    changed.wallpapers[0]!.title.en = 'Different title';
    await rejects(addCollection(db, changed), /Catalogue conflict/);
    expect((await db.doc('wallpapers/quiet-light-1').get()).data()).toEqual(item.wallpapers[0]);
    await db.recursiveDelete(db.collection('collections'));
    await db.recursiveDelete(db.collection('wallpapers'));
    await db.doc('collections/4-another-name').set({ slug: 'another-name' });
    await rejects(addCollection(db, item), /Catalogue conflict/);
    expect((await db.collection('wallpapers').get()).empty).toBe(true);
  });

  test('a concurrent document creation rejects the whole batch', async () => {
    const item = manifest();
    const originalBatch = db.batch.bind(db);
    const hook = spyOn(db, 'batch').mockImplementation(() => {
      const batch = originalBatch();
      const commit = batch.commit.bind(batch);
      batch.commit = async () => {
        await db.doc('wallpapers/quiet-light-2').create({ existing: true });
        return commit();
      };
      return batch;
    });
    try { await rejects(addCollection(db, item)); }
    finally { hook.mockRestore(); }
    expect((await db.doc(`collections/${item.collection.id}`).get()).exists).toBe(false);
    expect((await db.doc('wallpapers/quiet-light-1').get()).exists).toBe(false);
    expect((await db.doc('wallpapers/quiet-light-2').get()).data()).toEqual({ existing: true });
  });
});

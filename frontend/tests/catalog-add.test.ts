import { expect, test } from 'bun:test';
import { parseCollection, parseCollectionManifest, type CollectionManifest } from '../scripts/catalog-add';

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

test('empty collection export still validates identity, translations and count', () => {
  const empty = { ...manifest().collection, count: 0 };
  expect(parseCollection(empty)).toEqual(empty);
  for (const update of [{ id: '0004/quiet-light' }, { count: -1 }, { count: 1001 }, { title: { en: 'Only one language' } }]) {
    expect(() => parseCollection({ ...empty, ...update })).toThrow();
  }
});

test('manifest limits use UTF-16 length and reject NUL text', () => {
  for (const text of ['a'.repeat(201), '😀'.repeat(101), 'bad\0text']) {
    const invalid = manifest(); invalid.wallpapers[0]!.title.ru = text;
    expect(() => parseCollectionManifest(invalid)).toThrow();
  }
});

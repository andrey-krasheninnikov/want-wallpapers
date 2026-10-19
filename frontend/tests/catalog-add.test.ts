import { expect, test } from 'bun:test';
import { parseCollection, parseCollectionManifest, parsePublicationDates, type CollectionManifest } from '../scripts/catalog-add';

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


test('collection video covers survive manifest and snapshot parsing without changing PNG variants', () => {
  const input = manifest();
  const videoCover = { src: 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0004-quiet-light/cover.mp4', poster: 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0004-quiet-light/cover.png' };
  Object.assign(input.collection, { videoCover });
  expect(parseCollectionManifest(input)).toEqual(input);
  expect(parseCollection(input.collection)).toEqual(input.collection);
});

test('collection video covers reject incomplete objects and unsafe CDN URLs', () => {
  const prefix = 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0004-quiet-light/';
  for (const videoCover of [null, {}, { src: prefix + 'cover.mp4' }, { src: prefix + 'cover.mp4', poster: prefix + 'cover.png', extra: true },
    ...['http://want-foundation.s3.twcstorage.ru/cover.mp4', 'https://example.com/cover.mp4', prefix + '../cover.mp4', prefix + '%2e%2e/cover.mp4', prefix + 'cover.mp4?x=1', prefix + 'cover.mp4#x', prefix + 'cover.webm', prefix.replace('0004-', '0005-') + 'cover.mp4', prefix.replace('.ru/', '.ru:443/') + 'cover.mp4'].map((src) => ({ src, poster: prefix + 'cover.png' })),
    { src: prefix + 'cover.mp4', poster: prefix + 'cover.svg' }]) {
    expect(() => parseCollection({ ...manifest().collection, videoCover })).toThrow();
  }
});


test('publication metadata accepts old exports and rejects malformed dates or foreign identities', () => {
  const wallpapers = manifest().wallpapers;
  expect(parsePublicationDates(undefined, wallpapers)).toEqual({});
  const valid = { 'quiet-light-1': '2026-10-13T12:34:56.000001Z' };
  expect(parsePublicationDates(valid, wallpapers)).toEqual(valid);
  for (const value of [null, [], 1, { foreign: valid['quiet-light-1'] }, { 'quiet-light-1': 123 }, { 'quiet-light-1': '2026-02-30T12:34:56Z' }, { 'quiet-light-1': '2026-10-13T12:34:56+03:00' }]) expect(() => parsePublicationDates(value, wallpapers)).toThrow();
});

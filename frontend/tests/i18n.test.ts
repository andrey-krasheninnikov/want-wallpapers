import { expect, test } from 'bun:test';
import { collections, wallpapers, initialCatalog, categoryLabels, tagLabels, locales } from '../src/data/catalog';
import { copy, languageLabels, languageFlags } from '../src/data/copy';
import { designCopy } from '../src/data/design-copy';
import { interfaceCopy } from '../src/data/interface-copy';
import { storyCopy } from '../src/data/story-copy';
import { collectionStories, editorialCopy, supportCopy, supportTopics } from '../src/data/editorial';
import { legalPage } from '../src/data/legal';
import { createSearchIndex, searchIds } from '../src/lib/catalog-search';
import { filterWallpapers } from '../src/lib/search-client';
import { wordCount } from '../scripts/seo-validation';

function complete(source: unknown, translated: unknown) {
  if (typeof source === 'string') { expect(typeof translated).toBe('string'); expect((translated as string).trim()).not.toBe(''); }
  else if (Array.isArray(source)) {
    expect(Array.isArray(translated)).toBe(true); expect((translated as unknown[]).length).toBe(source.length);
    source.forEach((value, index) => complete(value, (translated as unknown[])[index]));
  } else if (source && typeof source === 'object') {
    expect(Object.keys(translated as object).sort()).toEqual(Object.keys(source).sort());
    for (const [key, value] of Object.entries(source)) complete(value, (translated as Record<string, unknown>)[key]);
  } else expect(translated).toBe(source);
}

test('Japanese public dictionaries and all legal sections have complete matching keys', () => {
  for (const dictionary of [copy, designCopy, interfaceCopy, storyCopy, editorialCopy, supportCopy, supportTopics]) complete(dictionary.en, dictionary.ja);
  for (const page of ['privacy', 'terms', 'cookies', 'license', 'contact'] as const) complete(legalPage('en', page), legalPage('ja', page));
  expect(languageLabels.ja).toBe('日本語'); expect(languageFlags.ja).toBe('🇯🇵');
});

test('every catalog record, seed, taxonomy term and complete story has Japanese text', () => {
  expect(locales).toEqual(['en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar']);
  for (const item of [...collections, ...wallpapers, ...initialCatalog.collections, ...initialCatalog.wallpapers]) {
    for (const text of [item.title, item.description]) {
      expect(Object.keys(text).sort()).toEqual([...locales].sort());
      expect(text.ja).toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
    }
  }
  for (const label of [...Object.values(categoryLabels), ...Object.values(tagLabels)]) expect(label.ja.trim()).not.toBe('');
  for (const collection of collections) complete(collectionStories[collection.slug]!.en, collectionStories[collection.slug]!.ja);
});

test('Japanese search finds localized titles, descriptions and taxonomy without spaces', () => {
  const documents = wallpapers.map(item => ({ id: item.id, text: [item.title.ja, item.description.ja, categoryLabels[item.category].ja, ...item.tags.map(tag => tagLabels[tag].ja)].join(' ') }));
  const index = createSearchIndex('ja', documents);
  for (const [phrase, id] of [['紫の地平線', 'contours-of-silence-1'], ['星空', 'contours-of-silence-1'], ['風景', 'contours-of-silence-1'], ['水', 'where-stars-graze-4'], ['キーボード', 'neon-tide-4'], ['波紋', 'where-stars-graze-4']]) expect(searchIds(index, 'ja', phrase!)).toContain(id!);
});

test('Japanese search normalizes width, preserves voiced kana and retains fallback filters', () => {
  const items = [
    { id: 'glass', text: 'ガラス', searchText: 'ガラス', category: 'abstract', collection: 'quiet' },
    { id: 'crow', text: 'カラス', searchText: 'カラス', category: 'nature', collection: 'quiet' },
  ];
  const index = createSearchIndex('ja', items);
  expect([...searchIds(index, 'ja', 'ｶﾞﾗｽ')]).toEqual(['glass']);
  expect(filterWallpapers(items, 'ja', { q: 'ｶﾞﾗｽ', category: '', collection: '' }).map(item => item.id)).toEqual(['glass']);
  expect(filterWallpapers(items, 'ja', { q: 'カラス', category: 'abstract', collection: '' }, index)).toEqual([]);
  expect(filterWallpapers(items, 'ja', { q: '', category: '', collection: '' }, index)).toEqual(items);
});

test('Japanese content metrics segment words without whitespace', () => {
  expect(wordCount('静かな湖に青い光が映っています。', 'ja')).toBeGreaterThan(5);
});


test('Arabic public content, catalog, seeds and stories are complete', () => {
  for (const dictionary of [copy, designCopy, interfaceCopy, storyCopy, editorialCopy, supportCopy, supportTopics]) complete(dictionary.en, dictionary.ar);
  for (const key of ['privacy', 'terms', 'cookies', 'license', 'contact'] as const) complete(legalPage('en', key), legalPage('ar', key));
  expect(languageLabels.ar).toBe('العربية');
  for (const item of [...collections, ...wallpapers, ...initialCatalog.collections, ...initialCatalog.wallpapers]) {
    for (const field of [item.title, item.description]) {
      expect(Object.keys(field).sort()).toEqual([...locales].sort());
      expect(field.ar).toMatch(/\p{Script=Arabic}/u);
    }
  }
  for (const label of [...Object.values(categoryLabels), ...Object.values(tagLabels)]) expect(label.ar).toMatch(/\p{Script=Arabic}/u);
  for (const collection of collections) complete(collectionStories[collection.slug]!.en, collectionStories[collection.slug]!.ar);
});

test('Arabic search covers catalog text and taxonomy with vowel and tatweel normalization', () => {
  const documents = wallpapers.map(item => ({ id: item.id, text: [item.title.ar, item.description.ar, categoryLabels[item.category].ar, ...item.tags.map(tag => tagLabels[tag].ar)].join(' ') }));
  const index = createSearchIndex('ar', documents);
  for (const [phrase, id] of [['أُفُق بَنَفْسَجِيّ', 'contours-of-silence-1'], ['أفــــق', 'contours-of-silence-1'], ['مناظر', 'contours-of-silence-1'], ['لوحة مفاتيح', 'neon-tide-4'], ['تموجات', 'where-stars-graze-4']]) expect(searchIds(index, 'ar', phrase!)).toContain(id!);
  const items = [{ id: 'one', searchText: 'أُفُق بنفسجي', category: 'landscape', collection: 'quiet' }];
  expect(filterWallpapers(items, 'ar', { q: 'افــق', category: '', collection: '' })).toEqual(items);
  expect(filterWallpapers(items, 'ar', { q: 'افق', category: 'abstract', collection: '' }, index)).toEqual([]);
  expect(wordCount('هذه خلفية هادئة فيها ضوء أزرق على الماء.', 'ar')).toBeGreaterThan(5);
});

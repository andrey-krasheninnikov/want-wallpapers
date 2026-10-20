import { expect, test } from 'bun:test';
import { wallpapers, s3Url, previewUrl, downloadUrl, tagLabels } from '../src/data/catalog';
import { createSearchIndex, searchIds } from '../src/lib/catalog-search';
import type { Locale } from '../src/data/catalog';

test('localized catalogue search finds the same design in four languages', () => {
  for (const [locale, phrase] of [
    ['en', 'violet horizon'],
    ['ru', 'фиолетовый горизонт'],
    ['zh-cn', '紫色地平线'],
    ['pt-br', 'horizonte violeta'],
  ] as [Locale, string][]) {
    const index = createSearchIndex(locale, wallpapers.map((wallpaper) => ({
      id: wallpaper.id,
      text: `${wallpaper.title[locale]} ${wallpaper.description[locale]}`,
    })));
    expect(searchIds(index, locale, phrase)).toContain('contours-of-silence-1');
  }
});

test('new collection is searchable by localized descriptions and tags', () => {
  for (const [locale, description, tag] of [
    ['en', 'ripples', 'water'],
    ['ru', 'круги', 'вода'],
    ['zh-cn', '涟漪', '水'],
    ['pt-br', 'ondulações', 'água'],
  ] as [Locale, string, string][]) {
    const index = createSearchIndex(locale, wallpapers.map((wallpaper) => ({
      id: wallpaper.id,
      text: [wallpaper.title[locale], wallpaper.description[locale], ...wallpaper.tags.map((key) => tagLabels[key][locale])].join(' '),
    })));
    for (const phrase of [description, tag]) expect(searchIds(index, locale, phrase)).toContain('where-stars-graze-4');
  }
});

test('ice collection is searchable by localized descriptions and tags', () => {
  for (const [locale, description, tag] of [
    ['en', 'reflection', 'water'],
    ['ru', 'отражение', 'вода'],
    ['zh-cn', '倒影', '水'],
    ['pt-br', 'reflexo', 'água'],
  ] as [Locale, string, string][]) {
    const index = createSearchIndex(locale, wallpapers.map((wallpaper) => ({
      id: wallpaper.id,
      text: [wallpaper.title[locale], wallpaper.description[locale], ...wallpaper.tags.map((key) => tagLabels[key][locale])].join(' '),
    })));
    for (const phrase of [description, tag]) expect(searchIds(index, locale, phrase)).toContain('a-night-beneath-the-ice-1');
  }
});

test('migrated source PNG names preserve local download and preview URLs', () => {
  const wallpaper = wallpapers.find((item) => item.id === 'contours-of-silence-2')!;
  expect(s3Url(wallpaper, 'desktop')).toBe('https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/2-desktop.png');
  expect(s3Url(wallpaper, 'mobile')).toBe('https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/2-mobile.png');
  expect(downloadUrl(wallpaper, 'desktop')).toBe('/downloads/contours-of-silence-2-desktop.png');
  expect(previewUrl(wallpaper, 'mobile')).toBe('/previews/contours-of-silence-2-mobile.webp');
  for (const item of wallpapers) {
    for (const variant of ['desktop', 'mobile'] as const) {
      const url = new URL(s3Url(item, variant));
      expect(url.origin).toBe('https://want-foundation.s3.twcstorage.ru');
      expect(url.pathname).toBe(`/wallpapers/assets/collections/${item.s3Folder}/${item.number}-${variant}.png`);
    }
  }
});


test('publication order handles late additions, ties and missing history without mutating the catalogue', async () => {
  const { newestWallpapers } = await import('../src/lib/catalog-order');
  const old = { ...wallpapers[0]!, id: 'old' };
  const late = { ...old, id: 'late', number: 16 };
  const recent = { ...wallpapers.at(-1)!, id: 'recent' };
  const unknown = { ...recent, id: 'unknown' };
  const items = [old, late, recent, unknown];
  const dates = { old: '2026-10-02T21:44:58Z', late: '2026-10-13T12:00:00Z', recent: '2026-10-05T04:04:04Z' };
  expect(newestWallpapers(items, dates).map(item => item.id)).toEqual(['late', 'recent', 'old', 'unknown']);
  expect(items.map(item => item.id)).toEqual(['old', 'late', 'recent', 'unknown']);
  expect(newestWallpapers([old, late], { old: dates.old, late: dates.old }).map(item => item.id)).toEqual(['late', 'old']);
  expect(newestWallpapers([old, unknown], {}).map(item => item.id)).toEqual(['unknown', 'old']);
});


test('neon collection preserves its ten designs and localized keyboard search', () => {
  const designs = wallpapers.filter((item) => item.collectionId === '0006-neon-tide');
  expect(designs.map((item) => item.number)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
  for (const [locale, description, tag] of [
    ['en', 'keyboard', 'water'],
    ['ru', 'клавиша', 'вода'],
    ['zh-cn', '键帽', '水'],
    ['pt-br', 'tecla', 'água'],
  ] as [Locale, string, string][]) {
    const index = createSearchIndex(locale, designs.map((item) => ({
      id: item.id,
      text: [item.title[locale], item.description[locale], ...item.tags.map((key) => tagLabels[key][locale])].join(' '),
    })));
    for (const phrase of [description, tag]) expect(searchIds(index, locale, phrase)).toContain('neon-tide-4');
  }
});


test('collection chronology uses its first publication and survives snapshot round trips', async () => {
  const { newestCollections } = await import('../src/lib/catalog-order');
  const { collections, collectionPublicationDates } = await import('../src/data/catalog');
  expect(collections[0]!.id).toBe('0006-neon-tide');
  const original = collections.map(item => item.id);
  const snapshot = JSON.parse(JSON.stringify({ collections: [...collections].reverse(), collectionPublicationDates }));
  expect(newestCollections(snapshot.collections, snapshot.collectionPublicationDates).map(item => item.id)).toEqual(original);
  expect(collections.map(item => item.id)).toEqual(original);
});

test('collection order keeps microseconds, deterministic ties and undated entries last', async () => {
  const { newestCollections } = await import('../src/lib/catalog-order');
  const { collections } = await import('../src/data/catalog');
  const items = ['0001-old', '0002-recent', '0003-tie', '0004-unknown', '0005-fraction'].map(id => ({ ...collections[0]!, id }));
  const dates = {
    '0001-old': '2026-10-02T21:44:58Z',
    '0002-recent': '2026-10-19T20:13:10.100001Z',
    '0003-tie': '2026-10-19T20:13:10.100001Z',
    '0005-fraction': '2026-10-19T20:13:10.1Z',
  };
  expect(newestCollections(items, dates).map(item => item.id)).toEqual(['0003-tie', '0002-recent', '0005-fraction', '0001-old', '0004-unknown']);
  expect(newestCollections(items, {}).map(item => item.id)).toEqual(items.map(item => item.id).reverse());
  expect(items.map(item => item.id)).toEqual(['0001-old', '0002-recent', '0003-tie', '0004-unknown', '0005-fraction']);
});

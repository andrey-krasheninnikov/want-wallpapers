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

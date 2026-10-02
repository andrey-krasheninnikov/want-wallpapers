import { expect, test } from 'bun:test';
import { wallpapers } from '../src/data/catalog';
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

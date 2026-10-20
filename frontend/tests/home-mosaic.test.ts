import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HomeMosaic from '../src/components/HomeMosaic';
import { initialMosaic, nextMosaic, type MosaicWallpaper } from '../src/lib/home-mosaic';

const items: MosaicWallpaper[] = Array.from({ length: 18 }, (_, index) => ({
  id: String(index), href: `/ru/wallpapers/work-${index}/`, title: `Work ${index}`, description: `Description ${index}`,
  desktop: { src: `/work-${index}-desktop.webp`, width: 1200, height: 800 },
  mobile: { src: `/work-${index}-mobile.webp`, width: 600, height: 1000 },
}));

for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 18]) test(`mosaic selection handles ${count} works`, () => {
  const pool = items.slice(0, count);
  let current = initialMosaic(pool);
  expect(current).toEqual(initialMosaic(pool));
  expect(current.tiles).toHaveLength(Math.min(count, 6));
  for (const sample of [0, 0.25, 0.75, 0.999999]) {
    const next = nextMosaic(pool, current, () => sample);
    expect(next.layout).not.toBe(current.layout);
    expect(next.tiles).toHaveLength(Math.min(count, 6));
    expect(new Set(next.tiles.map(tile => tile.id)).size).toBe(next.tiles.length);
    if (count > 1) expect(next.tiles.map(tile => tile.id)).not.toEqual(current.tiles.map(tile => tile.id));
    if (count > 6) expect(next.tiles.some(tile => !current.tiles.some(old => old.id === tile.id))).toBe(true);
    for (const tile of next.tiles) {
      expect(tile.href).toStartWith('/ru/wallpapers/');
      expect(tile[tile.variant].src).toEndWith(`-${tile.variant}.webp`);
    }
    current = next;
  }
  expect(pool).toEqual(items.slice(0, count));
});

test('large catalog supplies six different works on the next interval', () => {
  const first = initialMosaic(items);
  const second = nextMosaic(items, first);
  expect(second.tiles.every(tile => !first.tiles.some(old => old.id === tile.id))).toBe(true);
});

for (const count of [0, 1, 3, 6]) test(`server renders a useful ${count}-work mosaic without JavaScript`, () => {
  const html = renderToStaticMarkup(createElement(HomeMosaic, { items: items.slice(0, count), locale: 'ru' }));
  expect((html.match(/data-wallpaper-card=/g) ?? []).length).toBe(count);
  expect((html.match(/<a /g) ?? []).length).toBe(count);
  expect(html).not.toContain('<h2');
  if (count) {
    expect(html).toContain('data-count="' + count + '"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('Description 0');
  } else expect(html).toBe('');
});

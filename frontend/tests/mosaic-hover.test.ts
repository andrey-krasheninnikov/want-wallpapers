import { expect, test } from 'bun:test';
import { hoverMosaic, initialMosaic, type MosaicWallpaper } from '../src/lib/home-mosaic';

const items: MosaicWallpaper[] = Array.from({ length: 16 }, (_, index) => ({
  id: String(index), href: `/wallpapers/work-${index}/`, title: `Work ${index}`, description: `Description ${index}`,
  desktop: { src: `/${index}-desktop.webp`, width: 1200, height: 800 },
  mobile: { src: `/${index}-mobile.webp`, width: 600, height: 1000 },
}));

test('hover preserves its tile and layout while replacing every other work', () => {
  const current = initialMosaic(items);
  const next = hoverMosaic(items, current, '1', () => 0)!;
  expect(next.layout).toBe(current.layout);
  expect(next.tiles[1]).toBe(current.tiles[1]);
  expect(next.tiles.filter((tile, index) => tile.id !== current.tiles[index].id)).toHaveLength(5);
  expect(new Set(next.tiles.map(tile => tile.id)).size).toBe(6);
  for (const [index, tile] of next.tiles.entries()) {
    expect(tile.variant).toBe(current.tiles[index].variant);
    if (index !== 1) expect(current.tiles.some(shown => shown.id === tile.id)).toBe(false);
  }
  expect(current.tiles.map(tile => tile.id)).toEqual(['0', '1', '2', '3', '4', '5']);
});

test('small catalogues change every unpinned slot without duplicate works', () => {
  const pool = items.slice(0, 6), current = initialMosaic(pool);
  for (const id of ['0', '1', '5']) for (const sample of [0, .999]) {
    const next = hoverMosaic(pool, current, id, () => sample)!;
    expect(new Set(next.tiles.map(tile => tile.id)).size).toBe(6);
    for (const [index, tile] of next.tiles.entries()) {
      if (tile.id === id) expect(tile).toBe(current.tiles[index]);
      else expect(tile.id).not.toBe(current.tiles[index].id);
    }
  }
});

test('hover preserves a working frame when other slots cannot change', () => {
  expect(hoverMosaic(items.slice(0, 1), initialMosaic(items.slice(0, 1)), '0')).toBeUndefined();
  expect(hoverMosaic(items.slice(0, 2), initialMosaic(items.slice(0, 2)), '0')).toBeUndefined();
  expect(hoverMosaic(items.slice(0, 3), initialMosaic(items), '1')).toBeUndefined();
  expect(hoverMosaic(items, initialMosaic(items), 'missing')).toBeUndefined();
  const pair = initialMosaic(items.slice(0, 2));
  expect(hoverMosaic(items.slice(0, 3), pair, '1', () => 0)?.tiles.map(tile => tile.id)).toEqual(['2', '1']);
});

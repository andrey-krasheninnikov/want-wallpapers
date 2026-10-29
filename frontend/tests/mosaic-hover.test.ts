import { expect, test } from 'bun:test';
import { hoverMosaic, initialMosaic, type MosaicWallpaper } from '../src/lib/home-mosaic';

const items: MosaicWallpaper[] = Array.from({ length: 8 }, (_, index) => ({
  id: String(index), href: `/wallpapers/work-${index}/`, title: `Work ${index}`, description: `Description ${index}`,
  desktop: { src: `/${index}-desktop.webp`, width: 1200, height: 800 },
  mobile: { src: `/${index}-mobile.webp`, width: 600, height: 1000 },
}));

test('hover replaces one work and layout while preserving other links and preview variants', () => {
  const current = initialMosaic(items);
  const next = hoverMosaic(items, current, '1', () => 0)!;
  expect(next.layout).not.toBe(current.layout);
  expect(next.tiles[1]!.id).toBe('6');
  expect(next.tiles[1]!.variant).toBe('mobile');
  expect(next.tiles.filter((tile, index) => tile !== current.tiles[index])).toHaveLength(1);
  expect(new Set(next.tiles.map(tile => tile.id)).size).toBe(6);
  expect(current.tiles[1]!.id).toBe('1');
});

test('hover keeps a working frame when no distinct replacement exists', () => {
  expect(hoverMosaic(items.slice(0, 6), initialMosaic(items), '1')).toBeUndefined();
  expect(hoverMosaic(items, initialMosaic(items), 'missing')).toBeUndefined();
});

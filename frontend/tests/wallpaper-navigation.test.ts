import { expect, test } from 'bun:test';
import { wallpapers } from '../src/data/catalog';
import { selectedWallpaperVariant, wallpaperNeighbors, wallpaperSlideHref } from '../src/lib/wallpaper-navigation';

test('gallery wraps through the complete catalogue in its existing order', () => {
  const first = wallpaperNeighbors(wallpapers, wallpapers[0]!.id);
  expect(first.previous).toEqual(wallpapers.at(-1)!);
  expect(first.next).toEqual(wallpapers[1]);
  expect(first.position).toBe(1);
  expect(first.total).toBe(wallpapers.length);
  const last = wallpaperNeighbors(wallpapers, wallpapers.at(-1)!.id);
  expect(last.next).toEqual(wallpapers[0]);
  const boundary = wallpapers.findIndex((item, index) => index > 0 && item.collection !== wallpapers[index - 1]!.collection);
  expect(wallpaperNeighbors(wallpapers, wallpapers[boundary - 1]!.id).next).toEqual(wallpapers[boundary]);
});

test('a single wallpaper has no navigation and unknown entries fail explicitly', () => {
  const single = wallpaperNeighbors(wallpapers.slice(0, 1), wallpapers[0]!.id);
  expect(single.previous).toBeNull(); expect(single.next).toBeNull();
  expect(() => wallpaperNeighbors([], 'missing')).toThrow('Unknown wallpaper');
  expect(() => wallpaperNeighbors(wallpapers, 'missing')).toThrow('Unknown wallpaper');
});

test('only valid wallpaper variants survive links and reloads', () => {
  expect(selectedWallpaperVariant('?variant=mobile')).toBe('mobile');
  expect(selectedWallpaperVariant('?variant=desktop')).toBe('desktop');
  expect(selectedWallpaperVariant('?variant=unexpected')).toBe('desktop');
  expect(selectedWallpaperVariant('')).toBe('desktop');
  expect(wallpaperSlideHref('/ru/wallpapers/contours-of-silence-1/', 'mobile')).toBe('/ru/wallpapers/contours-of-silence-1/?variant=mobile#wallpaper-view');
});


test('random scene wallpapers exclude the current selection and keep a singleton', async () => {
  const { randomWallpaperIndex } = await import('../src/lib/device-wallpaper');
  for (const current of [0, 1, 34]) for (const sample of [0, .5, .999]) {
    const next = randomWallpaperIndex(35, current, sample);
    expect(next).not.toBe(current); expect(next).toBeGreaterThanOrEqual(0); expect(next).toBeLessThan(35);
  }
  expect(randomWallpaperIndex(1, 0)).toBe(0);
});

import type { Preview } from '@/data/previews';
import { randomWallpaperIndex } from './device-wallpaper';

export type MosaicWallpaper = { id: string; collection?: string; category?: string; desktop: Preview; mobile: Preview; title: string; description: string; href: string };
export type MosaicTile = MosaicWallpaper & { variant: 'desktop' | 'mobile' };
export type MosaicFrame = { tiles: MosaicTile[]; layout: number };

export function initialMosaic(items: MosaicWallpaper[]): MosaicFrame {
  return { layout: 0, tiles: items.slice(0, 6).map((item, index) => ({ ...item, variant: index === 1 ? 'mobile' : 'desktop' })) };
}

function shuffle(values: MosaicWallpaper[], random: () => number) {
  for (let index = values.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

export function nextMosaic(items: MosaicWallpaper[], current: MosaicFrame, random = Math.random): MosaicFrame {
  const shown = new Set(current.tiles.map(item => item.id));
  const chosen = [...shuffle(items.filter(item => !shown.has(item.id)), random), ...shuffle(items.filter(item => shown.has(item.id)), random)].slice(0, 6);
  if (chosen.length > 1 && chosen.every((item, index) => item.id === current.tiles[index]?.id)) chosen.push(chosen.shift()!);
  const layout = randomWallpaperIndex(3, current.layout, random());
  return { layout, tiles: chosen.map((item, index) => ({ ...item, variant: index === [1, 3, 0][layout] ? 'mobile' : 'desktop' })) };
}

export function hoverMosaic(items: MosaicWallpaper[], current: MosaicFrame, id: string, random = Math.random): MosaicFrame | undefined {
  const pinned = current.tiles.find(tile => tile.id === id);
  const others = current.tiles.filter(tile => tile.id !== id);
  if (!pinned || !others.length) return;
  const shown = new Set(current.tiles.map(tile => tile.id));
  const replacements = [
    ...shuffle(items.filter(item => !shown.has(item.id)), random),
    ...shuffle(items.filter(item => shown.has(item.id) && item.id !== id), random),
  ].slice(0, others.length);
  if (replacements.length < others.length || (others.length === 1 && replacements[0].id === others[0].id)) return;
  // Small catalogues reuse visible works; keep each in a different slot.
  replacements.forEach((item, index) => {
    if (item.id === others[index].id) {
      const next = (index + 1) % replacements.length;
      [replacements[index], replacements[next]] = [replacements[next], replacements[index]];
    }
  });
  let index = 0;
  return {
    layout: current.layout,
    tiles: current.tiles.map(tile => tile.id === id ? tile : { ...replacements[index++], variant: tile.variant }),
  };
}

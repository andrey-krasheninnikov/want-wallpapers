import type { Preview } from '@/data/previews';
import { randomWallpaperIndex } from './device-wallpaper';

export type MosaicWallpaper = { id: string; collection?: string; category?: string; desktop: Preview; mobile: Preview; title: string; description: string; href: string };
export type MosaicTile = MosaicWallpaper & { variant: 'desktop' | 'mobile' };
export type MosaicFrame = { tiles: MosaicTile[]; layout: number };

export function initialMosaic(items: MosaicWallpaper[]): MosaicFrame {
  return { layout: 0, tiles: items.slice(0, 6).map((item, index) => ({ ...item, variant: index === 1 ? 'mobile' : 'desktop' })) };
}

export function nextMosaic(items: MosaicWallpaper[], current: MosaicFrame, random = Math.random): MosaicFrame {
  const shuffle = (values: MosaicWallpaper[]) => {
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  };
  const shown = new Set(current.tiles.map(item => item.id));
  const chosen = [...shuffle(items.filter(item => !shown.has(item.id))), ...shuffle(items.filter(item => shown.has(item.id)))].slice(0, 6);
  if (chosen.length > 1 && chosen.every((item, index) => item.id === current.tiles[index]?.id)) chosen.push(chosen.shift()!);
  const layout = randomWallpaperIndex(3, current.layout, random());
  return { layout, tiles: chosen.map((item, index) => ({ ...item, variant: index === [1, 3, 0][layout] ? 'mobile' : 'desktop' })) };
}

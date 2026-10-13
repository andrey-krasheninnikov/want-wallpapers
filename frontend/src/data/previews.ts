import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { previewUrl, downloadUrl, s3Url, type Wallpaper, type Collection, getCollectionWallpapers } from './catalog';

export type Preview = { src: string; width: number; height: number };
export type WallpaperVariant = Preview & { download: string; original: string; originalWidth: number; originalHeight: number };
let dimensions: Record<string, { width: number; height: number }> = {};
try {
  dimensions = JSON.parse(readFileSync(new URL('../../public/previews/dimensions.json', import.meta.url), 'utf8'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export async function previewData(wallpaper: Wallpaper, variant: 'desktop' | 'mobile'): Promise<WallpaperVariant> {
  const key = `${wallpaper.slug}-${variant}`;
  const size = dimensions[key] ?? await sharp(new URL(`../../public/previews/${key}.webp`, import.meta.url).pathname).metadata();
  if (!size.width || !size.height) throw new Error(`Missing preview dimensions: ${key}`);
  const original = await sharp(new URL(`../../public/downloads/${key}.png`, import.meta.url).pathname).metadata();
  if (original.format !== 'png' || !original.width || !original.height) throw new Error(`Invalid original dimensions: ${key}`);
  return { originalWidth: original.width, originalHeight: original.height, src: previewUrl(wallpaper, variant), width: size.width, height: size.height, download: downloadUrl(wallpaper, variant), original: s3Url(wallpaper, variant) };
}

export async function collectionCoverData(collection: Collection): Promise<Preview | undefined> {
  if (collection.videoCover) {
    const key = `collection-${collection.id}`;
    const size = dimensions[key];
    if (!size?.width || !size.height) throw new Error(`Missing collection poster dimensions: ${key}`);
    return { src: `/previews/${key}.webp`, ...size };
  }
  const first = getCollectionWallpapers(collection.slug)[0];
  return first ? previewData(first, 'desktop') : undefined;
}

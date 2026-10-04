import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { previewUrl, downloadUrl, s3Url, type Wallpaper } from './catalog';

export type Preview = { src: string; width: number; height: number };
export type WallpaperVariant = Preview & { download: string; original: string };
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
  return { src: previewUrl(wallpaper, variant), width: size.width, height: size.height, download: downloadUrl(wallpaper, variant), original: s3Url(wallpaper, variant) };
}

import type { VideoCover } from '@/data/catalog';

export function parseVideoCover(value: unknown, collectionId: string): VideoCover {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Video cover needs an MP4 URL and a PNG poster.');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || !Object.hasOwn(item, 'src') || !Object.hasOwn(item, 'poster')) throw new Error('Video cover needs exactly src and poster.');
  const prefix = `https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/${collectionId}/`;
  for (const [key, extension] of [['src', 'mp4'], ['poster', 'png']] as const) {
    const url = item[key];
    if (typeof url !== 'string' || url.length > 2048 || !url.startsWith(prefix) || !new RegExp(`^[a-zA-Z0-9][a-zA-Z0-9_-]*\\.${extension}$`).test(url.slice(prefix.length))) {
      throw new Error(`Cover ${key} must be an approved CDN ${extension.toUpperCase()} in this collection's folder, without URL parameters.`);
    }
  }
  return value as VideoCover;
}

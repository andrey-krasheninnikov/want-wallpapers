import type { Locale } from '@/data/catalog';
import type { Preview } from '@/data/previews';
import type { MosaicWallpaper } from './home-mosaic';

export type GalleryStory = { title: string; href: string; image?: Preview; paragraphs: string[] };
export type GalleryData = { locale: Locale; wallpapers: MosaicWallpaper[]; stories: Record<string, GalleryStory> };

const requests = new Map<string, Promise<GalleryData>>();
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const preview = (value: unknown) => object(value) && text(value.src) && value.src.startsWith('/previews/') &&
  typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0 &&
  typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0;

export function validateGalleryData(value: unknown, locale: Locale): asserts value is GalleryData {
  const prefix = locale === 'en' ? '/' : '/' + locale + '/';
  if (!object(value) || value.locale !== locale || !Array.isArray(value.wallpapers) || !object(value.stories) ||
    !value.wallpapers.every(item => object(item) && text(item.id) && text(item.title) && text(item.description) &&
      text(item.href) && item.href.startsWith(prefix + 'wallpapers/') && preview(item.desktop) && preview(item.mobile)) ||
    new Set(value.wallpapers.map(item => item.id)).size !== value.wallpapers.length ||
    !Object.entries(value.stories).every(([slug, item]) => object(item) && text(item.title) &&
      item.href === prefix + 'collections/' + slug + '/#collection-story' && (!item.image || preview(item.image)) &&
      Array.isArray(item.paragraphs) && item.paragraphs.length > 0 && item.paragraphs.every(text))) {
    throw new Error('Invalid gallery data');
  }
}

export function loadGalleryData(url: string, locale: Locale): Promise<GalleryData> {
  const key = locale + ':' + url;
  let request = requests.get(key);
  if (!request) {
    request = fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Gallery data unavailable');
      const data: unknown = await response.json();
      validateGalleryData(data, locale);
      return data;
    }).catch(error => { requests.delete(key); throw error; });
    requests.set(key, request);
  }
  return request;
}

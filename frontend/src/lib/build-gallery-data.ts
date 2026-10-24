import { createHash } from 'node:crypto';
import { collections, wallpapers, type Locale } from '@/data/catalog';
import { collectionStories } from '@/data/editorial';
import { localPath } from '@/data/copy';
import { previewData, collectionCoverData, type Preview } from '@/data/previews';
import { validateGalleryData, type GalleryData } from './gallery-data';

const lean = ({ src, width, height }: Preview): Preview => ({ src, width, height });
const payloads = new Map<Locale, Promise<{ data: GalleryData; json: string; hash: string; url: string }>>();

export function buildGalleryData(locale: Locale) {
  let payload = payloads.get(locale);
  if (!payload) {
    payload = (async () => {
      const items = await Promise.all(wallpapers.map(async item => ({
        id: item.id, collection: item.collection, category: item.category, title: item.title[locale], description: item.description[locale],
        href: localPath(locale, '/wallpapers/' + item.slug + '/'),
        desktop: lean(await previewData(item, 'desktop')), mobile: lean(await previewData(item, 'mobile')),
      })));
      const stories = Object.fromEntries(await Promise.all(collections.map(async item => {
        const cover = await collectionCoverData(item);
        return [item.slug, { title: item.title[locale], href: localPath(locale, '/collections/' + item.slug + '/#collection-story'),
          image: cover ? lean(cover) : undefined, paragraphs: collectionStories[item.slug]?.[locale] }];
      })));
      const data = { locale, wallpapers: items, stories };
      validateGalleryData(data, locale);
      const json = JSON.stringify(data);
      const hash = createHash('sha256').update(json).digest('hex');
      return { data, json, hash, url: '/gallery-data/' + locale + '/' + hash + '.json' };
    })();
    payloads.set(locale, payload);
  }
  return payload;
}

import { collections, getCollectionWallpapers, categoryLabels, tagLabels, type Collection, type Locale, type Wallpaper } from '@/data/catalog';
import { copy, localPath } from '@/data/copy';
import { previewData } from '@/data/previews';
import type { CollectionCardData, WallpaperCardData } from '@/components/Gallery';

export async function wallpaperCard(wallpaper: Wallpaper, locale: Locale): Promise<WallpaperCardData> {
  const collection = collections.find((item) => item.slug === wallpaper.collection);
  return {
    id: wallpaper.id, href: localPath(locale, `/wallpapers/${wallpaper.slug}/`),
    title: wallpaper.title[locale], description: wallpaper.description[locale],
    collectionTitle: collection?.title[locale] ?? '', number: wallpaper.number,
    image: await previewData(wallpaper, 'desktop'), category: wallpaper.category, collection: wallpaper.collection,
    searchText: [wallpaper.title[locale], wallpaper.description[locale], collection?.title[locale], categoryLabels[wallpaper.category][locale], ...wallpaper.tags.map((tag) => tagLabels[tag][locale])].join(' '),
  };
}

export async function collectionCard(collection: Collection, locale: Locale): Promise<CollectionCardData> {
  const items = getCollectionWallpapers(collection.slug);
  return {
    href: localPath(locale, `/collections/${collection.slug}/`), title: collection.title[locale],
    description: collection.description[locale], countLabel: `${items.length} ${copy[locale].wallpapers}`,
    image: items[0] ? await previewData(items[0], 'desktop') : undefined,
  };
}

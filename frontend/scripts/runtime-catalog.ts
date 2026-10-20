import { writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { collections, wallpapers, publicationDates, locales } from '../src/data/catalog';
import { copy, localPath } from '../src/data/copy';
import { buildGalleryData } from '../src/lib/build-gallery-data';
import { newestWallpapers } from '../src/lib/catalog-order';
import DeviceScene from '../src/components/DeviceScene';
import { MosaicCard } from '../src/components/HomeMosaic';
import { CoverMedia } from '../src/components/CollectionCover';
import { WallpaperNavigationLink } from '../src/components/WallpaperNavigation';

const localized = Object.fromEntries(await Promise.all(locales.map(async locale => {
  const { data, url } = await buildGalleryData(locale);
  const sceneHtml: Record<string, string> = {}, mosaicHtml: Record<string, string[]> = {}, coverHtml: Record<string, string> = {};
  const previousHtml: Record<string, string> = {}, nextHtml: Record<string, string> = {};
  for (const item of data.wallpapers) {
    sceneHtml[item.id] = await new HTMLRewriter().on('link[rel="preload"]', { element(element) { element.remove(); } })
      .transform(new Response(renderToString(createElement(DeviceScene, { locale, items: [item], initialId: item.id, dataUrl: url })))).text();
    mosaicHtml[item.id] = ['desktop', 'mobile'].map(variant => renderToStaticMarkup(createElement(MosaicCard, { locale, tile: { ...item, variant: variant as 'desktop' | 'mobile' } })));
    const wallpaper = wallpapers.find(wallpaper => wallpaper.id === item.id)!;
    const collection = collections.find(collection => collection.id === wallpaper.collectionId)!;
    coverHtml[item.id] = renderToStaticMarkup(createElement(CoverMedia, { image: item.desktop, alt: collection.description[locale], listingId: localPath(locale, '/collections/' + collection.slug + '/') }));
    for (const direction of ['previous', 'next'] as const) {
      (direction === 'previous' ? previousHtml : nextHtml)[item.id] = renderToStaticMarkup(createElement(WallpaperNavigationLink, { locale, item, direction }));
    }
  }
  return [locale, { gallery: data, dataUrl: url, sceneHtml, mosaicHtml, coverHtml, previousHtml, nextHtml,
    resultsLabel: copy[locale].results, wallpapersLabel: copy[locale].wallpapers, collectionsLabel: copy[locale].collections.toLocaleLowerCase(locale),
    numbers: Array.from({ length: wallpapers.length + 1 }, (_, index) => index.toLocaleString(locale)) }];
})));
await writeFile(new URL('../runtime-catalog.json', import.meta.url), JSON.stringify({ schema: 1, collections, wallpapers, order: newestWallpapers(wallpapers, publicationDates).map(item => item.id), locales: localized }));

import { expect, test, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import { collections, locales, wallpapers } from '../src/data/catalog';
import { collectionStories } from '../src/data/editorial';
import { buildGalleryData } from '../src/lib/build-gallery-data';
import { loadGalleryData, validateGalleryData } from '../src/lib/gallery-data';

for (const locale of locales) test('gallery payload preserves public data: ' + locale, async () => {
  const payload = await buildGalleryData(locale);
  expect(payload).toBe(await buildGalleryData(locale));
  expect(payload.hash).toBe(createHash('sha256').update(payload.json).digest('hex'));
  expect(payload.url).toBe('/gallery-data/' + locale + '/' + payload.hash + '.json');
  const data = JSON.parse(payload.json);
  expect(() => validateGalleryData(data, locale)).not.toThrow();
  expect(data.wallpapers.map((item: { id: string }) => item.id)).toEqual(wallpapers.map(item => item.id));
  expect(Object.keys(data.stories)).toEqual(collections.map(item => item.slug));
  for (const collection of collections) {
    expect(data.stories[collection.slug].paragraphs).toEqual(collectionStories[collection.slug]![locale]);
    expect(data.stories[collection.slug].title).toBe(collection.title[locale]);
    expect(data.stories[collection.slug].href).toEndWith('/' + collection.slug + '/#collection-story');
  }
  expect(Object.keys(data.wallpapers[0].desktop).sort()).toEqual(['height', 'src', 'width']);
  expect(payload.json).not.toContain('originalWidth');
});

test('shared gallery requests load once and reject malformed or wrong-locale data', async () => {
  const { json, data } = await buildGalleryData('en');
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(json, { headers: { 'content-type': 'application/json' } }));
  try {
    const first = loadGalleryData('/gallery-data/shared.json', 'en');
    expect(loadGalleryData('/gallery-data/shared.json', 'en')).toBe(first);
    expect(await first).toEqual(data);
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const value of [null, {}, { ...data, locale: 'ru' }, { ...data, wallpapers: [...data.wallpapers, data.wallpapers[0]] },
      { ...data, wallpapers: [{ ...data.wallpapers[0], desktop: { src: '/bad', width: 1, height: 1 } }] },
      { ...data, stories: { broken: { title: 'Story', href: '/collections/broken/#collection-story', paragraphs: [] } } }]) {
      expect(() => validateGalleryData(value, 'en')).toThrow('Invalid gallery data');
    }
  } finally { fetch.mockRestore(); }
});

test('failed gallery requests can recover on the next visit', async () => {
  const { json } = await buildGalleryData('en');
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
    .mockResolvedValueOnce(new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } }))
    .mockResolvedValueOnce(new Response(json, { headers: { 'content-type': 'application/json' } }));
  try {
    expect(await loadGalleryData('/gallery-data/retry.json', 'en').catch(error => error.message)).toBe('Gallery data unavailable');
    expect(await loadGalleryData('/gallery-data/retry.json', 'en').catch(error => error.message)).toBe('Gallery data unavailable');
    expect((await loadGalleryData('/gallery-data/retry.json', 'en')).locale).toBe('en');
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally { fetch.mockRestore(); }
});

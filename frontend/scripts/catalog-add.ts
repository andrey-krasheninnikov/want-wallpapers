import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { categoryLabels, locales, tagLabels, type Collection, type Wallpaper } from '../src/data/catalog';
import { catalogRequest } from './catalog-api';

export type CollectionManifest = { collection: Collection; wallpapers: Wallpaper[] };

function record(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || keys.some((key) => !Object.hasOwn(item, key))) {
    throw new Error(`${label} must contain exactly: ${keys.join(', ')}.`);
  }
  return item;
}

function localized(value: unknown, label: string, max: number) {
  const item = record(value, label, locales);
  for (const locale of locales) {
    if (typeof item[locale] !== 'string' || !item[locale].trim() || item[locale].length > max || item[locale].includes('\0')) throw new Error(`${label}.${locale} must be non-empty text.`);
  }
}

export function parseCollection(value: unknown): Collection {
  const collection = record(value, 'Collection', ['id', 'slug', 'count', 'title', 'description']);
  if (typeof collection.slug !== 'string' || collection.slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection.slug)) {
    throw new Error('Collection slug must use lowercase letters, digits and single hyphens.');
  }
  const folder = typeof collection.id === 'string' && collection.id.match(/^(\d+)-(.+)$/);
  if (!folder || (collection.id as string).length > 200 || !Number.isSafeInteger(Number(folder[1])) || Number(folder[1]) < 1 || folder[2] !== collection.slug) {
    throw new Error('Collection id must be the positive CDN number followed by its slug, preserving leading zeros.');
  }
  if (typeof collection.count !== 'number' || !Number.isSafeInteger(collection.count) || collection.count < 0 || collection.count > 1000) {
    throw new Error('Collection count must be an integer between 0 and 1000.');
  }
  localized(collection.title, 'Collection title', 200);
  localized(collection.description, 'Collection description', 2000);
  return value as Collection;
}

export function parseCollectionManifest(value: unknown): CollectionManifest {
  const manifest = record(value, 'Manifest', ['collection', 'wallpapers']);
  const collection = parseCollection(manifest.collection);
  if (!Array.isArray(manifest.wallpapers) || !manifest.wallpapers.length || collection.count !== manifest.wallpapers.length) {
    throw new Error('Collection count must match a non-empty wallpaper list.');
  }
  const numbers = new Set<number>();
  for (const value of manifest.wallpapers) {
    const item = record(value, 'Wallpaper', ['id', 'slug', 'collection', 'collectionId', 's3Folder', 'fileStem', 'number', 'category', 'tags', 'title', 'description']);
    if (typeof item.number !== 'number' || !Number.isSafeInteger(item.number) || item.number < 1 || numbers.has(item.number)) {
      throw new Error('Wallpaper numbers must be unique positive integers.');
    }
    numbers.add(item.number);
    if (item.id !== `${collection.slug}-${item.number}` || item.slug !== item.id
      || item.collection !== collection.slug || item.collectionId !== collection.id
      || item.s3Folder !== collection.id || item.fileStem !== collection.slug) {
      throw new Error('Wallpaper identity and CDN fields must match the collection and number.');
    }
    if (typeof item.category !== 'string' || !Object.hasOwn(categoryLabels, item.category)) throw new Error('Unknown wallpaper category. Add its localized label first.');
    if (!Array.isArray(item.tags) || !item.tags.length || new Set(item.tags).size !== item.tags.length
      || item.tags.some((tag) => typeof tag !== 'string' || !Object.hasOwn(tagLabels, tag))) {
      throw new Error('Wallpaper tags must be unique known tags. Add localized labels first.');
    }
    localized(item.title, 'Wallpaper title', 200);
    localized(item.description, 'Wallpaper description', 2000);
  }
  return value as CollectionManifest;
}

export async function addCollection(input: CollectionManifest): Promise<'created' | 'unchanged'> {
  const manifest = parseCollectionManifest(input);
  const result = await catalogRequest<{ result: 'created' | 'unchanged' }>('/import', manifest);
  const saved = await catalogRequest<{ collections: { item: Collection; archived: boolean }[]; wallpapers: { item: Wallpaper; archived: boolean }[] }>('');
  const collection = saved.collections.find((record) => record.item.id === manifest.collection.id);
  const wallpapers = saved.wallpapers.filter((record) => record.item.collectionId === manifest.collection.id);
  if (!collection || collection.archived || !isDeepStrictEqual(collection.item, manifest.collection)
    || wallpapers.length !== manifest.wallpapers.length || wallpapers.some((record) => record.archived || !manifest.wallpapers.some((item) => isDeepStrictEqual(item, record.item)))) {
    throw new Error('Catalogue readback differs from the manifest. Reconcile server state before retrying.');
  }
  return result.result;
}
async function main() {
  const args = process.argv.slice(2), paths = args.filter((arg) => arg !== '--dry-run');
  if (paths.length !== 1 || paths[0]!.startsWith('-') || args.length !== new Set(args).size) throw new Error('Usage: bun run catalog:add /path/collection.json [--dry-run]');
  const manifest = parseCollectionManifest(JSON.parse(await readFile(paths[0]!, 'utf8')));
  if (args.includes('--dry-run')) {
    console.log(`Validated ${manifest.collection.id}: ${manifest.wallpapers.length} wallpapers. No server reads or writes.`);
    return;
  }
  const result = await addCollection(manifest);
  console.log(`${result === 'created' ? 'Created and verified' : 'Already present and verified'} ${manifest.collection.id}: ${manifest.wallpapers.length} wallpapers.`);
}
if (import.meta.main) {
  try { await main(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Catalogue import failed.'); process.exitCode = 1; }
}

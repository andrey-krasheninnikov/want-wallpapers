import { rename, writeFile } from 'node:fs/promises';
import type { Collection, Wallpaper } from '../src/data/catalog';
import { apiOrigin } from './catalog-api';
import { parseCollection, parseCollectionManifest } from './catalog-add';
const response = await fetch(`${apiOrigin()}/api/v1/catalog`, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Catalog export failed (HTTP ${response.status}). Keeping the current snapshot.`);
const snapshot = await response.json() as { collections: Collection[]; wallpapers: Wallpaper[] };
if (!Array.isArray(snapshot.collections) || !Array.isArray(snapshot.wallpapers) || !snapshot.collections.length || !snapshot.wallpapers.length) throw new Error('Remote catalogue is empty or invalid. Keeping the current snapshot.');
const { collections, wallpapers } = snapshot;
if (new Set(collections.map((item) => item.id)).size !== collections.length || new Set(wallpapers.map((item) => item.id)).size !== wallpapers.length) throw new Error('Duplicate catalogue identity.');
for (const collection of collections) {
  parseCollection(collection);
  const items = wallpapers.filter((item) => item.collectionId === collection.id);
  if (items.length) parseCollectionManifest({ collection, wallpapers: items });
  else if (collection.count !== 0) throw new Error(`Count mismatch in ${collection.id}.`);
}
if (wallpapers.some((item) => !collections.some((collection) => collection.id === item.collectionId))) throw new Error('Orphaned wallpapers in catalog export.');
collections.sort((a, b) => a.id.localeCompare(b.id));
wallpapers.sort((a, b) => a.collectionId.localeCompare(b.collectionId) || a.number - b.number);
const path = new URL('../src/data/catalog-live.json', import.meta.url);
const temporary = new URL('../src/data/catalog-live.json.tmp', import.meta.url);
await writeFile(temporary, `${JSON.stringify({ collections, wallpapers }, null, 2)}\n`);
await rename(temporary, path);
console.log(`Saved ${collections.length} collections and ${wallpapers.length} wallpapers.`);

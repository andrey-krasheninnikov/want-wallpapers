import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { categoryLabels, locales, tagLabels, type Collection, type Wallpaper } from '../src/data/catalog';

export type CollectionManifest = { collection: Collection; wallpapers: Wallpaper[] };

function record(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || keys.some((key) => !Object.hasOwn(item, key))) {
    throw new Error(`${label} must contain exactly: ${keys.join(', ')}.`);
  }
  return item;
}

function localized(value: unknown, label: string) {
  const item = record(value, label, locales);
  for (const locale of locales) {
    if (typeof item[locale] !== 'string' || !item[locale].trim()) throw new Error(`${label}.${locale} must be non-empty text.`);
  }
}

export function parseCollectionManifest(value: unknown): CollectionManifest {
  const manifest = record(value, 'Manifest', ['collection', 'wallpapers']);
  const collection = record(manifest.collection, 'Collection', ['id', 'slug', 'count', 'title', 'description']);
  if (typeof collection.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection.slug)) {
    throw new Error('Collection slug must use lowercase letters, digits and single hyphens.');
  }
  const folder = typeof collection.id === 'string' && collection.id.match(/^(\d+)-(.+)$/);
  if (!folder || !Number.isSafeInteger(Number(folder[1])) || Number(folder[1]) < 1 || folder[2] !== collection.slug) {
    throw new Error('Collection id must be the positive CDN number followed by its slug, preserving leading zeros.');
  }
  if (!Array.isArray(manifest.wallpapers) || !manifest.wallpapers.length
    || collection.count !== manifest.wallpapers.length) throw new Error('Collection count must match a non-empty wallpaper list.');
  localized(collection.title, 'Collection title');
  localized(collection.description, 'Collection description');
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
    localized(item.title, 'Wallpaper title');
    localized(item.description, 'Wallpaper description');
  }
  return value as CollectionManifest;
}

export async function addCollection(db: Firestore, input: CollectionManifest): Promise<'created' | 'unchanged'> {
  const { collection, wallpapers } = parseCollectionManifest(input);
  const expected = new Map<string, Collection | Wallpaper>([
    [`collections/${collection.id}`, collection],
    ...wallpapers.map((item) => [`wallpapers/${item.id}`, item] as const),
  ]);
  const [collectionDocs, wallpaperDocs] = await Promise.all([
    db.collection('collections').get(), db.collection('wallpapers').get(),
  ]);
  const existing = [...collectionDocs.docs, ...wallpaperDocs.docs];
  const related = existing.filter((doc) => {
    const item = doc.data();
    return expected.has(doc.ref.path) || (doc.ref.parent.id === 'collections'
      ? item.slug === collection.slug || Number(doc.id.split('-')[0]) === Number(collection.id.split('-')[0])
      : item.collectionId === collection.id || item.collection === collection.slug);
  });
  if (related.length) {
    if (related.length === expected.size && related.every((doc) => expected.has(doc.ref.path)
      && isDeepStrictEqual(doc.data(), expected.get(doc.ref.path)))) return 'unchanged';
    throw new Error('Catalogue conflict: existing collection data is partial or differs from the manifest. Nothing was written.');
  }
  const batch = db.batch();
  for (const [path, data] of expected) batch.create(db.doc(path), data);
  await batch.commit();
  const saved = await db.getAll(...[...expected.keys()].map((path) => db.doc(path)));
  if (saved.some((doc) => !doc.exists || !isDeepStrictEqual(doc.data(), expected.get(doc.ref.path)))) {
    throw new Error('Catalogue readback differs from the manifest. Reconcile server state before retrying.');
  }
  return 'created';
}

async function main() {
  const args = process.argv.slice(2);
  const paths = args.filter((arg) => arg !== '--dry-run');
  if (paths.length !== 1 || paths[0]!.startsWith('-') || args.length !== new Set(args).size) {
    throw new Error('Usage: bun run catalog:add /path/collection.json [--dry-run]');
  }
  const manifest = parseCollectionManifest(JSON.parse(await readFile(paths[0]!, 'utf8')));
  if (args.includes('--dry-run')) {
    console.log(`Validated ${manifest.collection.id}: ${manifest.wallpapers.length} wallpapers. No Firebase reads or writes.`);
    return;
  }
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)) throw new Error('Only a local Firestore emulator is supported.');
  if (!emulator) {
    const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!key) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account key outside the repository.');
    const root = await realpath(resolve(import.meta.dir, '..'));
    const keyPath = relative(root, await realpath(key));
    if (!keyPath || (!isAbsolute(keyPath) && keyPath !== '..' && !keyPath.startsWith('../'))) {
      throw new Error('The service account key must be outside the repository.');
    }
  }
  const app = initializeApp(emulator ? { projectId: 'demo-want-wallpapers' }
    : { credential: applicationDefault(), projectId: 'want-wallpapers' });
  const db = getFirestore(app);
  try {
    const result = await addCollection(db, manifest);
    console.log(`${result === 'created' ? 'Created and verified' : 'Already present and verified'} ${manifest.collection.id}: ${manifest.wallpapers.length} wallpapers.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw new Error(`Firestore import failed (code ${String(error.code)}). Reconcile server state before retrying.`);
    }
    throw error;
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Catalogue import failed.');
    process.exitCode = 1;
  }
}

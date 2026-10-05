import { SQL } from 'bun';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import snapshot from '../src/data/catalog-live.json';
import { parseCollectionManifest } from './catalog-add';

const file = process.env.DATABASE_URL_FILE;
assert(process.env.APP_ENV === 'development' && file, 'UI catalogue requires a development database file.');
const url = readFileSync(file, 'utf8').trim();
assert(/^postgresql:\/\/postgres:[a-f0-9]+@127\.0\.0\.1:\d+\/wallpapers_ui_[a-f0-9]+\?sslmode=disable$/.test(url), 'UI catalogue requires an isolated local database.');
const manifests = snapshot.collections.map((collection) => parseCollectionManifest({
  collection, wallpapers: snapshot.wallpapers.filter((wallpaper) => wallpaper.collectionId === collection.id),
}));

type Saved = { id: string; data: unknown; archived: boolean };
const database = new SQL(url);
try {
  await database.begin(async (transaction) => {
    const savedCollections = new Map((await transaction<Saved[]>`SELECT id,data,archived FROM collections`).map((record) => [record.id, record]));
    const savedWallpapers = new Map((await transaction<Saved[]>`SELECT id,data,archived FROM wallpapers`).map((record) => [record.id, record]));
    for (const { collection, wallpapers } of manifests) {
      const saved = savedCollections.get(collection.id);
      if (saved) {
        assert(!saved.archived);
        assert.deepStrictEqual(saved.data, collection, 'Initial UI collection differs from the build snapshot.');
      } else {
        const inserted = await transaction<{ data: unknown }[]>`INSERT INTO collections(id,folder_number,slug,data) VALUES(${collection.id},${Number(collection.id.split('-')[0])},${collection.slug},${collection}::jsonb) RETURNING data`;
        assert.deepStrictEqual(inserted[0]?.data, collection);
      }
      for (const wallpaper of wallpapers) {
        const saved = savedWallpapers.get(wallpaper.id);
        if (saved) {
          assert(!saved.archived);
          assert.deepStrictEqual(saved.data, wallpaper, 'Initial UI wallpaper differs from the build snapshot.');
        } else {
          const inserted = await transaction<{ data: unknown }[]>`INSERT INTO wallpapers(id,collection_id,number,data) VALUES(${wallpaper.id},${wallpaper.collectionId},${wallpaper.number},${wallpaper}::jsonb) RETURNING data`;
          assert.deepStrictEqual(inserted[0]?.data, wallpaper);
        }
      }
    }
  });
} finally {
  await database.close();
}
console.log(`Prepared UI catalogue: ${snapshot.collections.length} collections and ${snapshot.wallpapers.length} wallpapers.`);

import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore, terminate } from 'firebase/firestore';
import { writeFile } from 'node:fs/promises';
import type { Collection, Wallpaper } from '../src/data/catalog';

const app = initializeApp({
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: 'want-wallpapers',
  appId: process.env.PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const [collectionDocs, wallpaperDocs] = await Promise.all([
  getDocs(collection(db, 'collections')), getDocs(collection(db, 'wallpapers')),
]);
const collections = collectionDocs.docs.map((item) => item.data() as Collection).sort((a, b) => a.id.localeCompare(b.id));
const wallpapers = wallpaperDocs.docs.map((item) => item.data() as Wallpaper).sort((a, b) => a.collectionId.localeCompare(b.collectionId) || a.number - b.number);
if (!collections.length || !wallpapers.length) throw new Error('Remote catalogue is empty. Keeping the current snapshot.');
for (const collection of collections) {
  if (wallpapers.filter((item) => item.collectionId === collection.id).length !== collection.count) throw new Error(`Count mismatch in ${collection.id}.`);
}
await writeFile(new URL('../src/data/catalog-live.json', import.meta.url), `${JSON.stringify({ collections, wallpapers }, null, 2)}\n`);
await terminate(db);
console.log(`Saved ${collections.length} collections and ${wallpapers.length} wallpapers.`);

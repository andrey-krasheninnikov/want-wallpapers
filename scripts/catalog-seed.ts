import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initialCatalog } from '../src/data/catalog';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account key outside the repository.');
initializeApp({ credential: applicationDefault(), projectId: 'want-wallpapers' });
const db = getFirestore();
const existing = await db.collection('wallpapers').limit(1).get();
if (!existing.empty) throw new Error('Catalogue already exists. Edit it in Firebase Console and run catalog:pull.');
const batch = db.batch();
for (const item of initialCatalog.collections) batch.set(db.collection('collections').doc(item.id), item);
for (const item of initialCatalog.wallpapers) batch.set(db.collection('wallpapers').doc(item.id), item);
await batch.commit();
console.log(`Created ${initialCatalog.collections.length} collections and ${initialCatalog.wallpapers.length} wallpapers.`);

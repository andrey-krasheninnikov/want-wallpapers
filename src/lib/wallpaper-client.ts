import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { app, currentUser, db } from './firebase-client';
import { getRegion } from './privacy';

import { ratingValues, type Rating } from '@/data/ratings';
export type Comment = { id: string; uid: string; text: string; createdAt: number | null };
export type SocialData = { counts: Record<Rating, number>; ownRating: Rating | ''; ownUid: string | null; comments: Comment[] };

function requireRegion() {
  if (getRegion() !== 'open') throw new Error('Region unavailable');
}

export async function readSocial(wallpaperId: string): Promise<SocialData> {
  requireRegion();
  const ratings = collection(db, 'wallpapers', wallpaperId, 'ratings');
  const auth = getAuth(app);
  await auth.authStateReady();
  const ownUid = auth.currentUser?.uid ?? null;
  const [counts, result, own] = await Promise.all([
    Promise.all(ratingValues.map(async (value) => [value, (await getCountFromServer(query(ratings, where('value', '==', value)))).data().count] as const)),
    getDocs(query(collection(db, 'wallpapers', wallpaperId, 'comments'), orderBy('createdAt', 'desc'), limit(50))),
    ownUid ? getDoc(doc(ratings, ownUid)) : undefined,
  ]);
  const ownValue = own?.data()?.value;
  return {
    counts: Object.fromEntries(counts) as Record<Rating, number>, ownUid,
    ownRating: ratingValues.includes(ownValue) ? ownValue : '',
    comments: result.docs.map((snap) => ({ id: snap.id, uid: String(snap.data().uid ?? ''), text: String(snap.data().text ?? ''), createdAt: snap.data().createdAt?.toMillis?.() ?? null })),
  };
}

export async function saveRating(wallpaperId: string, value: Rating) {
  requireRegion();
  if (!ratingValues.includes(value)) throw new Error('Invalid rating');
  const user = await currentUser();
  await setDoc(doc(db, 'wallpapers', wallpaperId, 'ratings', user.uid), { uid: user.uid, value, updatedAt: serverTimestamp() });
}

export async function postComment(wallpaperId: string, value: string) {
  requireRegion();
  const text = value.trim();
  if (text.length < 2 || text.length > 1000) throw new Error('Invalid comment');
  const user = await currentUser();
  const author = doc(db, 'wallpapers', wallpaperId, 'commentAuthors', user.uid);
  const last = await getDoc(author);
  if (last.exists() && last.data().lastAt?.toMillis?.() > Date.now() - 86400000) throw new Error('comment-cooldown');
  const comment = doc(collection(db, 'wallpapers', wallpaperId, 'comments'));
  const batch = writeBatch(db);
  batch.set(comment, { uid: user.uid, text, createdAt: serverTimestamp() });
  batch.set(author, { uid: user.uid, lastCommentId: comment.id, lastAt: serverTimestamp() });
  await batch.commit();
}

export async function actOnComment(wallpaperId: string, comment: Comment) {
  requireRegion();
  const user = await currentUser();
  if (comment.uid === user.uid) {
    await deleteDoc(doc(db, 'wallpapers', wallpaperId, 'comments', comment.id));
    return 'deleted' as const;
  }
  await setDoc(doc(db, 'reports', `${wallpaperId}_${comment.id}_${user.uid}`), { wallpaperId, commentId: comment.id, uid: user.uid, createdAt: serverTimestamp() });
  return 'reported' as const;
}

import { afterAll, beforeAll, beforeEach, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'want-wallpapers-test', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'wallpapers', 'w1'), { id: 'w1', title: { en: 'Test' } });
  });
});

test('catalogue is public and feedback is private', async () => {
  const visitor = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(visitor, 'wallpapers', 'w1')));
  await assertFails(getDocs(collection(visitor, 'feedback')));
  await assertFails(setDoc(doc(visitor, 'feedback', 'x'), { message: 'hello' }));
});

test('rating belongs to its owner and accepts only four values', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(alice, 'wallpapers', 'w1', 'ratings', 'alice'), { uid: 'alice', value: 'plus', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(alice, 'wallpapers', 'w1', 'ratings', 'alice'), { uid: 'alice', value: 'imba', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(bob, 'wallpapers', 'w1', 'ratings', 'alice'), { uid: 'alice', value: 'cringe', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(alice, 'wallpapers', 'w1', 'ratings', 'alice'), { uid: 'alice', value: 'unknown', updatedAt: serverTimestamp() }));
});

test('comment requires an atomic cooldown update and respects ownership', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const comment = doc(alice, 'wallpapers', 'w1', 'comments', 'first');
  const author = doc(alice, 'wallpapers', 'w1', 'commentAuthors', 'alice');
  await assertFails(setDoc(comment, { uid: 'alice', text: 'First comment', createdAt: serverTimestamp() }));
  const batch = writeBatch(alice);
  batch.set(comment, { uid: 'alice', text: 'First comment', createdAt: serverTimestamp() });
  batch.set(author, { uid: 'alice', lastCommentId: 'first', lastAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  const second = writeBatch(alice);
  second.set(doc(alice, 'wallpapers', 'w1', 'comments', 'second'), { uid: 'alice', text: 'Too soon', createdAt: serverTimestamp() });
  second.set(author, { uid: 'alice', lastCommentId: 'second', lastAt: serverTimestamp() });
  await assertFails(second.commit());
  await assertFails(deleteDoc(doc(bob, 'wallpapers', 'w1', 'comments', 'first')));
  await assertSucceeds(deleteDoc(comment));
});

test('feedback accepts bounded owner data and cannot be read publicly', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(alice, 'feedback', 'first'), { uid: 'alice', topic: 'Idea', message: 'More colours please', email: '', status: 'open', createdAt: serverTimestamp() }));
  await assertFails(getDoc(doc(alice, 'feedback', 'first')));
  await assertFails(setDoc(doc(alice, 'feedback', 'invalid'), { uid: 'bob', topic: 'Idea', message: 'Hello', email: '', status: 'open', createdAt: serverTimestamp() }));
});

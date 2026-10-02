import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { currentUser, db } from './firebase-client';
import { getRegion } from './privacy';

export async function sendFeedback(input: { topic: string; message: string; email: string }) {
  if (getRegion() !== 'open') throw new Error('Region unavailable');
  const topic = input.topic.trim();
  const message = input.message.trim();
  const email = input.email.trim();
  if (!topic || topic.length > 100 || message.length < 5 || message.length > 2000 || email.length > 254) throw new Error('Invalid feedback');
  const user = await currentUser();
  await addDoc(collection(db, 'feedback'), { uid: user.uid, topic, message, email, status: 'open', createdAt: serverTimestamp() });
}

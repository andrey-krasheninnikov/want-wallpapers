import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { currentUser, db } from './firebase-client';
import { copy } from '../data/copy';
import type { Locale } from '../data/catalog';

const page = document.querySelector<HTMLElement>('#feedback-page');
const form = document.querySelector<HTMLFormElement>('#feedback-form');
if (page && form) {
  const ui = copy[page.dataset.locale as Locale];
  const status = document.querySelector<HTMLElement>('#feedback-status')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (document.documentElement.dataset.region !== 'open') return;
    const topic = form.querySelector<HTMLInputElement>('#feedback-topic')!.value.trim();
    const message = form.querySelector<HTMLTextAreaElement>('#feedback-message')!.value.trim();
    const email = form.querySelector<HTMLInputElement>('#feedback-email')!.value.trim();
    if (!topic || topic.length > 100 || message.length < 5 || message.length > 2000 || email.length > 254) return;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true; status.textContent = ui.loading;
    try {
      const user = await currentUser();
      await addDoc(collection(db, 'feedback'), { uid: user.uid, topic, message, email, status: 'open', createdAt: serverTimestamp() });
      form.reset(); status.textContent = ui.feedbackThanks;
    } catch { status.textContent = ui.serviceError; }
    finally { submit.disabled = false; }
  });
}

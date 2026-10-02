import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { app, currentUser, db } from './firebase-client';
import { copy } from '../data/copy';
import type { Locale } from '../data/catalog';

const detail = document.querySelector<HTMLElement>('#wallpaper-detail');
const social = document.querySelector<HTMLElement>('#social');
if (detail && social) {
  const wallpaperId = detail.dataset.wallpaper!;
  const locale = detail.dataset.locale as Locale;
  const ui = copy[locale];
  const image = document.querySelector<HTMLImageElement>('#detail-image')!;
  const frame = document.querySelector<HTMLElement>('#detail-preview')!;
  const download = document.querySelector<HTMLAnchorElement>('#download-link')!;
  const original = document.querySelector<HTMLAnchorElement>('#original-link')!;
  let variant: 'desktop' | 'mobile' = 'desktop';
  let ownUid: string | null = null;

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-variant]')) {
    button.addEventListener('click', () => {
      variant = button.dataset.variant as 'desktop' | 'mobile';
      for (const item of document.querySelectorAll<HTMLButtonElement>('[data-variant]')) item.setAttribute('aria-pressed', String(item === button));
      image.src = image.dataset[variant]!;
      frame.classList.toggle('mobile', variant === 'mobile');
      download.href = download.dataset[variant]!;
      original.href = original.dataset[variant]!;
    });
  }
  download.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: wallpaperId, variant } }));
  });

  const ratings = collection(db, 'wallpapers', wallpaperId, 'ratings');
  const comments = collection(db, 'wallpapers', wallpaperId, 'comments');
  const list = document.querySelector<HTMLElement>('#comment-list')!;
  const status = document.querySelector<HTMLElement>('#comment-status')!;

  async function loadRatings() {
    const values = ['cringe', 'minus', 'plus', 'imba'] as const;
    await Promise.all(values.map(async (value) => {
      const count = await getCountFromServer(query(ratings, where('value', '==', value)));
      const label = document.querySelector<HTMLElement>(`[data-count="${value}"]`);
      if (label) label.textContent = String(count.data().count);
    }));
    const auth = getAuth(app);
    await auth.authStateReady();
    ownUid = auth.currentUser?.uid ?? null;
    if (ownUid) {
      const own = await getDoc(doc(ratings, ownUid));
      for (const button of social!.querySelectorAll<HTMLButtonElement>('[data-rating]')) {
        button.setAttribute('aria-pressed', String(own.exists() && own.data().value === button.dataset.rating));
      }
    }
  }

  async function loadComments() {
    const result = await getDocs(query(comments, orderBy('createdAt', 'desc'), limit(50)));
    list.replaceChildren();
    if (result.empty) { const empty = document.createElement('p'); empty.className = 'hint'; empty.textContent = ui.commentEmpty; list.append(empty); return; }
    const auth = getAuth(app);
    await auth.authStateReady();
    ownUid = auth.currentUser?.uid ?? null;
    for (const snap of result.docs) {
      const data = snap.data();
      const article = document.createElement('article'); article.className = 'comment';
      const body = document.createElement('p'); body.textContent = String(data.text ?? '');
      const date = document.createElement('small');
      date.textContent = data.createdAt?.toDate?.().toLocaleDateString(locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale) ?? '';
      const actions = document.createElement('div'); actions.className = 'comment-actions';
      const action = document.createElement('button'); action.type = 'button'; action.textContent = data.uid === ownUid ? ui.delete : ui.report;
      action.addEventListener('click', async () => {
        try {
          const user = await currentUser();
          if (data.uid === user.uid) await deleteDoc(snap.ref);
          else { await setDoc(doc(db, 'reports', `${wallpaperId}_${snap.id}_${user.uid}`), { wallpaperId, commentId: snap.id, uid: user.uid, createdAt: serverTimestamp() }); status.textContent = ui.reportThanks; }
          if (data.uid === user.uid) await loadComments();
          else action.disabled = true;
        } catch { status.textContent = ui.serviceError; }
      });
      actions.append(action); article.append(body, date, actions); list.append(article);
    }
  }

  for (const button of social.querySelectorAll<HTMLButtonElement>('[data-rating]')) {
    button.addEventListener('click', async () => {
      if (document.documentElement.dataset.region !== 'open') return;
      button.disabled = true;
      try {
        const user = await currentUser(); ownUid = user.uid;
        await setDoc(doc(ratings, user.uid), { uid: user.uid, value: button.dataset.rating, updatedAt: serverTimestamp() });
        await loadRatings();
      } catch { status.textContent = ui.serviceError; }
      finally { button.disabled = false; }
    });
  }

  document.querySelector<HTMLFormElement>('#comment-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (document.documentElement.dataset.region !== 'open') return;
    const form = event.currentTarget as HTMLFormElement;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea')!;
    const text = textarea.value.trim();
    if (text.length < 2 || text.length > 1000) return;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true; status.textContent = ui.loading;
    try {
      const user = await currentUser(); ownUid = user.uid;
      const author = doc(db, 'wallpapers', wallpaperId, 'commentAuthors', user.uid);
      const last = await getDoc(author);
      if (last.exists() && last.data().lastAt?.toMillis?.() > Date.now() - 86400000) { status.textContent = ui.commentWait; return; }
      const comment = doc(comments);
      const batch = writeBatch(db);
      batch.set(comment, { uid: user.uid, text, createdAt: serverTimestamp() });
      batch.set(author, { uid: user.uid, lastCommentId: comment.id, lastAt: serverTimestamp() });
      await batch.commit();
      textarea.value = ''; status.textContent = '';
      await loadComments();
    } catch { status.textContent = ui.serviceError; }
    finally { submit.disabled = false; }
  });

  function loadSocial() { void loadRatings().catch(() => { status.textContent = ui.serviceError; }); void loadComments().catch(() => { list.textContent = ui.serviceError; }); }
  if (document.documentElement.dataset.region === 'open') loadSocial();
  else window.addEventListener('want:region', ((event: CustomEvent<{ allowed: boolean }>) => { if (event.detail.allowed) loadSocial(); }) as EventListener, { once: true });
}

import type { Locale } from '@/data/catalog';

export function initFeedbackDialog(locale: Locale) {
  let launcher: Promise<ReturnType<typeof import('../components/FeedbackDialog').mountFeedback>> | undefined;
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.target || anchor.download) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('/feedback/')) return;
    event.preventDefault();
    launcher ??= import('../components/FeedbackDialog').then(({ mountFeedback }) => mountFeedback(locale));
    void launcher.then((open) => open(anchor)).catch(() => { location.assign(anchor.href); });
  });
}

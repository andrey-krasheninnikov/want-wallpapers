import { analyticsId, analyticsMetadata, analyticsPage, type AnalyticsEvents, type AnalyticsEventName, type Placement } from './analytics-events';
import { currentAnalyticsContext, getCookiePreferences, initializePrivacy, isAnalyticsConfigured, sendAnalyticsEvent } from './privacy';

export function trackProductEvent<Name extends AnalyticsEventName>(name: Name, parameters: AnalyticsEvents[Name]): void {
  sendAnalyticsEvent(name, parameters);
}

export function analyticsPlacement(element: Element): Placement {
  if (element.closest('[data-scene-wallpaper]')) return 'scene';
  if (element.closest('.hero')) return 'hero';
  if (element.closest('[data-home-mosaic]')) return 'home_mosaic';
  if (element.closest('[data-story-carousel]')) return 'story_carousel';
  if (element.closest('[data-collection-carousel]')) return 'collection_carousel';
  if (element.closest('[data-analytics-list="search"]')) return 'search';
  if (currentAnalyticsContext().page_type === 'wallpapers' && element.closest('.gallery-grid')) return 'related';
  if (element.closest('header')) return 'header';
  if (element.closest('footer')) return 'footer';
  if (element.closest('[data-wallpaper-detail]')) return 'detail';
  return currentAnalyticsContext().page_type === 'collections' ? 'collection' : 'content';
}

function cardParameters(element: HTMLElement): AnalyticsEvents['card_view'] | undefined {
  if (element.closest('[aria-hidden="true"], [inert]')) return;
  const story = element.querySelector<HTMLElement>('[data-story]')?.dataset.story;
  let id = element.dataset.wallpaperCard ?? story ?? element.dataset.collectionCard;
  if (id?.includes('/')) id = id.split('/').filter(Boolean).at(-1);
  if (!analyticsId(id)) return;
  const list = element.closest('.gallery-grid, .collection-grid, [data-analytics-list], .collection-track, [data-home-mosaic]') ?? element.parentElement!;
  return { item_id: id, ...(!element.dataset.wallpaperCard ? { collection_id: id } : {}), content_type: element.dataset.wallpaperCard ? 'wallpaper' : story ? 'story' : 'collection',
    placement: analyticsPlacement(element), position: [...list.querySelectorAll('[data-wallpaper-card], [data-collection-card]')].indexOf(element) + 1,
    ...analyticsMetadata(element.dataset.ga) };
}

let initialContext: ReturnType<typeof currentAnalyticsContext> | undefined;
let vitalsStarted = false, vitalsLoading = false;

export function initProductAnalytics(): () => void {
  if (/^\/(?:admin|ui-kit)(?:\/|$)/.test(location.pathname)) return () => {};
  initialContext ??= currentAnalyticsContext();
  let active = true, sentView = false;
  const enabled = () => active && isAnalyticsConfigured() && getCookiePreferences().analytics;
  const controller = new AbortController();
  const options = { signal: controller.signal, capture: true };
  const pending = new Map<Element, ReturnType<typeof setTimeout>>();
  const observed = new Set<Element>();
  const seen = new WeakMap<Element, { signature: string; ids: Set<string> }>();
  const sections = new Set<string>();
  const selector = '[data-wallpaper-card], [data-collection-card], main h2';
  function cancel() { for (const timer of pending.values()) clearTimeout(timer); pending.clear(); }
  function impression(element: HTMLElement) {
    if (!enabled() || document.hidden || !element.isConnected) return;
    const card = cardParameters(element);
    if (card) {
      const list = element.closest('.gallery-grid, .collection-grid, [data-analytics-list], .collection-track, [data-home-mosaic]') ?? element.parentElement!;
      const signature = [...list.querySelectorAll<HTMLElement>('[data-wallpaper-card], [data-collection-card]')]
        .filter(item => !item.closest('[aria-hidden="true"], [inert]')).map(item => item.dataset.wallpaperCard ?? item.dataset.collectionCard).join(',');
      let state = seen.get(list);
      if (state?.signature !== signature) { state = { signature, ids: new Set() }; seen.set(list, state); }
      const key = card.content_type + ':' + card.item_id;
      if (!state!.ids.has(key)) { state!.ids.add(key); trackProductEvent('card_view', card); }
    } else if (element.matches('main h2')) {
      const name = element.closest<HTMLElement>('[data-analytics-section]')?.dataset.analyticsSection
        ?? (analyticsId(element.id) ? element.id : `section-${[...document.querySelectorAll('main h2')].indexOf(element) + 1}`);
      if (!sections.has(name)) { sections.add(name); trackProductEvent('section_view', { section: name }); }
    }
  }
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
    for (const entry of entries) {
      const old = pending.get(entry.target); if (old) clearTimeout(old); pending.delete(entry.target);
      if (entry.intersectionRatio < .5 || document.hidden || !enabled()) continue;
      pending.set(entry.target, setTimeout(() => { pending.delete(entry.target); impression(entry.target as HTMLElement); }, 1000));
    }
  }, { threshold: [.5] });
  function scan() {
    for (const element of observed) if (!element.isConnected) { observer?.unobserve(element); observed.delete(element); clearTimeout(pending.get(element)); pending.delete(element); }
    for (const element of document.querySelectorAll(selector)) if (!observed.has(element)) { observed.add(element); observer?.observe(element); }
  }
  const mutation = new MutationObserver(records => {
    if (!records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes]
      .some(node => node instanceof Element && (node.matches(selector) || node.querySelector(selector))))) return;
    cancel(); observer?.disconnect(); observed.clear(); scan();
  });
  mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wallpaper-card', 'data-collection-card'] });
  function update() {
    cancel(); observer?.disconnect(); observed.clear();
    if (!enabled()) return;
    if (!sentView) {
      sentView = true; trackProductEvent('page_view', {});
      if (currentAnalyticsContext().page_type === 'feedback') trackProductEvent('feedback_action', { stage: 'open' });
      const detail = document.querySelector<HTMLElement>('[data-wallpaper-detail]');
      if (analyticsId(detail?.dataset.wallpaperDetail)) trackProductEvent('wallpaper_view', { item_id: detail.dataset.wallpaperDetail });
    }
    scan();
    if (!vitalsStarted && !vitalsLoading) {
      vitalsLoading = true;
      void import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
        if (!enabled()) return;
        vitalsStarted = true;
        const report = ({ name, value, rating }: import('web-vitals').Metric) => {
          if (getCookiePreferences().analytics) sendAnalyticsEvent('web_vital', { metric_name: name, metric_value: value, rating }, initialContext);
        };
        onLCP(report); onINP(report); onCLS(report);
      }).catch(() => { /* Product actions remain available without optional metrics. */ }).finally(() => { vitalsLoading = false; });
    }
  }
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!enabled() || !target || target.closest('[disabled], [inert]')) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (anchor) {
      const card = anchor.closest<HTMLElement>('[data-wallpaper-card], [data-collection-card]');
      const parameters = card && cardParameters(card);
      if (parameters) trackProductEvent('content_select', parameters);
      const url = new URL(anchor.href);
      const placement = analyticsPlacement(anchor);
      if (url.hostname === 't.me') {
        const destinations: Record<string, 'channel' | 'author' | 'foundation' | 'emoji'> = { '/want_wallpapers': 'channel', '/andrey_krasheninnikov': 'author', '/want_foundation': 'foundation', '/addemoji/want_wallpapers': 'emoji' };
        const destination = destinations[url.pathname.replace(/\/$/, '')];
        if (destination) trackProductEvent('telegram_click', { destination, placement });
      } else if (url.hostname === 'github.com') trackProductEvent('outbound_click', { destination: 'github', placement });
      else if (url.protocol === 'mailto:') trackProductEvent('outbound_click', { destination: 'email', placement });
      if (url.origin === location.origin) trackProductEvent('navigation_click', { target_page: analyticsPage(url.pathname).type, placement });
      if (url.origin === location.origin && url.pathname.endsWith('/feedback/')) trackProductEvent('feedback_action', { stage: 'open' });
    }
    const faq = target.closest<HTMLElement>('[data-slot="accordion-trigger"]');
    if (faq) trackProductEvent('feature_action', { feature: 'faq', action: faq.getAttribute('aria-expanded') === 'true' ? 'close' : 'open', item_id: `faq-${faq.dataset.analyticsFaq ?? '0'}` });
    const cover = target.closest<HTMLElement>('[data-cover-control]');
    if (cover) trackProductEvent('feature_action', { feature: 'cover', action: cover.dataset.playing === 'true' ? 'pause' : 'play' });
    const background = target.closest<HTMLElement>('[data-background-toggle]');
    if (background) trackProductEvent('feature_action', { feature: 'background', action: document.documentElement.dataset.backgroundMotion === 'running' ? 'pause' : 'play' });
  }, options);
  const invalidForms = new WeakSet<HTMLFormElement>();
  document.addEventListener('invalid', event => {
    if (!enabled() || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
    const form = event.target.form;
    if (!form || invalidForms.has(form)) return;
    invalidForms.add(form); queueMicrotask(() => invalidForms.delete(form));
    if (form.closest('.feedback-form')) trackProductEvent('feedback_action', { stage: 'error', error_code: 'validation' });
    else {
      const item = form.closest<HTMLElement>('[data-wallpaper-detail]')?.dataset.wallpaperDetail;
      if (analyticsId(item)) trackProductEvent('comment_action', { item_id: item, action: 'submit', stage: 'error', error_code: 'validation' });
    }
  }, options);
  document.addEventListener('error', event => {
    if (!enabled()) return;
    if (event.target instanceof HTMLImageElement) trackProductEvent('media_error', { media: 'image' });
    else if (event.target instanceof HTMLVideoElement && event.target.hasAttribute('data-cover-video')) trackProductEvent('media_error', { media: 'cover' });
  }, options);
    window.addEventListener('want:privacy', update, { signal: controller.signal });
  document.addEventListener('visibilitychange', update, { signal: controller.signal });
  update();
  void initializePrivacy().then(() => { if (active) update(); });
  return () => { active = false; controller.abort(); cancel(); mutation.disconnect(); observer?.disconnect(); };
}

export function analyticsFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'request_failed';
  if (['invalid-input', 'Invalid feedback', 'Invalid comment', 'Invalid rating'].includes(error.message)) return 'validation';
  if (['recaptcha-rejected', 'recaptcha-required', 'recaptcha-unavailable'].includes(error.message)) return 'captcha';
  if (['rate-limited', 'comment-cooldown'].includes(error.message)) return 'rate_limited';
  if (['unauthorized', 'forbidden'].includes(error.message)) return 'unauthorized';
  return error.message === 'unavailable' ? 'unavailable' : 'request_failed';
}

import { analyticsId, analyticsMetadata, analyticsContext, sanitizeAnalyticsEvent, type AnalyticsEventName, type AnalyticsEvents, type AnalyticsParameters } from './analytics-events';
import type { Analytics } from 'firebase/analytics';
import { effectiveCookiePreferences, getCountryGroup, normalizeCountry, parseCookiePreferences, type CookiePreferences } from './privacy-policy';
export type { CookiePreferences } from './privacy-policy';

const cookieKey = 'want-cookie-preferences-v2';
const legacyKey = 'want-cookie-choice-v1';
const countryKey = 'want-country-v1';
let preferences: CookiePreferences | null | undefined;
let country: string | null = null;
let initialization: Promise<void> | undefined;
let analyticsLoading: Promise<void> | undefined;
let analytics: Analytics | undefined;
let analyticsReady = false;
let analyticsEpoch = 0;
let lastPageLocation: string | undefined;
let pageReferrer: string | undefined;
let analyticsSdk: typeof import('firebase/analytics') | undefined;
const queuedEvents: Array<{ name: AnalyticsEventName; parameters: AnalyticsParameters; expires: number }> = [];
let pendingConsent: ReturnType<typeof consent> | undefined;

export function isAnalyticsConfigured(): boolean {
  return [import.meta.env.PUBLIC_FIREBASE_API_KEY, import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    import.meta.env.PUBLIC_FIREBASE_APP_ID, import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID]
    .every((value) => typeof value === 'string' && value.trim().length > 0);
}

export function readCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  if (preferences !== undefined) return preferences;
  try {
    const stored = localStorage.getItem(cookieKey);
    preferences = parseCookiePreferences(stored, localStorage.getItem(legacyKey));
    if (stored === null && preferences) persistPreferences(preferences);
  } catch { preferences = { analytics: false, advertising: false }; }
  return preferences;
}

function persistPreferences(value: CookiePreferences) {
  try { localStorage.setItem(cookieKey, JSON.stringify(value)); } catch { /* Keep the choice active in this page. */ }
}

export function getCountry(): string | null { return country; }
export function getCookiePreferences(): CookiePreferences {
  return effectiveCookiePreferences(readCookiePreferences(), country);
}

async function lookupCountry(): Promise<string | null> {
  try {
    const cached = normalizeCountry({ success: true, country_code: sessionStorage.getItem(countryKey) });
    if (cached) return cached;
  } catch { /* Continue without storage. */ }
  try {
    const response = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) return null;
    const result = normalizeCountry(await response.json());
    if (result) {
      try { sessionStorage.setItem(countryKey, result); } catch { /* Storage is optional. */ }
    }
    return result;
  } catch { return null; }
}

function consent() {
  const value = getCookiePreferences();
  return {
    analytics_storage: value.analytics ? 'granted' as const : 'denied' as const,
    ad_storage: value.advertising ? 'granted' as const : 'denied' as const,
    ad_user_data: value.advertising ? 'granted' as const : 'denied' as const,
    ad_personalization: value.advertising ? 'granted' as const : 'denied' as const,
  };
}

export function currentAnalyticsContext(): AnalyticsParameters {
  const data = document.body?.dataset;
  const canonical = document.querySelector?.<HTMLLinkElement>('link[rel="canonical"]')?.href;
  let path = '/404/';
  try { if (canonical) path = new URL(canonical).pathname; } catch { /* Invalid metadata stays anonymous. */ }
  const context = analyticsContext(path, data?.locale ?? 'en', window.location.origin ?? '', document.referrer ?? '');
  const detail = document.querySelector?.<HTMLElement>('[data-wallpaper-detail]');
  if (analyticsId(detail?.dataset.wallpaperDetail)) context.item_id = detail.dataset.wallpaperDetail;
  if (detail) {
    // Reuse semantic page metadata instead of repeating it in hydrated props and HTML.
    try {
      const schema = JSON.parse(document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')?.textContent ?? 'null');
      const collection = new URL(schema.isPartOf.url).pathname.split('/').filter(Boolean).at(-1);
      const category = new URL(detail.querySelector<HTMLAnchorElement>('.wallpaper-tag-link')!.href).searchParams.get('category');
      Object.assign(context, analyticsMetadata(`${collection}/${category}`));
    } catch { /* Incomplete page metadata never blocks an action. */ }
  }
  if (pageReferrer !== undefined) context.page_referrer = pageReferrer;
  try { if (localStorage.getItem('want-analytics-debug') === 'true') context.debug_mode = 1; } catch { /* Diagnostics are optional. */ }
  return context;
}

function flushAnalytics() {
  if (!analytics || !analyticsSdk || !analyticsReady) return;
  while (queuedEvents.length) {
    const event = queuedEvents.shift()!;
    if (!getCookiePreferences().analytics) { queuedEvents.length = 0; return; }
    if (event.expires > Date.now()) {
      try { const name: string = event.name; analyticsSdk.logEvent(analytics, name, event.parameters); } catch { /* Analytics never interrupts an action. */ }
    }
  }
}

export function sendAnalyticsEvent(name: AnalyticsEventName, parameters: unknown, context?: AnalyticsParameters): void {
  if (typeof window === 'undefined' || /^\/(?:admin|ui-kit)(?:\/|$)/.test(window.location.pathname)
    || !isAnalyticsConfigured() || !getCookiePreferences().analytics) return;
  const safe = sanitizeAnalyticsEvent(name, parameters);
  if (!safe) return;
  if (queuedEvents.length === 50) queuedEvents.shift();
  const resolved = { ...(context ?? currentAnalyticsContext()) };
  if (name === 'page_view') {
    pageReferrer = lastPageLocation ?? String(resolved.page_referrer ?? '');
    lastPageLocation = String(resolved.page_location);
    resolved.page_referrer = pageReferrer;
  }
  const counter = ({ card_view: 'card_impressions', content_select: 'card_selections', wallpaper_view: 'wallpaper_views', wallpaper_download: 'download_starts', telegram_click: 'telegram_transitions' } as Partial<Record<AnalyticsEventName, string>>)[name];
  queuedEvents.push({ name, parameters: { ...resolved, ...safe, ...(counter ? { [counter]: 1 } : {}) }, expires: Date.now() + 30000 });
  updateAnalytics();
  flushAnalytics();
}

export function captureProductEvents() {
  const epoch = analyticsEpoch;
  const context = typeof window !== 'undefined' && getCookiePreferences().analytics ? currentAnalyticsContext() : null;
  return <Name extends AnalyticsEventName>(name: Name, parameters: AnalyticsEvents[Name]): void => {
    if (context && epoch === analyticsEpoch) sendAnalyticsEvent(name, parameters, context);
  };
}

function discardAnalyticsEvents() {
  analyticsEpoch++; queuedEvents.length = 0; lastPageLocation = undefined; pageReferrer = undefined;
}

function updateAnalytics(): void {
  if (!getCookiePreferences().analytics) discardAnalyticsEvents();
  if (isAnalyticsConfigured()) Reflect.set(window, `ga-disable-${import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID}`, !getCookiePreferences().analytics);
  // Firebase retains this object until asynchronous initialization emits consent defaults.
  if (pendingConsent) Object.assign(pendingConsent, consent());
  if (analytics && analyticsSdk) {
    analyticsSdk.setConsent(consent());
    analyticsSdk.setAnalyticsCollectionEnabled(analytics, getCookiePreferences().analytics);
    return;
  }
  if (!getCookiePreferences().analytics || !isAnalyticsConfigured() || analyticsLoading) return;
  analyticsLoading = (async () => {
    const sdk = await import('firebase/analytics');
    if (!getCookiePreferences().analytics || !await sdk.isSupported() || !getCookiePreferences().analytics) return;
    const { app } = await import('./analytics-client');
    if (!getCookiePreferences().analytics) return;
    pendingConsent = consent();
    sdk.setConsent(pendingConsent);
    analytics = sdk.initializeAnalytics(app, { config: { ...currentAnalyticsContext(), send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false } });
    analyticsSdk = sdk;
    sdk.setAnalyticsCollectionEnabled(analytics, getCookiePreferences().analytics);
    await sdk.getGoogleAnalyticsClientId(analytics);
    analyticsReady = true;
    flushAnalytics();
  })().catch(() => { /* Optional analytics never block site features. */ }).finally(() => { analyticsLoading = undefined; });
}

function notify() {
  window.dispatchEvent(new CustomEvent('want:privacy', { detail: { preferences: getCookiePreferences(), country, countryGroup: getCountryGroup(country) } }));
}

export function saveCookiePreferences(value: CookiePreferences) {
  preferences = { ...value };
  persistPreferences(preferences);
  updateAnalytics();
  notify();
}

export function initializePrivacy(): Promise<void> {
  if (typeof window === 'undefined' || /^\/(?:admin|ui-kit)(?:\/|$)/.test(window.location.pathname)) return Promise.resolve();
  if (initialization) return initialization;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== cookieKey && event.key !== legacyKey) return;
    const previousChoice = event.key === cookieKey ? parseCookiePreferences(event.newValue, null)
      : event.key === legacyKey ? parseCookiePreferences(null, event.newValue) : null;
    if (previousChoice?.analytics === false) discardAnalyticsEvents();
    preferences = undefined;
    updateAnalytics();
    notify();
  });
  window.addEventListener('want:download', ((event: CustomEvent<{ wallpaper: string; variant: string }>) => {
    sendAnalyticsEvent('wallpaper_download', event.detail);
  }) as EventListener);
  updateAnalytics();
  return initialization = lookupCountry().then((result) => {
    country = result;
    document.documentElement.dataset.country = country ?? 'unknown';
    document.documentElement.dataset.countryGroup = getCountryGroup(country);
    updateAnalytics();
    notify();
  });
}

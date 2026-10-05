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
let analyticsSdk: typeof import('firebase/analytics') | undefined;
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

function updateAnalytics(): void {
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
    analytics = sdk.getAnalytics(app);
    analyticsSdk = sdk;
    sdk.setAnalyticsCollectionEnabled(analytics, getCookiePreferences().analytics);
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
  if (typeof window === 'undefined' || /^\/admin(?:\/|$)/.test(window.location.pathname)) return Promise.resolve();
  if (initialization) return initialization;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== cookieKey && event.key !== legacyKey) return;
    preferences = undefined;
    updateAnalytics();
    notify();
  });
  window.addEventListener('want:download', ((event: CustomEvent<{ wallpaper: string; variant: string }>) => {
    if (analytics && analyticsSdk && getCookiePreferences().analytics) analyticsSdk.logEvent(analytics, 'wallpaper_download', event.detail);
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

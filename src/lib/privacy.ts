export type CookieChoice = 'essential' | 'analytics';
export type Region = 'pending' | 'open' | 'restricted';
const cookieKey = 'want-cookie-choice-v1';
const regionKey = 'want-region-v1';
let choice: CookieChoice | null | undefined;
let regionCheck: Promise<void> | undefined;
let analyticsStarted = false;
let disableAnalytics: (() => void) | undefined;

export function readCookieChoice(): CookieChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(cookieKey);
    choice = value === 'essential' || value === 'analytics' ? value : null;
  } catch { choice ??= null; }
  return choice;
}

export function getRegion(): Region {
  if (typeof document === 'undefined') return 'pending';
  const value = document.documentElement.dataset.region;
  return value === 'open' || value === 'restricted' ? value : 'pending';
}

async function regionAllowed(): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(regionKey);
    if (cached === 'open' || cached === 'restricted') return cached === 'open';
  } catch { /* Continue with a fresh lookup. */ }
  try {
    const response = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) throw new Error('Region lookup failed');
    const result = await response.json() as { success?: boolean; country_code?: string };
    if (result.success !== true || !result.country_code) throw new Error('Region lookup incomplete');
    const allowed = result.country_code.toUpperCase() !== 'RU';
    try { sessionStorage.setItem(regionKey, allowed ? 'open' : 'restricted'); } catch { /* Storage is optional. */ }
    return allowed;
  } catch { return false; }
}

async function startAnalytics() {
  if (analyticsStarted || readCookieChoice() !== 'analytics' || getRegion() !== 'open' || !import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID) return;
  try {
    const [{ app }, { getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled }] = await Promise.all([
      import('./firebase-client'), import('firebase/analytics'),
    ]);
    if (!await isSupported() || analyticsStarted || readCookieChoice() !== 'analytics' || getRegion() !== 'open') return;
    const analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    disableAnalytics = () => setAnalyticsCollectionEnabled(analytics, false);
    analyticsStarted = true;
    window.addEventListener('want:download', ((event: CustomEvent<{ wallpaper: string; variant: string }>) => {
      if (readCookieChoice() === 'analytics' && getRegion() === 'open') logEvent(analytics, 'wallpaper_download', event.detail);
    }) as EventListener);
  } catch { /* Browsing and downloads stay available. */ }
}

export function saveCookieChoice(value: CookieChoice) {
  choice = value;
  try { localStorage.setItem(cookieKey, value); } catch { /* The choice remains active for this page. */ }
  window.dispatchEvent(new CustomEvent('want:cookie-choice', { detail: { choice: value } }));
  if (value === 'analytics') {
    if (analyticsStarted) void import('firebase/analytics').then(async ({ getAnalytics, setAnalyticsCollectionEnabled }) => {
      const { app } = await import('./firebase-client');
      if (readCookieChoice() === 'analytics' && getRegion() === 'open') setAnalyticsCollectionEnabled(getAnalytics(app), true);
    }).catch(() => {});
    else void startAnalytics();
  } else disableAnalytics?.();
}

export function initializePrivacy() {
  if (typeof window === 'undefined') return Promise.resolve();
  return regionCheck ??= regionAllowed().then((allowed) => {
    document.documentElement.dataset.region = allowed ? 'open' : 'restricted';
    window.dispatchEvent(new CustomEvent('want:region', { detail: { allowed } }));
    if (allowed) void startAnalytics();
  });
}

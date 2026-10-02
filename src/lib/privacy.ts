const cookieKey = 'want-cookie-choice-v1';
const regionKey = 'want-region-v1';
type Choice = 'essential' | 'analytics';
let analyticsStarted = false;
let disableAnalytics: (() => void) | undefined;

function readChoice(): Choice | null {
  try {
    const value = localStorage.getItem(cookieKey);
    return value === 'essential' || value === 'analytics' ? value : null;
  } catch { return null; }
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
  if (analyticsStarted || readChoice() !== 'analytics' || document.documentElement.dataset.region !== 'open') return;
  if (!import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID) return;
  try {
    const [{ app }, { getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled }] = await Promise.all([
      import('./firebase-client'), import('firebase/analytics'),
    ]);
    if (readChoice() !== 'analytics' || document.documentElement.dataset.region !== 'open') return;
    if (!await isSupported() || readChoice() !== 'analytics' || document.documentElement.dataset.region !== 'open') return;
    const analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    disableAnalytics = () => setAnalyticsCollectionEnabled(analytics, false);
    analyticsStarted = true;
    window.addEventListener('want:download', ((event: CustomEvent<{ wallpaper: string; variant: string }>) => {
      logEvent(analytics, 'wallpaper_download', event.detail);
    }) as EventListener);
  } catch { /* Browsing and downloads stay available. */ }
}

const banner = document.querySelector<HTMLElement>('#cookie-banner');
if (banner && !readChoice()) banner.hidden = false;
document.querySelector('#cookie-settings')?.addEventListener('click', () => { if (banner) banner.hidden = false; });
for (const [id, choice] of [['#cookie-essential', 'essential'], ['#cookie-analytics', 'analytics']] as const) {
  document.querySelector(id)?.addEventListener('click', () => {
    try { localStorage.setItem(cookieKey, choice); } catch { /* Choice applies to this page only. */ }
    if (banner) banner.hidden = true;
    if (choice === 'analytics') void startAnalytics();
    else if (analyticsStarted) {
      disableAnalytics?.();
      window.location.reload();
    }
  });
}

void regionAllowed().then((allowed) => {
  document.documentElement.dataset.region = allowed ? 'open' : 'restricted';
  window.dispatchEvent(new CustomEvent('want:region', { detail: { allowed } }));
  if (allowed) void startAnalytics();
});

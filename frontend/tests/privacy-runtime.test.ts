import { afterAll, expect, mock, test } from 'bun:test';

const keys = ['PUBLIC_FIREBASE_API_KEY', 'PUBLIC_FIREBASE_PROJECT_ID', 'PUBLIC_FIREBASE_APP_ID', 'PUBLIC_FIREBASE_MEASUREMENT_ID'];
const environment = keys.map((key) => process.env[key]);
const globals = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch'] as const;
const descriptors = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
let initialized = 0;
let enabled = false;
let events: string[] = [];
let permissions: Record<string, string> = {};
let supported: () => Promise<boolean> = async () => true;
let pendingCollection: Array<() => void> | null = null;
let ready: Promise<void>;
let markReady: () => void;
let serial = 0;

mock.module('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
mock.module('firebase/analytics', () => ({
  isSupported: () => supported(),
  getAnalytics: () => { initialized++; markReady(); return {}; },
  setConsent: (value: Record<string, string>) => { permissions = value; },
  setAnalyticsCollectionEnabled: (_analytics: unknown, value: boolean) => {
    if (pendingCollection) pendingCollection.push(() => { enabled = value; });
    else enabled = value;
  },
  logEvent: (_analytics: unknown, name: string) => { if (enabled) events.push(name); },
}));

async function browser(response: unknown, stored?: string, pathname = '/') {
  initialized = 0; enabled = false; events = []; permissions = {}; pendingCollection = null;
  supported = async () => true;
  ready = new Promise((resolve) => { markReady = resolve; });
  for (const key of keys) process.env[key] = 'test-public-setting';
  const local = new Map<string, string>();
  if (stored) local.set('want-cookie-preferences-v2', stored);
  const session = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
  const target = Object.assign(new EventTarget(), { location: { pathname } });
  let lookups = 0;
  const values = {
    window: target, document: { documentElement: { dataset: {} } },
    localStorage: storage(local), sessionStorage: storage(session),
    fetch: async () => { lookups++; return new Response(JSON.stringify(response)); },
  };
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: values[key] });
  const privacy: typeof import('../src/lib/privacy') = await import(`../src/lib/privacy.ts?case=${++serial}`);
  return { privacy, target, local, session, lookups: () => lookups };
}

afterAll(() => {
  mock.restore();
  globals.forEach((key, index) => {
    const descriptor = descriptors[index];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  });
  keys.forEach((key, index) => {
    const value = environment[index];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  });
});

test('EEA and unknown visitors can opt into analytics independently and withdraw immediately', async () => {
  for (const country of ['DE', null]) {
    const { privacy, target } = await browser({ success: country !== null, country_code: country });
    await privacy.initializePrivacy();
    expect(initialized).toBe(0);
    privacy.saveCookiePreferences({ analytics: true, advertising: false });
    await ready;
    expect(permissions).toEqual({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    target.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: 'test', variant: 'desktop' } }));
    expect(events).toEqual(['wallpaper_download']);
    privacy.saveCookiePreferences({ analytics: false, advertising: true });
    target.dispatchEvent(new CustomEvent('want:download'));
    expect(enabled).toBe(false);
    expect(permissions.analytics_storage).toBe('denied');
    expect(permissions.ad_storage).toBe('granted');
    expect(events).toEqual(['wallpaper_download']);
  }
});

test('outside-EEA defaults start configured analytics but never override a saved refusal', async () => {
  for (const country of ['RU', 'KZ', 'BY', 'GE']) {
    const { privacy } = await browser({ success: true, country_code: country });
    await privacy.initializePrivacy();
    await ready;
    expect(enabled).toBe(true);
    expect(privacy.readCookiePreferences()).toBeNull();
    const declined = await browser({ success: true, country_code: country }, '{"analytics":false,"advertising":false}');
    await declined.privacy.initializePrivacy();
    expect(initialized).toBe(0);
  }
});

test('withdrawal while the SDK is loading prevents analytics initialization', async () => {
  const { privacy } = await browser({ success: true, country_code: 'DE' });
  await privacy.initializePrivacy();
  let resolveSupport!: (value: boolean) => void;
  let markSupport!: () => void;
  const checking = new Promise<void>((resolve) => { markSupport = resolve; });
  supported = () => { markSupport(); return new Promise((resolve) => { resolveSupport = resolve; }); };
  privacy.saveCookiePreferences({ analytics: true, advertising: false });
  await checking;
  privacy.saveCookiePreferences({ analytics: false, advertising: false });
  resolveSupport(true);
  await Bun.sleep(0);
  expect(initialized).toBe(0);
});

test('a storage event withdraws collection in another open tab', async () => {
  const { privacy, target, local } = await browser({ success: true, country_code: 'GE' });
  await privacy.initializePrivacy(); await ready;
  local.set('want-cookie-preferences-v2', '{"analytics":false,"advertising":false}');
  target.dispatchEvent(Object.assign(new Event('storage'), { key: 'want-cookie-preferences-v2' }));
  expect(enabled).toBe(false);
  expect(privacy.getCookiePreferences()).toEqual({ analytics: false, advertising: false });
});

test('withdrawal disables collection before pending Firebase initialization completes', async () => {
  const { privacy, target } = await browser({ success: true, country_code: 'DE' });
  await privacy.initializePrivacy();
  pendingCollection = [];
  privacy.saveCookiePreferences({ analytics: true, advertising: true });
  await ready;
  const pendingDefault = permissions;
  privacy.saveCookiePreferences({ analytics: false, advertising: false });
  expect(Reflect.get(target, 'ga-disable-test-public-setting')).toBe(true);
  expect(pendingDefault).toEqual({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  for (const complete of pendingCollection) complete();
  expect(enabled).toBe(false);
});

test('incomplete analytics configuration does not start the SDK', async () => {
  for (const missing of keys) {
    const { privacy } = await browser({ success: true, country_code: 'GE' });
    delete process.env[missing];
    await privacy.initializePrivacy();
    expect(initialized).toBe(0);
  }
});

test('unavailable storage keeps a page-local refusal and a later explicit choice', async () => {
  const { privacy } = await browser({ success: true, country_code: 'RU' });
  delete process.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); },
  } });
  await privacy.initializePrivacy();
  expect(privacy.getCookiePreferences()).toEqual({ analytics: false, advertising: false });
  privacy.saveCookiePreferences({ analytics: false, advertising: true });
  expect(privacy.readCookiePreferences()).toEqual({ analytics: false, advertising: true });
});

test('private admin pages never perform country lookup or optional tracking', async () => {
  const { privacy, lookups } = await browser({ success: true, country_code: 'RU' }, '{"analytics":true,"advertising":true}', '/admin/login/');
  await privacy.initializePrivacy();
  expect(lookups()).toBe(0);
  expect(initialized).toBe(0);
});

test('failed lookup is unknown and never persisted as a permanent availability result', async () => {
  const { privacy, session } = await browser({ success: false });
  await privacy.initializePrivacy();
  expect(privacy.getCountry()).toBeNull();
  expect(session.size).toBe(0);
  expect(privacy.getCookiePreferences()).toEqual({ analytics: false, advertising: false });
});

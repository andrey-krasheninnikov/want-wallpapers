import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import * as sdk from 'firebase/analytics';

// Run separately from SDK mocks to check delayed initialization against the installed dependency.
let resolveConfig;
const config = new Promise((resolve) => { resolveConfig = resolve; });
let markInserted;
const inserted = new Promise((resolve) => { markInserted = resolve; });
const deadline = setTimeout(() => { throw new Error('Firebase initialization did not complete'); }, 5000);
const scripts = [];
globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { cookieEnabled: true } });
globalThis.document = {
  getElementsByTagName: () => scripts,
  createElement: () => ({}),
  head: { appendChild(script) { scripts.push(script); assert.equal(window['ga-disable-G-TEST'], true); markInserted(); } },
};
window.document = document;
globalThis.fetch = async () => {
  await config;
  return new Response(JSON.stringify({ appId: '1:111:web:test', measurementId: 'G-TEST' }));
};
const current = { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' };
const app = initializeApp({ apiKey: 'test-setting', projectId: 'test-project', appId: '1:111:web:test', measurementId: 'G-TEST' });
sdk.setConsent(current);
const analytics = sdk.getAnalytics(app);
sdk.setAnalyticsCollectionEnabled(analytics, true);
window['ga-disable-G-TEST'] = true;
Object.assign(current, Object.fromEntries(Object.keys(current).map((key) => [key, 'denied'])));
sdk.setConsent(current);
sdk.setAnalyticsCollectionEnabled(analytics, false);
assert.equal(window['ga-disable-G-TEST'], true);
resolveConfig();
await inserted;
await new Promise(setImmediate);
clearTimeout(deadline);
assert.equal(scripts.length, 1);
const defaults = window.dataLayer.map((item) => Array.from(item)).find((item) => item[0] === 'consent' && item[1] === 'default');
assert.deepEqual(defaults[2], current);
assert(Object.values(defaults[2]).every((value) => value === 'denied'));
assert.equal(window['ga-disable-G-TEST'], true);
console.log('Delayed Firebase initialization consent: passed');
// The SDK keeps a config-retry timer alive after this isolated check has completed.
process.exit(0);

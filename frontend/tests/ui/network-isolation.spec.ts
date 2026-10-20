import { test, expect } from '../browser';
import { hilltopAdvertisement } from '../../src/lib/advertising-providers';

test('advertising is mocked before the first navigation in every page', async ({ page, context }) => {
  const second = await context.newPage();
  for (const tab of [page, second]) {
    const response = await tab.goto(hilltopAdvertisement.src);
    expect(response?.status()).toBe(200);
    expect(await response?.text()).toBe('');
  }
  await second.close();
});

test('analytics requests are mocked in every page', async ({ page, context }) => {
  const second = await context.newPage();
  for (const tab of [page, second]) {
    const config = await tab.goto('https://firebase.googleapis.com/v1alpha/projects/-/apps/1:111:web:test/webConfig');
    expect(config?.status()).toBe(200);
    expect(await config?.json()).toEqual({ appId: '1:111:web:test', measurementId: process.env.PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-TEST' });
    const installations = await tab.goto('https://firebaseinstallations.googleapis.com/v1/projects/test-project/installations');
    expect((await installations?.json()).authToken.token).toBe('test-auth-token');
    const script = await tab.goto('https://www.googletagmanager.com/gtag/js?id=G-TEST');
    expect(script?.status()).toBe(200);
    expect(await script?.text()).toBe('');
    const status = await tab.evaluate(async () => (await fetch('https://www.google-analytics.com/g/collect', { method: 'POST', body: 'test' })).status);
    expect(status).toBe(204);
  }
  await second.close();
});

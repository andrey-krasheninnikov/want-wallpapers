import { test as base } from '@playwright/test';
import { hilltopAdvertisements, hilltopVideoAdvertisement } from '../src/lib/advertising-providers';

export { expect } from '@playwright/test';
export type { APIRequestContext, Locator, Page } from '@playwright/test';

export const test = base.extend({
  colorScheme: 'dark',
  context: async ({ context }, use) => {
    await context.route(hilltopVideoAdvertisement.src, route => route.fulfill({ contentType: 'application/xml', body: '<VAST version="3.0" />' }));
    for (const src of Object.values(hilltopAdvertisements)) {
      await context.route(src, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    }
    await context.route('https://firebase.googleapis.com/v1alpha/projects/-/apps/*/webConfig', route => route.fulfill({
      json: { appId: decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2)!),
        measurementId: process.env.PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-TEST' },
    }));
    await context.route('https://firebaseinstallations.googleapis.com/**', route => route.fulfill({
      json: { fid: 'cAAAAAAAAAAAAAAAAAAAAA', refreshToken: 'test-refresh-token',
        authToken: { token: 'test-auth-token', expiresIn: '3600s' } },
    }));
    await context.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await context.route(/^https:\/\/(?:[^/.]+\.)?google-analytics\.com\//, route => route.fulfill({ status: 204 }));
    await use(context);
  },
});

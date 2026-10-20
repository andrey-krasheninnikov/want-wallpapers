import { test as base } from '@playwright/test';
import { hilltopAdvertisement } from '../src/lib/advertising-providers';

export { expect } from '@playwright/test';
export type { APIRequestContext, Locator, Page } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(hilltopAdvertisement.src, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await use(context);
  },
});

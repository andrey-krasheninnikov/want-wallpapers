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

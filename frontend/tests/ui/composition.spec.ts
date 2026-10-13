import { test, expect } from '@playwright/test';
import { localPath } from '../../src/data/copy';
import type { Locale } from '../../src/data/catalog';

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) test(`supporting copy belongs to the reading composition: ${locale}`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  await page.setViewportSize({ width: 320, height: 900 });
  for (const path of ['/cookies/', '/contact/', '/terms/', '/license/']) {
    await page.goto(localPath(locale, path));
    await expect(page.locator('article [data-support-text]')).toHaveCount(1);
    expect(await page.locator('article [data-support-text]').evaluate((element) => {
      const child = element.getBoundingClientRect(), parent = element.closest('article')!.getBoundingClientRect();
      return child.left >= parent.left && child.right <= parent.right && child.bottom <= parent.bottom;
    })).toBe(true);
    await expect(page.locator('footer a[href="https://t.me/want_wallpapers"]')).toHaveText('Telegram Channel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

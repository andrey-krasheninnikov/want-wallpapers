import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getCollection, getWallpaper, locales } from '../../src/data/catalog';
import { collectionStories } from '../../src/data/editorial';
import { localPath } from '../../src/data/copy';

const collection = getCollection('contours-of-silence')!;
const wallpaper = getWallpaper('contours-of-silence-12')!;
for (const locale of locales) {
  test(`localized content and unchanged compact gallery: ${locale}`, async ({ page }, testInfo) => {
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, title] of [[`/collections/${collection.slug}/`, collection.title[locale]], [`/wallpapers/${wallpaper.slug}/`, wallpaper.title[locale]]]) {
        await page.goto(localPath(locale, path!));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!);
        await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale);
        await expect(page.locator('[data-editorial]')).toContainText(collectionStories[collection.slug]![locale][0]!);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const card = page.locator('[data-wallpaper-card] [data-slot="card-content"]').first();
        await expect(card).toHaveCSS('padding-left', width < 640 ? '16px' : '20px');
        await expect(card).toHaveCSS('display', 'flex');
        await expect(page.locator('.wallpaper-card-title').first()).toHaveCSS('font-size', '16px');
        if (path!.startsWith('/wallpapers/')) {
          await expect(page.locator('[data-wallpaper-detail]')).toHaveCSS('display', 'grid');
          await expect(page.locator('.wallpaper-detail-frame')).toHaveCSS('padding-left', width < 640 ? '16px' : '24px');
          await expect(page.locator('.wallpaper-variant-trigger').first()).toHaveCSS('min-height', '48px');
          await expect(page.locator('.wallpaper-tag-link').first()).toHaveCSS('padding-top', '8px');
          const tag = page.locator('.wallpaper-tag-link').first();
          await tag.hover();
          await expect(tag).toHaveCSS('background-color', 'rgb(36, 35, 55)');
          await page.mouse.move(0, 0);
        }
        if (width === 320 || width === 1440) {
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        }
      }
      if (width === 320 || width === 1440) await testInfo.attach(`${locale}-${width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
  });
}

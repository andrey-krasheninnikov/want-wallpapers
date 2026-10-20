import { test, expect } from '../browser';
import { copy, localPath } from '../../src/data/copy';
import { designCopy } from '../../src/data/design-copy';
import { wallpapers as catalogue, publicationDates, type Locale } from '../../src/data/catalog';

import { newestWallpapers } from '../../src/lib/catalog-order';
const wallpapers = newestWallpapers(catalogue, publicationDates);
const first = wallpapers[0]!, last = wallpapers.at(-1)!;
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) test(`catalogue slider wraps, preserves variants and follows history: ${locale}`, async ({ page }) => {
  await page.goto(`${localPath(locale, `/wallpapers/${first.slug}/`)}?variant=mobile#wallpaper-view`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${first.slug}-mobile.webp`);
  await expect(page.locator('#wallpaper-view')).toBeFocused();
  await expect(page.locator('#wallpaper-view')).toHaveCSS('background-color', 'rgb(16, 16, 16)');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(`http://127.0.0.1:4322${localPath(locale, `/wallpapers/${last.slug}/`)}?variant=mobile`);
  await expect(page.locator('[data-wallpaper-detail]')).toHaveAttribute('data-wallpaper-detail', last.id);
  await expect(page.locator('h1')).toHaveText(last.title[locale]);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${last.slug}-mobile.webp`);
  await expect(page.locator('#download-link')).toHaveAttribute('href', `/downloads/${last.slug}-mobile.png`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://wallpapers.want.foundation${localPath(locale, `/wallpapers/${last.slug}/`)}`);
  await expect(page.locator('#wallpaper-view')).toBeFocused();
  await expect(page.locator('#wallpaper-view')).toHaveCSS('background-color', 'rgb(16, 16, 16)');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('h1')).toHaveText(first.title[locale]);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('tab', { name: copy[locale].desktop, exact: true }).click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${first.slug}-desktop.webp`);
  await page.locator('[data-wallpaper-next]').click();
  await expect(page.locator('h1')).toHaveText(wallpapers[1]!.title[locale]);
  await expect(page.locator('#download-link')).toHaveAttribute('href', `/downloads/${wallpapers[1]!.slug}-desktop.png`);
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(first.title[locale]);
  await expect(page.getByRole('tab', { name: copy[locale].desktop, exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.goForward();
  await expect(page.locator('h1')).toHaveText(wallpapers[1]!.title[locale]);
  const boundary = wallpapers.findIndex((item, index) => index > 0 && item.collection !== wallpapers[index - 1]!.collection);
  await page.goto(localPath(locale, `/wallpapers/${wallpapers[boundary - 1]!.slug}/`));
  await page.locator('[data-wallpaper-next]').click();
  await expect(page.locator('h1')).toHaveText(wallpapers[boundary]!.title[locale]);
  await expect(page.locator('[data-wallpaper-previous]')).toHaveAttribute('aria-label', `${designCopy[locale].previous}: ${wallpapers[boundary - 1]!.title[locale]}`);
  await expect(page.locator('details.original-preview')).toHaveCount(0);
});

test('slider leaves textarea and tab keyboard behavior local', async ({ page }) => {
  await page.goto('/ru/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.locator('#comment-text').fill('Комментарий перед переключением вкладки.');
  const before = page.url();
  await page.locator('#comment-text').press('ArrowRight');
  expect(page.url()).toBe(before);
  await page.getByRole('tab', { name: copy.ru.desktop, exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: copy.ru.mobile, exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).pathname).toBe('/ru/wallpapers/contours-of-silence-1/');
  await expect(page.locator('#comment-text')).toHaveValue('Комментарий перед переключением вкладки.');
});

test('native touch swipe changes wallpaper while vertical touch scroll stays on the page', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await page.goto(`/ru/wallpapers/${first.slug}/?variant=mobile#wallpaper-view`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  let box = (await page.locator('#wallpaper-view').boundingBox())!;
  const x = box.x + box.width * .75, y = box.y + box.height * .5;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 20, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('h1')).toHaveText(wallpapers[1]!.title.ru);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${wallpapers[1]!.slug}-mobile.webp`);
  box = (await page.locator('#wallpaper-view').boundingBox())!;
  const scroll = await page.evaluate(() => scrollY), url = page.url();
  const sx = box.x + box.width * .5, sy = box.y + box.height * .7;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - step * 15 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
  expect(page.url()).toBe(url);
});

test('invalid variant falls back and native slider links remain usable without JavaScript', async ({ page, browser }) => {
  await page.goto('/ru/wallpapers/contours-of-silence-1/?variant=unexpected');
  await expect(page.locator('#detail-image')).toHaveAttribute('src', '/previews/contours-of-silence-1-desktop.webp');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const native = await context.newPage();
  await native.goto(`http://127.0.0.1:4322/ru/wallpapers/${first.slug}/`);
  await native.locator('[data-wallpaper-previous]').click();
  await expect(native.locator('h1')).toHaveText(last.title.ru);
  await native.locator('[data-wallpaper-next]').click();
  await expect(native.locator('h1')).toHaveText(first.title.ru);
  await context.close();
});


test('slides update within the document and preserve the viewer position', async ({ page }) => {
  await page.goto(`/ru/wallpapers/${first.slug}/?variant=mobile#wallpaper-view`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => { document.body.dataset.documentMarker = 'unchanged'; });
  const before = await page.locator('#wallpaper-view').boundingBox();
  for (const direction of ['previous', 'next', 'previous'] as const) {
    const url = page.url();
    await page.locator(`[data-wallpaper-${direction}]`).click();
    await page.waitForURL(value => value.href !== url);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
    const after = (await page.locator('#wallpaper-view').boundingBox())!;
    expect(after.y).toBeCloseTo(before!.y, 0); expect(after.height).toBeCloseTo(before!.height, 0);
    await expect(page.locator('#detail-image')).toHaveAttribute('src', /-mobile.webp$/);
  }
});

test('page arrows work outside the viewer and preserve editing and open dialogs', async ({ page }) => {
  await page.goto(`/wallpapers/${first.slug}/`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.locator('h1').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('h1')).toHaveText(wallpapers[1]!.title.en);
  await page.getByRole('link', { name: copy.en.feedback, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = page.url();
  await page.keyboard.press('ArrowLeft');
  expect(page.url()).toBe(before);
  await page.keyboard.press('Escape');
});

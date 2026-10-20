import { test, expect } from '@playwright/test';
import { copy, languageFlags, languageLabels, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { locales } from '../../src/data/catalog';

const path = '/wallpapers/contours-of-silence-1/';
const socialData = { counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: '', ownUid: null, comments: [] };

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});

for (const locale of locales) test(`wallpaper composition, portrait fit and language flags: ${locale}`, async ({ page }, testInfo) => {
  let reads = 0;
  await page.route('**/api/v1/wallpapers/*/social', route => { reads++; return route.fulfill({ json: socialData }); });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    reads = 0;
    await page.goto(localPath(locale, path));
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.locator('#comment-text')).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const language = page.getByRole('combobox', { name: interfaceCopy[locale].language, exact: true });
    await expect(language).toContainText(languageFlags[locale]);
    await language.click();
    for (const value of locales) await expect(page.getByRole('option', { name: languageLabels[value], exact: true })).toContainText(languageFlags[value]);
    await page.keyboard.press('Escape');
    for (const variant of ['desktop', 'mobile'] as const) {
      await page.getByRole('tab', { name: copy[locale][variant], exact: true }).click();
      await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/contours-of-silence-1-${variant}.webp`);
      const viewer = page.locator('#wallpaper-view');
      await expect(viewer).toHaveCSS('background-color', 'rgb(16, 16, 16)');
      expect(await page.locator('.wallpaper-dock [role=tablist]').evaluate(list => {
        const bounds = list.getBoundingClientRect();
        return [...list.querySelectorAll('[role=tab]')].every(tab => { const box = tab.getBoundingClientRect(); return box.top >= bounds.top && box.bottom <= bounds.bottom; });
      })).toBe(true);
      const positions = await page.evaluate(() => {
        const box = (selector: string) => { const b = document.querySelector(selector)!.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
        return { viewer: box('#wallpaper-view'), stage: box('.wallpaper-stage'), controls: box('.wallpaper-dock'), downloads: box('#download-link'), ratings: box('[data-wallpaper-ratings]'), comments: box('[data-social-panel]') };
      });
      expect(positions.ratings.top).toBeGreaterThanOrEqual(positions.downloads.bottom);
      expect(positions.comments.top).toBeGreaterThanOrEqual(positions.stage.bottom);
      expect(await page.locator('[data-editorial]').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(positions.comments.bottom);
      if (width < 1024) expect(positions.controls.top).toBeGreaterThanOrEqual(positions.stage.bottom);
      else expect(positions.controls.left).toBeGreaterThan(positions.viewer.right);
      await expect(page.locator('#detail-image')).toHaveCSS('object-fit', 'contain');
      await expect(page.locator('.rating-tile').first()).toHaveCSS('min-height', '56px');
      await expect(page.locator('[data-editorial] .long-copy')).toHaveCSS('column-count', '3');
      await expect(page.locator('[data-editorial] .long-copy')).toHaveCSS('column-width', '288px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 375 || width === 1440) await page.locator('[data-wallpaper-detail]').screenshot({ path: testInfo.outputPath(`${locale}-${variant}-${width}.png`) });
    }
    expect(reads).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('dark fields retain draft and focus after social failures and retries', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/v1/wallpapers/*/social', route => {
    reads++;
    return reads === 1 ? route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }) : route.fulfill({ json: socialData });
  });
  await page.route('**/api/v1/wallpapers/*/comments', route => route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }));
  await page.route('**/api/v1/wallpapers/*/rating', route => route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }));
  await page.goto(localPath('ru', path));
  const comments = page.locator('[data-social-panel]');
  await expect(comments.getByRole('alert')).toBeVisible();
  await comments.getByRole('button', { name: interfaceCopy.ru.retry, exact: true }).click();
  const input = page.locator('#comment-text');
  await expect(input).toBeEnabled();
  expect(reads).toBe(2);
  await input.fill('Черновик остаётся после ошибки.');
  await expect(input).toHaveCSS('background-color', 'rgb(37, 37, 37)');
  await expect(input).toHaveCSS('color', 'rgb(232, 232, 232)');
  await comments.getByRole('button', { name: copy.ru.commentSubmit, exact: true }).click();
  await expect(comments.getByRole('alert')).toBeVisible();
  await expect(input).toHaveValue('Черновик остаётся после ошибки.');
  await input.focus();
  await expect(input).toHaveCSS('background-color', 'rgb(37, 37, 37)');
  await expect(input).toHaveCSS('outline-width', '2px');
  await page.getByRole('radio', { name: copy.ru.plus, exact: true }).click();
  await expect(page.locator('[data-wallpaper-ratings]').getByRole('alert')).toBeVisible();
  await expect(comments.getByRole('alert')).toHaveCount(0);
  await expect(input).toHaveValue('Черновик остаётся после ошибки.');
  await page.goto('/ru/feedback/');
  for (const label of [copy.ru.topic, copy.ru.message]) {
    const field = page.getByRole('textbox', { name: label, exact: true });
    await field.fill('Проверка тёмного поля');
    await expect(field).toHaveCSS('background-color', 'rgb(37, 37, 37)');
    await expect(field).toHaveCSS('color', 'rgb(232, 232, 232)');
  }
});

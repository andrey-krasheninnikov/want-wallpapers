import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { copy, localPath } from '../../src/data/copy';
import { designCopy } from '../../src/data/design-copy';
import { locales, wallpapers, publicationDates, collections } from '../../src/data/catalog';
import { newestWallpapers } from '../../src/lib/catalog-order';

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});

for (const locale of locales) test(`feedback opens in place and keeps its draft: ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(localPath(locale, '/collections/'));
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const before = page.url();
  const trigger = page.locator('header').getByRole('link', { name: copy[locale].feedback, exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible(); expect(page.url()).toBe(before);
  await dialog.getByRole('textbox', { name: copy[locale].topic, exact: true }).fill('Gallery feedback');
  await dialog.getByRole('textbox', { name: copy[locale].message, exact: true }).fill('The draft stays on this page.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole('textbox', { name: copy[locale].message, exact: true })).toHaveValue('The draft stays on this page.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.route('**/api/v1/feedback', route => route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }));
  await dialog.getByRole('button', { name: copy[locale].feedbackSubmit, exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: copy[locale].message, exact: true })).toHaveValue('The draft stays on this page.');
  await page.route('**/api/v1/feedback', route => route.fulfill({ json: { ok: true } }));
  await dialog.getByRole('button', { name: copy[locale].feedbackSubmit, exact: true }).click();
  await expect(dialog.getByText(copy[locale].feedbackThanks)).toBeVisible();
});

test('mobile feedback returns focus to menu and direct route stays available', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('button', { name: copy.en.menu, exact: true }).click();
  await page.getByRole('link', { name: copy.en.feedback, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: copy.en.menu, exact: true })).toBeFocused();
  await page.goto('/feedback/'); await expect(page.getByRole('textbox', { name: copy.en.topic, exact: true })).toBeEnabled();
});

test('collection pages paginate, stories disclose and project links remain distinct', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  const carousel = page.locator('[data-collection-carousel]');
  await carousel.getByRole('region', { name: designCopy.en.collections }).focus();
  await expect(carousel.getByRole('region', { name: designCopy.en.collections })).toHaveCSS('outline-color', 'rgb(91, 79, 255)');
  const pages = Math.ceil(collections.length / 3);
  await expect(carousel.locator('output')).toHaveText(`1 / ${pages}`);
  for (let number = 2; number <= pages; number++) {
    await carousel.getByRole('button', { name: designCopy.en.nextCollections }).click();
    await expect(carousel.locator('output')).toHaveText(`${number} / ${pages}`);
  }
  await expect(carousel.getByRole('button', { name: designCopy.en.nextCollections })).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 900 });
  const firstVisible = Math.max(1, collections.length - 2);
  await expect(carousel.locator('output')).toHaveText(`${firstVisible} / ${collections.length}`);
  await carousel.getByRole('button', { name: designCopy.en.previousCollections }).click();
  await expect(carousel.locator('output')).toHaveText(`${Math.max(1, firstVisible - 1)} / ${collections.length}`);
  const story = page.locator('.story-disclosure').first();
  await expect(story).not.toHaveAttribute('open', '');
  await story.locator('summary').click(); await expect(story).toHaveAttribute('open', '');
  await expect(story.locator('.long-copy')).toBeVisible();
  await expect(page.locator('footer a[href="https://github.com/andrey-krasheninnikov/want-wallpapers"]')).toBeVisible();
  await page.goto('/contact/');
  await expect(page.locator('[data-owner-contact] a[href="https://github.com/andrey-krasheninnikov"]')).toHaveCount(1);
  await expect(page.locator('[data-owner-contact] a[href="https://github.com/andrey-krasheninnikov/want-wallpapers"]')).toHaveCount(1);
});

test('search exposes newest works before filters and preserves their order', async ({ page }) => {
  await page.goto('/search/');
  const ids = newestWallpapers(wallpapers, publicationDates).map(item => item.id);
  await expect.poll(() => page.locator('[data-wallpaper-card]').evaluateAll(cards => cards.map(card => card.getAttribute('data-wallpaper-card')))).toEqual(ids);
  await page.getByRole('searchbox').fill('ice');
  await expect(page.locator('[data-wallpaper-card]')).toHaveCount(5);
  const filtered = await page.locator('[data-wallpaper-card]').evaluateAll(cards => cards.map(card => card.getAttribute('data-wallpaper-card')));
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.map(id => ids.indexOf(id!))).toEqual([...filtered.map(id => ids.indexOf(id!))].sort((a, b) => a - b));
});

test('glow, wand and confetti respect reduced motion and preserve downloads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.goto('/collections/contours-of-silence/');
  const card = page.locator('.gallery-card').first(); await card.hover({ position: { x: 40, y: 40 } });
  await expect(card).toHaveCSS('transform', 'none');
  await expect.poll(() => card.evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('1');
  await page.locator('[data-long-copy] p').first().hover();
  await expect(page.locator('.wand-spark').first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await card.hover();
  await expect(card).toHaveCSS('transform', 'none');
  await page.goto('/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.locator('#download-link').click(); await expect(page.locator('.download-confetti')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
  await expect(page.locator('.download-confetti')).toHaveCount(18);
  await expect(page.locator('.download-confetti')).toHaveCount(0);
});

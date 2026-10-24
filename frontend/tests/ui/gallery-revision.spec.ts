import { test, expect } from '../browser';
import { copy } from '../../src/data/copy';
import { designCopy } from '../../src/data/design-copy';
import type { ModelViewerElement } from '@google/model-viewer';

declare global { interface Window { revisionDocument?: number } }

const social = { counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: '', ownUid: null, comments: Array.from({ length: 10 }, (_, index) => ({ id: `comment-${index}`, uid: 'guest', text: index ? `Recent comment ${index}` : 'A longer comment. '.repeat(35), createdAt: Date.UTC(2026, 9, 13, 12, 10 - index) })) };

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});

for (const width of [320, 1440]) test(`stable two-column gallery, client slides, downloads and comment cards: ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/v1/wallpapers/*/social', route => route.fulfill({ json: social }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const token = await page.evaluate(() => { const value = Math.random(); window.revisionDocument = value; return value; });
  const mobile = page.getByRole('tab', { name: copy.en.mobile, exact: true });
  await mobile.scrollIntoViewIfNeeded();
  const before = (await page.locator('#wallpaper-view').boundingBox())!;
  const arrows = (await page.locator('.wallpaper-nav').boundingBox())!;
  await mobile.click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /-mobile.webp$/);
  const after = (await page.locator('#wallpaper-view').boundingBox())!;
  expect(after.width).toBeCloseTo(before.width, 0); expect(after.height).toBeCloseTo(before.height, 0);
  expect((await page.locator('.wallpaper-nav').boundingBox())!.y).toBeCloseTo(arrows.y, 0);
  await expect(page.locator('#detail-image')).toHaveCSS('object-fit', 'contain');
  if (width >= 1024) expect((await page.locator('.wallpaper-sidebar').boundingBox())!.x).toBeGreaterThan(after.x + after.width);
  if (width < 1024) await page.getByRole('button', { name: copy.en.menu, exact: true }).click();
  await page.getByRole('link', { name: copy.en.feedback, exact: true }).click();
  await page.getByRole('textbox', { name: copy.en.topic, exact: true }).fill('A retained draft');
  await page.keyboard.press('Escape');
  let previousUrl = page.url();
  for (let index = 0; index < 3; index++) {
    await page.locator('[data-wallpaper-next]').scrollIntoViewIfNeeded();
    const frame = (await page.locator('#wallpaper-view').boundingBox())!;
    await page.locator('[data-wallpaper-next]').click();
    await page.waitForURL(url => url.href !== previousUrl);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const nextFrame = (await page.locator('#wallpaper-view').boundingBox())!;
    // A shorter heading cannot preserve a positive viewer offset beyond the document top.
    const documentTop = nextFrame.y + await page.evaluate(() => scrollY);
    expect(nextFrame.y).toBeCloseTo(Math.min(frame.y, documentTop), 0); expect(nextFrame.height).toBeCloseTo(frame.height, 0);
    expect(await page.evaluate(() => window.revisionDocument)).toBe(token);
    await expect(page.locator('#detail-image')).toHaveAttribute('src', /-mobile.webp$/);
    previousUrl = page.url();
  }
  await page.goBack(); await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: copy.en.mobile, exact: true })).toHaveAttribute('aria-selected', 'true');
  if (width < 1024) await page.getByRole('button', { name: copy.en.menu, exact: true }).click();
  await page.getByRole('link', { name: copy.en.feedback, exact: true }).click();
  await expect(page.getByRole('textbox', { name: copy.en.topic, exact: true })).toHaveValue('A retained draft');
  await page.keyboard.press('Escape');
  const url = page.url(); const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toMatch(/-mobile.png$/); expect(page.url()).toBe(url);
  await expect(page.locator('[data-comment]')).toHaveCount(10);
  const comments = (await page.locator('[data-social-panel]').boundingBox())!;
  expect((await page.locator('[data-editorial]').boundingBox())!.y).toBeGreaterThanOrEqual(comments.y + comments.height);
  await page.locator('.comment-feed').focus(); await page.keyboard.press('ArrowRight'); expect(page.url()).toBe(url);
  await page.locator('.comment-disclosure summary').click(); await expect(page.locator('.comment-disclosure')).toHaveAttribute('open', '');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(`gallery-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('manual 3D changes paired textures and reset keeps the wallpaper', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  const scene = page.locator('.device-stage'); const viewer = page.locator('model-viewer');
  await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
  const initial = await scene.getAttribute('data-scene-wallpaper');
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(false);
  await expect(scene).toHaveAttribute('data-scene-wallpaper', initial!);
  await page.getByRole('button', { name: designCopy.en.right, exact: true }).click();
  await expect(scene).not.toHaveAttribute('data-scene-wallpaper', initial!);
  const selected = await scene.getAttribute('data-scene-wallpaper');
  await expect(page.locator('.device-caption a')).toHaveAttribute('href', `/wallpapers/${selected}/`);
  const textures = await viewer.evaluate(element => (element as ModelViewerElement).model!.materials.filter(material => /wallpaper/i.test(material.name)).map(material => material.pbrMetallicRoughness.baseColorTexture.texture !== null));
  expect(textures).toEqual([true, true]);
  await page.getByRole('button', { name: designCopy.en.reset, exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene-wallpaper', selected!);
  await page.route('**/previews/*', route => route.abort());
  await page.getByRole('button', { name: designCopy.en.left, exact: true }).click();
  await expect(page.locator('.device-message')).toHaveText(designCopy.en.textureFailed);
  await expect(scene).toHaveAttribute('data-scene-wallpaper', selected!);
  await page.unroute('**/previews/*');
  await page.locator('.home-mosaic').scrollIntoViewIfNeeded();
  const cards = await page.locator('.home-mosaic:not(.home-mosaic-outgoing) > article').evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom }; }));
  expect(cards).toHaveLength(6);
  expect(cards[1].y).toBeCloseTo(cards[0].y, 0); expect(cards[1].bottom).toBeCloseTo(cards[5].bottom, 0);
  const card = page.locator('.home-mosaic .gallery-card').first(); await card.hover(); await expect(card).toHaveCSS('transform', 'none');
  await expect.poll(() => card.evaluate(element => getComputedStyle(element, '::after').opacity)).toBe('1');
  await page.locator('.home-mosaic').screenshot({ path: testInfo.outputPath('bubble-1440.png') });
});

test('native download keeps the page without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4322/ru/wallpapers/contours-of-silence-1/');
    const url = page.url(), download = page.waitForEvent('download'); await page.locator('a[download]').first().click();
    expect((await download).suggestedFilename()).toBe('contours-of-silence-1-desktop.png'); expect(page.url()).toBe(url);
  } finally { await context.close(); }
});

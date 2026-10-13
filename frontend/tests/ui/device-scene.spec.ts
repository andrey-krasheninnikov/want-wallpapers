import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { designCopy } from '../../src/data/design-copy';
import { copy, localPath } from '../../src/data/copy';
import type { ModelViewerElement } from '@google/model-viewer';
import type { Locale } from '../../src/data/catalog';

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`mobile 3D activation and keyboard controls: ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const models: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', (request) => { if (request.url().endsWith('.glb')) models.push(request.url()); });
    await page.goto(localPath(locale));
    await page.getByRole('button', { name: copy[locale].essentialOnly, exact: true }).click();
    const scene = page.locator('.device-stage');
    await expect(scene).toHaveAttribute('data-scene-state', 'poster');
    await expect(page.locator('model-viewer')).toHaveCount(0);
    expect(models).toEqual([]);
    await page.getByRole('button', { name: designCopy[locale].view, exact: true }).press('Enter');
    await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
    const viewer = page.locator('model-viewer');
    await expect(viewer).toBeVisible();
    expect(models).toHaveLength(1);
    const screenTextures = await viewer.evaluate((element) => (element as ModelViewerElement).model?.materials
      .filter((material) => /wallpaper/i.test(material.name))
      .map((material) => material.pbrMetallicRoughness.baseColorTexture.texture !== null));
    expect(screenTextures).toEqual([true, true]);
    const before = await viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta);
    await page.getByRole('button', { name: designCopy[locale].right, exact: true }).press('Enter');
    await expect.poll(() => viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)).toBeGreaterThan(before);
    await page.getByRole('button', { name: designCopy[locale].reset, exact: true }).click();
    await expect.poll(() => viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)).toBeCloseTo(before, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await scene.screenshot({ path: testInfo.outputPath(`scene-${locale}-375.png`) });
    expect(errors).toEqual([]);
  });
}

test('desktop activates only visible 3D and reduced motion keeps the poster', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
  await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'poster');
  await expect(page.locator('model-viewer')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
  const viewer = page.locator('model-viewer');
  const before = await viewer.evaluate((element) => (element as ModelViewerElement).getCameraOrbit().theta);
  const bounds = (await viewer.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => viewer.evaluate((element) => (element as ModelViewerElement).getCameraOrbit().theta)
    .then((value) => Math.abs(value - before))).toBeGreaterThan(.02);
  await page.getByRole('button', { name: designCopy.en.reset, exact: true }).click();
  await expect.poll(() => viewer.evaluate((element) => (element as ModelViewerElement).getCameraOrbit().theta)).toBeCloseTo(before, 2);
  await page.locator('.hero').screenshot({ path: testInfo.outputPath('scene-desktop-1440.png') });
});

test('failed 3D keeps the poster and supports a retry', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/models/devices.glb', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
  await page.getByRole('button', { name: designCopy.en.view, exact: true }).click();
  await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'failed');
  await expect(page.locator('.device-poster')).toBeVisible();
  await expect(page.getByText(designCopy.en.failed, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: copy.en.explore, exact: true }).first()).toBeVisible();
  await page.unroute('**/models/devices.glb');
  await page.getByRole('button', { name: designCopy.en.retry, exact: true }).click();
  await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
});

test('scene works under the existing CSP without extra permissions', async ({ request }) => {
  for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
    const policy = (await request.get(localPath(locale))).headers()['content-security-policy'];
    expect(policy).not.toContain("'wasm-unsafe-eval'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain(' blob:');
  }
});

test('UI kit does not ship with production pages', async ({ request }) => {
  expect((await request.get('/ui-kit/')).status()).toBe(404);
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/ui-kit/');
});

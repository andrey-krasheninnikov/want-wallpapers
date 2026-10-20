import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { designCopy } from '../../src/data/design-copy';
import { copy, localPath } from '../../src/data/copy';
import type { ModelViewerElement } from '@google/model-viewer';
import type { Locale } from '../../src/data/catalog';

async function expectTransparentScene(scene: Locator) {
  for (const layer of [scene, ...await scene.locator('.device-canvas, .device-poster, .device-model, model-viewer, .device-caption').all()]) {
    await expect(layer).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(layer).toHaveCSS('background-image', 'none');
  }
  for (const button of await scene.getByRole('button').all()) {
    await expect(button).toHaveCSS('background-color', /^rgb\((?:37, 37, 37|28, 28, 28)\)$/);
    const bounds = (await button.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`automatic mobile 3D and keyboard controls: ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const models: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', (request) => { if (request.url().endsWith('.glb')) models.push(request.url()); });
    await page.goto(localPath(locale));
    await page.getByRole('button', { name: copy[locale].essentialOnly, exact: true }).click();
    const scene = page.locator('.device-stage');
    await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
    const viewer = page.locator('model-viewer');
    await expect(viewer).toBeVisible();
    await expectTransparentScene(scene);
    expect(models).toHaveLength(1);
    const screenTextures = await viewer.evaluate((element) => (element as ModelViewerElement).model?.materials
      .filter((material) => /wallpaper/i.test(material.name))
      .map((material) => material.pbrMetallicRoughness.baseColorTexture.texture !== null));
    expect(screenTextures).toEqual([true, true]);
    const before = await viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta);
    await page.getByRole('button', { name: designCopy[locale].right, exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: designCopy[locale].right, exact: true })).toHaveCSS('outline-width', '2px');
    await expect.poll(() => viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)).toBeGreaterThan(before);
    await page.getByRole('button', { name: designCopy[locale].reset, exact: true }).click();
    await expect.poll(() => viewer.evaluate((element) => (element as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)).toBeCloseTo(before, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await scene.screenshot({ path: testInfo.outputPath(`scene-${locale}-375.png`) });
    expect(errors).toEqual([]);
  });
}

test('desktop scene respects pause, viewport and motion preferences', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
  await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
  const viewer = page.locator('model-viewer');
  await expectTransparentScene(page.locator('.device-stage'));
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(true);
  await page.getByRole('button', { name: designCopy.en.pauseScene, exact: true }).click();
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(false);
  await page.getByRole('button', { name: designCopy.en.playScene, exact: true }).click();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(false);
  await page.locator('.device-stage').scrollIntoViewIfNeeded();
  await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(true);
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

for (const width of [375, 1440]) {
  test(`loading and failed 3D keep a transparent poster and support retry: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let releaseModel!: () => void;
    const pendingModel = new Promise<void>((resolve) => { releaseModel = resolve; });
    await page.route('**/models/devices.glb', async (route) => { await pendingModel; await route.abort(); });
    const scene = page.locator('.device-stage');
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
      await expect(page.locator('model-viewer')).toHaveCount(1);
      await expect(scene).toHaveAttribute('data-scene-state', 'loading');
      await expect(page.locator('.device-poster')).toBeVisible();
      await expect(page.getByRole('button', { name: designCopy.en.loading, exact: true })).toBeDisabled();
      await expectTransparentScene(scene);
      await scene.screenshot({ path: testInfo.outputPath(`scene-loading-${width}.png`) });
    } finally { releaseModel(); }
    await expect(scene).toHaveAttribute('data-scene-state', 'failed');
    await expect(page.locator('.device-poster')).toBeVisible();
    await expect(page.getByText(designCopy.en.failed, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: copy.en.explore, exact: true }).first()).toBeVisible();
    await expectTransparentScene(scene);
    await scene.screenshot({ path: testInfo.outputPath(`scene-failed-${width}.png`) });
    await page.unroute('**/models/devices.glb');
    await page.getByRole('button', { name: designCopy.en.retry, exact: true }).click();
    await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
    await expectTransparentScene(scene);
  });
}

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


test('without JavaScript the home scene stays a useful poster without an endless loading control', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    await expect(page.locator('.device-poster')).toBeVisible();
    await expectTransparentScene(page.locator('.device-stage'));
    await page.setViewportSize({ width: 320, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.device-controls')).toBeHidden();
    await expect(page.locator('model-viewer')).toHaveCount(0);
    await expect(page.locator('.device-caption a')).toHaveAttribute('href', '/wallpapers/contours-of-silence-11/');
  } finally { await context.close(); }
});

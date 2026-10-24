import { test, expect } from '../browser';
import type { ModelViewerElement } from '@google/model-viewer';

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

test('real 3D loads before React and hydration keeps the same viewer', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/src\/components\/DeviceScene\.tsx(?:\?|$)/, async route => { await pending; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const viewer = page.locator('model-viewer');
    await expect(viewer).toBeVisible();
    await expect(page.locator('.device-poster')).toBeHidden();
    await expect.poll(() => viewer.evaluate(element => (element as ModelViewerElement).loaded), { timeout: 45000 }).toBe(true);
    await expect(page.locator('astro-island[ssr]:has(.device-stage)')).toHaveCount(1);
    await viewer.evaluate(element => Reflect.set(window, 'earlyDeviceViewer', element));
    const textures = await viewer.evaluate(element => (element as ModelViewerElement).model!.materials
      .filter(material => /wallpaper/i.test(material.name)).map(material => material.pbrMetallicRoughness.baseColorTexture.texture!.source.uri));
    expect(textures).toEqual([expect.stringContaining('neon-tide-5'), expect.stringContaining('neon-tide-5')]);
    await page.locator('.device-stage').screenshot({ path: info.outputPath('before-react.png') });
    release();
    await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
    expect(await viewer.evaluate(element => element === Reflect.get(window, 'earlyDeviceViewer'))).toBe(true);
    expect(await viewer.evaluate(element => (element as ModelViewerElement).autoRotateDelay)).toBe(0);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('an early model failure shows the poster and retry recovers', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/src\/components\/DeviceScene\.tsx(?:\?|$)/, async route => { await pending; await route.continue(); });
  await page.route('**/models/devices.glb?cover=*', route => new URL(route.request().url()).searchParams.has('attempt') ? route.continue() : route.abort());
  const failure = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname.endsWith('devices.glb'));
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await failure;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    release();
    await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'failed');
    await expect(page.locator('.device-poster')).toBeVisible();
    const cookies = page.getByRole('button', { name: 'Essential only', exact: true });
    if (await cookies.isVisible()) await cookies.click();
    await page.locator('.device-controls button').click();
    await expect(page.locator('.device-stage')).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
    await expect(page.locator('.device-poster')).toBeHidden();
  } finally { release(); }
});

test('without JavaScript the poster remains usable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4341/');
    await expect(page.locator('.device-poster')).toBeVisible();
    await expect(page.locator('.device-model')).toBeHidden();
    await expect(page.locator('.device-controls')).toBeHidden();
    await expect(page.locator('.device-caption a')).toHaveAttribute('href', '/wallpapers/neon-tide-5/');
  } finally { await context.close(); }
});

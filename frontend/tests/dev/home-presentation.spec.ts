import { test, expect } from '../browser';
import type { ModelViewerElement } from '@google/model-viewer';

test('scene starts inside the wave and changes paired textures every second without reallocating', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  const scene = page.locator('.device-stage');
  const viewer = scene.locator('model-viewer');
  await expect(scene).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
  await expect(scene).toHaveAttribute('data-scene-wallpaper', 'neon-tide-5');
  const initial = await viewer.evaluate(element => {
    const textures = (element as ModelViewerElement).model!.materials.filter(material => /wallpaper/i.test(material.name)).map(material => material.pbrMetallicRoughness.baseColorTexture.texture!);
    Reflect.set(window, 'initialScreenTextures', textures);
    return textures.map(texture => texture.name);
  });
  expect(initial).toEqual(['/previews/neon-tide-5-desktop.webp', '/previews/neon-tide-5-mobile.webp']);
  await scene.screenshot({ path: info.outputPath('inside-the-wave.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(scene).not.toHaveAttribute('data-scene-wallpaper', 'neon-tide-5', { timeout: 2500 });
  const first = await scene.getAttribute('data-scene-wallpaper');
  await expect(scene).not.toHaveAttribute('data-scene-wallpaper', first!, { timeout: 2500 });
  expect(await viewer.evaluate(element => {
    const original = Reflect.get(window, 'initialScreenTextures');
    return (element as ModelViewerElement).model!.materials.filter(material => /wallpaper/i.test(material.name)).every((material, index) => material.pbrMetallicRoughness.baseColorTexture.texture === original[index]);
  })).toBe(true);
  await scene.getByRole('button', { name: 'Pause rotation', exact: true }).click();
  const paused = await scene.getAttribute('data-scene-wallpaper');
  await page.waitForTimeout(1200);
  await expect(scene).toHaveAttribute('data-scene-wallpaper', paused!);
  await page.evaluate(() => { HTMLImageElement.prototype.decode = () => Promise.reject(new Error('Preview unavailable')); });
  await scene.getByRole('button', { name: 'Rotate left', exact: true }).click();
  await expect(scene.locator('.device-message')).not.toBeHidden();
  await expect(scene).toHaveAttribute('data-scene-wallpaper', paused!);
});

test('chosen artworks cover their collections and metadata', async ({ page }) => {
  await page.goto('/');
  for (const [collection, image] of [
    ['neon-tide', 'neon-tide-7'], ['woven-spectrum', 'woven-spectrum-4'], ['contours-of-silence', 'contours-of-silence-11'],
  ]) {
    await expect(page.locator(`[data-collection-card="/collections/${collection}/"] img`).first()).toHaveAttribute('src', `/previews/${image}-desktop.webp`);
    await page.goto(`/collections/${collection}/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `https://wallpapers.want.foundation/previews/${image}-desktop.webp`);
    await page.goto('/');
  }
});

test('privacy and terms keep the email in the contact card without a duplicate line', async ({ page }) => {
  for (const prefix of ['', '/ru']) {
    for (const path of ['/privacy/', '/terms/']) {
      await page.goto(prefix + path);
      await expect(page.locator('[data-owner-contact] a[href="mailto:wallpapers@want.foundation"]')).toHaveCount(1);
      await expect(page.locator('.long-copy p').filter({ hasText: /^wallpapers@want\.foundation$/ })).toHaveCount(0);
    }
    await page.goto(prefix + '/contact/');
    await expect(page.locator('.long-copy p').filter({ hasText: /^wallpapers@want\.foundation$/ })).toHaveCount(1);
  }
});

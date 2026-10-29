import { expect, test, type Page } from '../browser';
import type { ModelViewerElement } from '@google/model-viewer';
import { designCopy } from '../../src/data/design-copy';

const runtimeErrors = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
  await expect(page.locator('astro-error-overlay')).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => {
    localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false }));
  });
});

for (const [width, locale, theme] of [[1440, 'en', 'dark'], [320, 'ar', 'light']] as const) test(`one hover replaces a tile without a layout jump: ${width} ${locale} ${theme}`, async ({ page }, testInfo) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: theme });
  await page.route('**/models/**', route => route.abort());
  await page.goto(locale === 'en' ? '/' : '/ar/');
  const section = page.locator('[data-home-mosaic]');
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator('.mosaic-toggle')).toBeVisible();
  await expect.poll(() => section.locator('[data-mosaic-image]').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.mouse.move(0, 0);
  const before = await section.locator('article').evaluateAll(elements => elements.map(element => element.getAttribute('data-wallpaper-card')));
  const height = (await section.boundingBox())!.height;
  await page.clock.install();
  await section.locator('article').nth(1).hover();
  await page.clock.fastForward(249);
  expect(await section.locator('article').evaluateAll(elements => elements.map(element => element.getAttribute('data-wallpaper-card')))).toEqual(before);
  await page.clock.fastForward(1);
  await expect(section.locator('article').nth(1)).not.toHaveAttribute('data-wallpaper-card', before[1]!);
  const after = await section.locator('article').evaluateAll(elements => elements.map(element => element.getAttribute('data-wallpaper-card')));
  expect(after.filter((id, index) => id !== before[index])).toHaveLength(1);
  expect(new Set(after).size).toBe(6);
  expect((await section.boundingBox())!.height).toBeCloseTo(height, 0);
  await page.clock.fastForward(9000);
  expect(await section.locator('article').evaluateAll(elements => elements.map(element => element.getAttribute('data-wallpaper-card')))).toEqual(after);
  const href = new URL((await section.locator('article').nth(1).locator('a').getAttribute('href'))!, page.url());
  expect(href.pathname).toContain('/wallpapers/');
  expect(href.searchParams.get('variant') ?? 'desktop').toBe(await section.locator('article').nth(1).getAttribute('data-mosaic-variant'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await section.screenshot({ path: testInfo.outputPath(`hover-${width}-${locale}.png`) });
});

test('CTA glow follows visibility, shared pause and reduced-motion preferences', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/ui-kit/');
  const action = page.getByRole('button', { name: 'Explore wallpapers', exact: true });
  await action.scrollIntoViewIfNeeded();
  const glow = action.locator('[data-slot="glow"]');
  await expect(glow).not.toHaveAttribute('data-paused');
  await page.locator('[data-background-toggle]').evaluate(element => (element as HTMLButtonElement).click());
  await expect(glow).toHaveAttribute('data-paused', 'true');
  await page.locator('[data-background-toggle]').evaluate(element => (element as HTMLButtonElement).click());
  await expect(glow).not.toHaveAttribute('data-paused');
  await action.focus();
  await expect(action).toHaveCSS('outline-width', '2px');
  await action.screenshot({ path: testInfo.outputPath('cta-glow.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(glow).toHaveCSS('animation-name', 'none');
  await expect(glow).toHaveAttribute('data-paused', 'true');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(glow).toBeHidden();
});

test('sphere clicks ignore foreground, text, drags and paused motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/ui-kit/');
  await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
  await page.evaluate(() => {
    const sphere = document.querySelector<HTMLElement>('.page-background > div')!;
    Object.assign(sphere.style, { animation: 'none', left: '200px', top: '250px', width: '500px', transform: 'translate(-50%, -50%)' });
    const area = document.createElement('div'); area.id = 'sphere-hit-area';
    Object.assign(area.style, { position: 'fixed', left: '150px', top: '200px', width: '100px', height: '100px', zIndex: '100' });
    document.body.append(area);
  });
  const background = page.locator('.page-background');
  const finish = () => background.evaluate(element => (element.getAnimations({ subtree: true }) as CSSAnimation[]).find(animation => animation.animationName === 'want-gradient-shimmer')?.finish());
  await page.mouse.click(200, 250);
  await expect(background).toHaveAttribute('data-background-shimmer', '');
  await finish(); await expect(background).not.toHaveAttribute('data-background-shimmer');
  await page.locator('#sphere-hit-area').evaluate(element => { (element as HTMLElement).style.backgroundColor = '#141414'; });
  await page.mouse.click(200, 250); await expect(background).not.toHaveAttribute('data-background-shimmer');
  await page.locator('#sphere-hit-area').evaluate(element => { (element as HTMLElement).style.backgroundColor = 'transparent'; element.textContent = 'Selectable text'; });
  await page.mouse.click(200, 250); await expect(background).not.toHaveAttribute('data-background-shimmer');
  await page.locator('#sphere-hit-area').evaluate(element => { element.textContent = ''; });
  await page.mouse.move(180, 250); await page.mouse.down(); await page.mouse.move(220, 250); await page.mouse.up();
  await expect(background).not.toHaveAttribute('data-background-shimmer');
  await page.locator('[data-background-toggle]').evaluate(element => (element as HTMLButtonElement).click());
  await page.mouse.click(200, 250); await expect(background).not.toHaveAttribute('data-background-shimmer');
});

test('manual rotation and automatic texture changes share complete scene cycles', async ({ page }) => {
  page.on('console', message => { if (message.type() === 'error') console.info('Scene diagnostic:', message.text()); });
  await page.route('**/gallery-data/**', async route => {
    const response = await route.fetch(); const data = await response.json();
    const first = data.wallpapers.find((item: { id: string }) => item.id === 'neon-tide-5');
    data.wallpapers = [first, ...data.wallpapers.filter((item: { id: string }) => item.id !== first.id).slice(0, 2)];
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  const scene = page.locator('.device-stage');
  await expect(scene).not.toHaveAttribute('data-scene-state', 'loading', { timeout: 45000 });
  await expect(scene).toHaveAttribute('data-scene-state', 'ready');
  const shown = [(await scene.getAttribute('data-scene-wallpaper'))!];
  for (const name of [designCopy.en.left, designCopy.en.right]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(scene).not.toHaveAttribute('data-scene-wallpaper', shown.at(-1)!);
    shown.push((await scene.getAttribute('data-scene-wallpaper'))!);
    await page.getByRole('button', { name: designCopy.en.reset, exact: true }).click();
    await expect(scene).toHaveAttribute('data-scene-wallpaper', shown.at(-1)!);
  }
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: designCopy.en.playScene, exact: true }).click();
  await expect.poll(() => page.locator('model-viewer').evaluate(element => (element as ModelViewerElement).autoRotate)).toBe(true);
  for (let index = 0; index < 3; index++) {
    await page.clock.fastForward(1000);
    await expect(scene).not.toHaveAttribute('data-scene-wallpaper', shown.at(-1)!);
    shown.push((await scene.getAttribute('data-scene-wallpaper'))!);
  }
  expect(new Set(shown.slice(0, 3)).size).toBe(3);
  expect(new Set(shown.slice(3, 6)).size).toBe(3);
});

import { test, expect, type Page } from '../browser';
import { copy } from '../../src/data/copy';

const grid = '.home-mosaic';
const section = '.home-mosaic-section';

test.use({ reducedMotion: 'no-preference' });
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.route('**/models/**', route => route.abort());
  await page.addInitScript(() => {
    Math.random = () => 0.1;
    localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false }));
  });
});

async function snapshot(page: Page) {
  return page.locator(grid).evaluate(element => JSON.stringify({ layout: element.getAttribute('data-layout'), links: [...element.querySelectorAll('a')].map(link => link.getAttribute('href')) }));
}
async function start(page: Page) {
  await page.goto('/');
  await page.locator(section).scrollIntoViewIfNeeded();
  await expect(page.locator('.mosaic-toggle')).toBeVisible();
  await expect.poll(() => page.locator(`${grid} img`).evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.clock.install();
  await page.mouse.move(0, 0);
  await page.locator(section).dispatchEvent('mouseenter');
  await page.locator(section).dispatchEvent('mouseleave');
}
async function next(page: Page, previous: string) {
  await page.clock.fastForward(3000);
  await expect.poll(() => snapshot(page)).not.toBe(previous);
  await page.locator('.home-mosaic > article, .mosaic-image-outgoing').evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => animation.finish())));
  await expect(page.locator('.mosaic-image-outgoing')).toHaveCount(0);
}

test('changes distinct works and composition only after 3 active seconds', async ({ page }) => {
  await start(page);
  const first = await snapshot(page);
  await page.clock.fastForward(2999); expect(await snapshot(page)).toBe(first);
  await page.clock.fastForward(1);
  await expect.poll(() => snapshot(page)).not.toBe(first);
  const ids = await page.locator(`${grid} > article`).evaluateAll(elements => elements.map(element => element.getAttribute('data-wallpaper-card')));
  expect(new Set(ids).size).toBe(6);
  await expect(page.locator(grid)).toHaveAttribute('data-layout', '1');
  await expect(page.locator('.mosaic-image-outgoing')).toHaveCount(6);
  await expect(page.locator('.mosaic-image-outgoing').first()).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.mosaic-image-outgoing').first()).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.mosaic-image-outgoing:not(img)')).toHaveCount(0);
  for (const link of await page.locator(`${grid} a`).all()) {
    expect(await link.getAttribute('aria-label')).toBeTruthy();
    const variant = await link.evaluate(element => element.closest('article')!.getAttribute('data-mosaic-variant'));
    expect((await link.locator('img').getAttribute('src'))?.endsWith(`-${variant}.webp`)).toBe(true);
    expect(new URL((await link.getAttribute('href'))!, page.url()).searchParams.get('variant') ?? 'desktop').toBe(variant);
  }
});

test('hover, focus, hidden tab, offscreen and explicit pause reset the interval', async ({ page }) => {
  await start(page);
  let before = await snapshot(page);
  await page.locator(section).dispatchEvent('mouseenter');
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await page.locator(section).dispatchEvent('mouseleave');
  await page.clock.fastForward(2999); expect(await snapshot(page)).toBe(before);
  await page.clock.fastForward(1); await expect.poll(() => snapshot(page)).not.toBe(before);
  before = await snapshot(page);
  await page.locator(`${grid} a`).first().focus();
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await page.locator(`${grid} a`).first().evaluate(element => (element as HTMLElement).blur());
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator(section)).not.toBeInViewport();
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await page.locator(section).scrollIntoViewIfNeeded();
  await page.locator('.mosaic-toggle').click();
  await expect(page.locator('.mosaic-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0); await page.locator('.mosaic-toggle').evaluate(element => (element as HTMLElement).blur());
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await page.locator('.mosaic-toggle').click();
  await page.mouse.move(0, 0); await page.locator('.mosaic-toggle').evaluate(element => (element as HTMLElement).blur());
  await next(page, before);
  before = await snapshot(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.mosaic-toggle')).toBeHidden();
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
  await expect(page.locator('.mosaic-image-outgoing')).toHaveCount(0);
});

test('preloads replacements, cancels a pending switch on focus and survives image failures', async ({ page }) => {
  await page.route('**/previews/contours-of-silence-1-*.webp', route => route.abort());
  await start(page);
  await expect(page.locator(`${grid} img`)).toHaveCount(6);
  const before = await snapshot(page);
  const shown = new Set(await page.locator(`${grid} img`).evaluateAll(images => images.map(image => new URL((image as HTMLImageElement).src).pathname)));
  let pending = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/previews/**', async route => {
    if (shown.has(new URL(route.request().url()).pathname)) { await route.continue(); return; }
    pending++; await gate; await route.abort();
  });
  try {
    await page.clock.fastForward(3000);
    await expect.poll(() => pending).toBeGreaterThan(0);
    expect(await snapshot(page)).toBe(before);
    await page.locator(`${grid} a`).first().focus();
    release();
    await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
    await page.locator(`${grid} a`).first().evaluate(element => (element as HTMLElement).blur());
    await next(page, before);
    await expect.poll(() => page.locator(`${grid} img`).evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  } finally { release(); }
});

for (const width of [320, 768, 1440]) test(`three filled compositions preserve the frame and focus at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1100 });
  await start(page);
  const initialHeight = (await page.locator(grid).boundingBox())!.height;
  for (let layout = 0; layout < 3; layout++) {
    await expect(page.locator(grid)).toHaveAttribute('data-layout', String(layout));
    expect((await page.locator(grid).boundingBox())!.height).toBeCloseTo(initialHeight, 0);
    const boxes = await page.locator(`${grid} > article`).evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; }));
    for (const [index, box] of boxes.entries()) {
      expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width);
      for (const other of boxes.slice(index + 1)) expect(box.right <= other.x || other.right <= box.x || box.bottom <= other.y || other.bottom <= box.y).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(`${grid} a`).first().focus();
    await expect(page.locator(`${grid} a`).first()).toHaveCSS('outline-color', 'rgb(89, 98, 240)');
    await expect(page.locator(`${grid} .gallery-card`).first()).toHaveCSS('outline-width', '2px');
    await expect(page.locator(`${grid} .gallery-card`).first()).toHaveCSS('outline-color', 'rgb(89, 98, 240)');
    await page.locator(section).screenshot({ path: testInfo.outputPath(`mosaic-${width}-${layout}.png`) });
    await page.locator(`${grid} a`).first().evaluate(element => (element as HTMLElement).blur());
    if (layout < 2) await next(page, await snapshot(page));
  }
  await expect(page.locator(`${section} h2, ${section} h3, ${section} p`)).toHaveCount(0);
});

test('no-script mosaic has localized links, descriptions and variants in every language', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as const) {
      const prefix = locale === 'en' ? '' : `/${locale}`;
      await page.goto(`${baseURL}${prefix}/`);
      await expect(page.getByRole('region', { name: copy[locale].latest, exact: true })).toHaveCount(1);
      await expect(page.locator(`${grid} a`)).toHaveCount(6);
      await expect(page.locator('.mosaic-toggle')).toBeHidden();
      for (const link of await page.locator(`${grid} a`).all()) {
        expect((await link.getAttribute('href'))?.startsWith(`${prefix}/wallpapers/`)).toBe(true);
        expect(await link.getAttribute('aria-label')).toBeTruthy();
        expect(await link.locator('img').getAttribute('alt')).toBeTruthy();
      }
      await expect(page.locator(`${grid} a`).nth(1)).toHaveAttribute('href', /\?variant=mobile$/);
    }
  } finally { await context.close(); }
});

test('navigation and disposal leave one live interval', async ({ page }) => {
  await start(page);
  await page.locator(`${grid} a`).first().click();
  await page.waitForURL('**/wallpapers/**');
  await page.getByRole('link', { name: 'Want Wallpapers', exact: true }).first().click();
  await page.waitForURL(url => url.pathname === '/');
  await page.locator(section).scrollIntoViewIfNeeded();
  await expect(page.locator('.mosaic-toggle')).toBeVisible();
  await page.mouse.move(0, 0);
  await page.locator(section).dispatchEvent('mouseenter'); await page.locator(section).dispatchEvent('mouseleave');
  await next(page, await snapshot(page));
  await expect(page.locator(grid)).toHaveAttribute('data-layout', '1');
  const before = await snapshot(page);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
  await page.clock.fastForward(30000); expect(await snapshot(page)).toBe(before);
});

test('exhausted initial previews remove the failed mosaic without uncaught errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/previews/**', route => route.abort());
  await page.goto('/');
  await page.locator(section).scrollIntoViewIfNeeded();
  await expect(page.locator(section)).toHaveCount(0);
  expect(errors).toEqual([]);
});

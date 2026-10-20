import { test, expect, type Page } from '../browser';
import { collections, locales } from '../../src/data/catalog';
import { localPath } from '../../src/data/copy';
import { designCopy } from '../../src/data/design-copy';

const carousel = (page: Page) => page.locator('[data-collection-carousel]');
const track = (page: Page) => carousel(page).getByRole('region');

async function ready(page: Page, path = '/') {
  expect((await page.goto(path))?.status()).toBe(200);
  await expect(carousel(page).locator('..')).not.toHaveAttribute('ssr');
  await page.evaluate(() => document.fonts.ready);
  await track(page).scrollIntoViewIfNeeded();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function finalPage(page: Page, pages: number, locale: typeof locales[number] = 'en') {
  for (let number = 2; number <= pages; number++) {
    await carousel(page).getByRole('button', { name: designCopy[locale].nextCollections }).click();
    await expect(carousel(page).locator('output')).toHaveText(`${number} / ${pages}`);
  }
  await expect(carousel(page).getByRole('button', { name: designCopy[locale].nextCollections })).toBeDisabled();
  const end = await track(page).evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft);
  expect(Math.abs(end)).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.route('**/*.glb', route => route.abort());
});

for (const width of [320, 375, 768, 1024, 1100, 1440, 2560]) test(`viewport track and finite pages at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await ready(page);
  const count = width < 768 ? 1 : width < 1100 ? 2 : 3;
  const pages = Math.ceil(collections.length / count);
  const geometry = await page.evaluate(() => {
    const region = document.querySelector('.collection-track')!;
    const heading = document.querySelector('#collections .section-heading')!.getBoundingClientRect();
    const first = region.firstElementChild!.getBoundingClientRect();
    const bounds = region.getBoundingClientRect();
    const next = document.querySelector('.home-mosaic')!.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, first: first.left, card: first.width, heading: heading.left, shell: heading.width, next: next.left };
  });
  expect(geometry.left).toBeCloseTo(0, 0);
  expect(geometry.right).toBeCloseTo(width, 0);
  expect(geometry.first).toBeCloseTo(geometry.heading, 0);
  expect(geometry.next).toBeCloseTo(geometry.heading, 0);
  expect(geometry.card).toBeCloseTo((geometry.shell - 24 * (count - 1)) / count, 0);
  await expect(carousel(page).locator('output')).toHaveText(`1 / ${pages}`);
  await expect(carousel(page).getByRole('button', { name: designCopy.en.previousCollections })).toBeDisabled();
  await noOverflow(page);
  if (width === 320 || width === 2560) await carousel(page).screenshot({ path: test.info().outputPath(`first-${width}.png`) });
  await finalPage(page, pages);
  const lastRight = await track(page).locator('> article').last().evaluate(element => element.getBoundingClientRect().right);
  expect(lastRight).toBeCloseTo(width - geometry.heading, 0);
  await noOverflow(page);
  if (width === 320 || width === 2560) await carousel(page).screenshot({ path: test.info().outputPath(`last-${width}.png`) });
});

for (const locale of locales) test(`two-line descriptions keep their text and padding: ${locale}`, async ({ page }) => {
  await ready(page, localPath(locale));
  const description = track(page).locator('.collection-card-description').first();
  const original = (await description.textContent())!;
  const short = { en: 'Short.', ru: 'Коротко.', 'zh-cn': '简短。', 'pt-br': 'Breve.', ja: '短い説明。', ar: 'وصف قصير.' }[locale];
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(description.locator('..')).toHaveCSS('padding-left', width < 640 ? '20px' : '24px');
    await description.evaluate((element, text) => { element.textContent = text; }, original.repeat(8));
    const long = await description.evaluate(element => {
      const style = getComputedStyle(element);
      const content = getComputedStyle(element.closest('[data-slot="card-content"]')!);
      return { height: element.clientHeight, full: element.scrollHeight, line: parseFloat(style.lineHeight), clamp: style.webkitLineClamp, overflow: style.overflow, left: content.paddingLeft, right: content.paddingRight };
    });
    expect(long.height).toBeLessThanOrEqual(2 * long.line + 1);
    expect(long.full).toBeGreaterThan(long.height);
    expect(long.clamp).toBe('2'); expect(long.overflow).toBe('hidden');
    expect(long.left).toBe(width < 640 ? '20px' : '24px'); expect(long.right).toBe(long.left);
    await expect(description).toHaveText(original.repeat(8));
    await description.evaluate((element, text) => { element.textContent = text; }, short);
    expect(await description.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(long.line + 1);
    await noOverflow(page);
  }
});

test('partial final page aligns the last card with the shell', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 900 }); await ready(page);
  await track(page).locator('> article').last().evaluate(element => element.remove());
  await finalPage(page, Math.ceil(collections.length / 3));
  const right = await track(page).locator('> article').last().evaluate(element => element.getBoundingClientRect().right);
  expect(right).toBeCloseTo(1920, 0);
  await noOverflow(page);
});

test('keyboard scrolling and card focus remain visible at both ends', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await ready(page);
  await track(page).focus();
  await expect(track(page)).toHaveCSS('outline-offset', '-5px');
  await track(page).press('ArrowRight');
  await expect.poll(() => track(page).evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const links = track(page).locator('.collection-card-link');
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  for (let index = 0; index < collections.length * 2 && !(await links.last().evaluate(element => element === document.activeElement)); index++) await page.keyboard.press('Tab');
  await expect(links.last()).toBeFocused();
  for (const link of [links.first(), links.last()]) {
    await link.focus();
    await expect(link.locator('..')).toHaveCSS('outline-style', 'solid');
    await expect(link.locator('..')).toHaveCSS('outline-offset', '3px');
    const box = await link.boundingBox(); expect(box!.x - 5).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width + 5).toBeLessThanOrEqual(376);
  }
  await carousel(page).screenshot({ path: test.info().outputPath('focus-normal.png') });
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(links.last().locator('..')).toHaveCSS('outline-style', 'solid');
  await carousel(page).screenshot({ path: test.info().outputPath('focus-forced-colors.png') });
  await noOverflow(page);
});

test('resizing the final page recomputes the page count', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 900 }); await ready(page);
  await finalPage(page, Math.ceil(collections.length / 3));
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(carousel(page).locator('output')).toHaveText(new RegExp(` / ${collections.length}$`));
  await track(page).evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }));
  await expect(carousel(page).locator('output')).toHaveText(`${collections.length} / ${collections.length}`);
  await carousel(page).getByRole('button', { name: designCopy.en.previousCollections }).click();
  await expect(carousel(page).locator('output')).toHaveText(`${collections.length - 1} / ${collections.length}`);
  await noOverflow(page);
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });
  test('a horizontal gesture scrolls the native track', async ({ page }) => {
    await ready(page);
    const bounds = (await track(page).boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const y = Math.round(Math.max(100, bounds.y + 80));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [260, 220, 180, 140, 100, 60]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => track(page).evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await session.detach(); await noOverflow(page);
  });
});

test('no-script collection links and unconstrained catalogue descriptions remain available', async ({ browser, page, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const native = await context.newPage(); await native.goto('/');
  const link = track(native).locator('.collection-card-link').first();
  await link.click(); await expect(native).toHaveURL(/\/collections\/[^/]+\/$/); await context.close();
  await page.goto('/collections/');
  await expect(page.locator('.collection-card-description').first()).toHaveCSS('-webkit-line-clamp', 'none');
});

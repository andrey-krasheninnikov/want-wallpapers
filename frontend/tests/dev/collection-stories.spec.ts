import { test, expect, type Page } from '../browser';
import AxeBuilder from '@axe-core/playwright';
import { collections, locales } from '../../src/data/catalog';
import { collectionStories } from '../../src/data/editorial';
import { localPath } from '../../src/data/copy';
import { storyCopy } from '../../src/data/story-copy';
import { interfaceCopy } from '../../src/data/interface-copy';

const collection = collections[0]!;
const carousel = (page: Page) => page.locator('[data-story-carousel]');
const cards = (page: Page) => carousel(page).locator('a[data-story]');
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.route('**/models/**', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});
async function ready(page: Page, path = '/') {
  await page.goto(path);
  await carousel(page).scrollIntoViewIfNeeded();
  await expect.poll(() => carousel(page).evaluate(element => element.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  await expect(carousel(page).getByRole('region')).toHaveCSS('scrollbar-width', 'none');
  expect(await carousel(page).getByRole('region').evaluate(element => getComputedStyle(element, '::-webkit-scrollbar').display)).toBe('none');
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
for (const locale of locales) test('complete stories and focus on both surfaces: ' + locale, async ({ page }) => {
  for (const path of ['/', '/collections/']) {
    await ready(page, localPath(locale, path));
    await expect(cards(page)).toHaveCount(collections.length);
    expect(await cards(page).evaluateAll(links => links.map(link => link.getAttribute('href'))))
      .toEqual(collections.map(item => localPath(locale, '/collections/' + item.slug + '/#collection-story')));
    const first = cards(page).first();
    await first.focus(); await first.press('Enter');
    const dialog = page.getByRole('dialog', { name: collection.title[locale], exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: collection.title[locale], exact: true })).toBeFocused();
    for (const paragraph of collectionStories[collection.slug]![locale]) await expect(dialog.getByText(paragraph, { exact: true })).toHaveCount(1);
    const link = dialog.getByRole('link');
    await expect(link).toHaveAttribute('href', new URL(localPath(locale, '/collections/' + collection.slug + '/#collection-story'), page.url()).href);
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0); await expect(first).toBeFocused();
    await first.click();
    await page.getByRole('dialog').getByRole('button', { name: interfaceCopy[locale].close, exact: true }).click();
    await expect(first).toBeFocused();
    await noOverflow(page);
  }
});
for (const width of [320, 768, 1440]) test('finite cards and single-column dialog at ' + width, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  for (const path of ['/', '/collections/']) {
    await ready(page, path);
    const count = width < 768 ? 1 : width < 1100 ? 2 : 3;
    const pages = Math.ceil(collections.length / count);
    await expect(carousel(page).locator('output')).toHaveText('1 / ' + pages);
    await expect(carousel(page).getByRole('button', { name: storyCopy.en.previous })).toBeDisabled();
    const track = carousel(page).getByRole('region');
    await track.focus(); await track.press('ArrowRight');
    await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await track.evaluate(element => element.scrollTo({ left: 0, behavior: 'instant' }));
    for (let pageNumber = 2; pageNumber <= pages; pageNumber++) {
      await carousel(page).getByRole('button', { name: storyCopy.en.next }).click();
      await expect(carousel(page).locator('output')).toHaveText(pageNumber + ' / ' + pages);
    }
    await expect(carousel(page).getByRole('button', { name: storyCopy.en.next })).toBeDisabled();
    const last = cards(page).last();
    await page.keyboard.press('Tab'); await last.focus(); await expect(last.locator('..')).toHaveCSS('outline-style', 'solid');
    const excerpt = carousel(page).locator('.story-excerpt').first();
    await expect(excerpt).toHaveCSS('-webkit-line-clamp', '3');
    await noOverflow(page);
    if (path === '/') await carousel(page).screenshot({ path: info.outputPath('cards-' + width + '.png') });
    await last.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.story-dialog-reading')).toHaveCSS('column-count', 'auto');
    await expect(dialog).toHaveCSS('animation-name', 'none');
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    if (path === '/') await dialog.screenshot({ path: info.outputPath('dialog-' + width + '.png') });
    await page.keyboard.press('Escape'); await expect(last).toBeFocused();
  }
});
test('one shared delayed request and closing before it completes', async ({ page }) => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/gallery-data/**/*.json', async route => {
    requests++; const response = await route.fetch(); await waiting; await route.fulfill({ response });
  });
  await ready(page);
  await cards(page).first().click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText(storyCopy.en.loading);
  await page.keyboard.press('Escape'); release!();
  await expect.poll(() => requests).toBe(1);
  await cards(page).first().click();
  await expect(page.getByRole('dialog').locator('.story-dialog-reading p')).toHaveCount(collectionStories[collection.slug]!.en.length);
  await page.keyboard.press('Escape'); await noOverflow(page);
});
test('data failure preserves initial previews and native collection fallback', async ({ page }) => {
  await page.route('**/gallery-data/**/*.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await ready(page);
  await expect(page.locator('.home-mosaic:not(.home-mosaic-outgoing) article')).toHaveCount(6);
  await expect(page.locator('.device-poster img')).toHaveCount(2);
  await cards(page).first().click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText(storyCopy.en.failed);
  await page.getByRole('dialog').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp('/collections/' + collection.slug + '/#collection-story$'));
  for (const paragraph of collectionStories[collection.slug]!.en) await expect(page.locator('[data-editorial]').getByText(paragraph, { exact: true })).toHaveCount(1);
});
test('without JavaScript both surfaces navigate to complete localized stories', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    const page = await context.newPage();
    for (const locale of locales) for (const path of ['/', '/collections/']) {
      await page.goto(new URL(localPath(locale, path), baseURL).href);
      await expect(cards(page)).toHaveCount(collections.length);
      await cards(page).first().click();
      await expect(page).toHaveURL(new RegExp('/collections/' + collection.slug + '/#collection-story$'));
      for (const paragraph of collectionStories[collection.slug]![locale]) await expect(page.locator('[data-editorial]').getByText(paragraph, { exact: true })).toHaveCount(1);
      await noOverflow(page);
    }
  } finally { await context.close(); }
});
test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });
  test('native horizontal swipe scrolls stories', async ({ page }) => {
    await ready(page);
    const track = carousel(page).getByRole('region');
    const bounds = (await track.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const y = Math.round(Math.max(100, bounds.y + 80));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [260, 220, 180, 140, 100, 60]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await session.detach(); await noOverflow(page);
  });
});

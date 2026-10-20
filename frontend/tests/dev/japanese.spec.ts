import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { collections, wallpapers } from '../../src/data/catalog';
import { copy, languageLabels } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { collectionStories } from '../../src/data/editorial';

const ui = copy.ja, collection = collections[0]!;
const wallpaper = wallpapers.find(item => item.id === 'neon-tide-4')!;
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'JP' } }));
  await page.route('**/models/**', route => route.abort());
  await page.route('**/api/v1/wallpapers/*/social', route => route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});
for (const width of [320, 1440]) test('Japanese public surfaces and typography at ' + width, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const failedFonts: string[] = [];
  page.on('response', response => { if (response.url().includes('noto-sans-jp') && !response.ok()) failedFonts.push(response.url()); });
  for (const [path, heading] of [
    ['/ja/', ui.heroTitle], ['/ja/collections/', ui.allCollections],
    ['/ja/collections/' + collection.slug + '/', collection.title.ja],
    ['/ja/wallpapers/' + wallpaper.slug + '/', wallpaper.title.ja],
    ['/ja/license/', ui.license], ['/ja/feedback/', ui.feedbackTitle],
  ]) {
    expect((await page.goto(path!))?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading!);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('h1')).toHaveCSS('font-family', /Noto Sans JP Variable/);
    expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans JP Variable"', '壁紙'))).toBe(true);
    await noOverflow(page);
    if (path === '/ja/' || path === '/ja/feedback/') await page.screenshot({ path: info.outputPath((path === '/ja/' ? 'home-' : 'feedback-') + width + '.png') });
    if (path!.includes('/wallpapers/')) await expect(page.getByRole('alert')).toContainText(ui.serviceError);
  }
  expect(failedFonts).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('Japanese story dialogs, consent and feedback keep keyboard focus and drafts', async ({ page }) => {
  await page.goto('/ja/');
  const card = page.locator('[data-story-carousel] a[data-story]').first();
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.evaluate(element => element.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  await card.focus(); await card.press('Enter');
  const story = page.getByRole('dialog', { name: collection.title.ja, exact: true });
  await expect(story).toBeVisible();
  for (const paragraph of collectionStories[collection.slug]!.ja) await expect(story.getByText(paragraph, { exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(card).toBeFocused();
  await page.locator('[data-cookie-settings]').click();
  await expect(page.getByRole('dialog')).toContainText(interfaceCopy.ja.settings);
  await page.getByRole('button', { name: interfaceCopy.ja.close, exact: true }).click();
  const feedback = page.locator('header a[href="/ja/feedback/"]').first(); await feedback.click();
  const dialog = page.getByRole('dialog', { name: ui.feedback, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(ui.topic, { exact: true }).fill('壁紙について');
  await dialog.getByLabel(ui.message, { exact: true }).fill('青い光のコレクションが好きです。');
  await page.keyboard.press('Escape'); await expect(feedback).toBeFocused();
  await feedback.click(); await expect(dialog.getByLabel(ui.topic, { exact: true })).toHaveValue('壁紙について');
});
test('Japanese search and downloads preserve localized navigation and original filenames', async ({ page }) => {
  await page.goto('/ja/search/');
  await page.getByRole('searchbox', { name: ui.search, exact: true }).fill('キーボード');
  const result = page.locator('[data-wallpaper-card="neon-tide-4"] a');
  await expect(result).toHaveCount(1); await result.click();
  await expect(page).toHaveURL(/\/ja\/wallpapers\/neon-tide-4\//);
  await page.getByRole('tab', { name: ui.mobile, exact: true }).click();
  const downloading = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await downloading).suggestedFilename()).toBe('neon-tide-4-mobile.png');
  await page.getByRole('link', { name: /^次の壁紙:/ }).click();
  await expect(page).toHaveURL(/\/ja\/wallpapers\/[^/]+\/\?variant=mobile/);
});
test('Japanese routes, full stories and downloads work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: 'ja-JP' });
  try {
    const page = await context.newPage(); await page.goto('/');
    await page.getByRole('link', { name: languageLabels.ja, exact: true }).click();
    await expect(page).toHaveURL(/\/ja\/$/);
    await page.locator('[data-story-carousel] a[data-story]').first().click();
    await expect(page).toHaveURL(new RegExp('/ja/collections/' + collection.slug + '/#collection-story'));
    await expect(page.getByText(collectionStories[collection.slug]!.ja.at(-1)!, { exact: true })).toBeVisible();
    await page.goto('/ja/wallpapers/' + wallpaper.slug + '/');
    const urls = await page.locator('a[download]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(urls).toContain('/downloads/neon-tide-4-desktop.png'); expect(urls).toContain('/downloads/neon-tide-4-mobile.png');
  } finally { await context.close(); }
});
test('Japanese translation tab fits the existing Russian administration', async ({ page }) => {
  await page.route('**/api/v1/admin/session', route => route.fulfill({ json: { csrf: 'local-fixture', username: 'admin' } }));
  await page.route('**/api/v1/admin/catalog', route => route.fulfill({ json: { collections: [{ item: collection, version: 1, archived: false }], wallpapers: [] } }));
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Изменить ' + collection.title.ru, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: languageLabels.ja, exact: true }).click();
  await expect(dialog.getByLabel('Название · 日本語')).toHaveValue(collection.title.ja);
  await dialog.getByLabel('Название · 日本語').fill('新しい題名');
  await expect(dialog.getByLabel('Описание · 日本語')).toHaveValue(collection.description.ja);
  await page.setViewportSize({ width: 320, height: 900 }); await noOverflow(page);
  await expect(dialog.getByRole('tab', { name: languageLabels.ja, exact: true })).toBeInViewport();
});


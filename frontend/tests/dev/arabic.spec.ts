import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { collections, wallpapers } from '../../src/data/catalog';
import { copy, languageLabels } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { collectionStories } from '../../src/data/editorial';

const ui = copy.ar, collection = collections[0]!;
const wallpaper = wallpapers.find(item => item.id === 'neon-tide-4')!;
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'EG' } }));
  await page.route('**/models/**', route => route.abort());
  await page.route('**/api/v1/wallpapers/*/social', route => route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});
for (const width of [320, 1440]) test('Arabic public surfaces and typography at ' + width, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const failedFonts: string[] = [];
  page.on('response', response => { if (response.url().includes('noto-sans-arabic') && !response.ok()) failedFonts.push(response.url()); });
  for (const [path, heading] of [
    ['/ar/', ui.heroTitle], ['/ar/collections/', ui.allCollections],
    ['/ar/collections/' + collection.slug + '/', collection.title.ar],
    ['/ar/wallpapers/' + wallpaper.slug + '/', wallpaper.title.ar],
    ['/ar/license/', ui.license], ['/ar/contact/', ui.contact], ['/ar/feedback/', ui.feedbackTitle],
  ]) {
    expect((await page.goto(path!))?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading!);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('h1')).toHaveCSS('font-family', /Noto Sans Arabic Variable/);
    expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans Arabic Variable"', 'خلفيات'))).toBe(true);
    await noOverflow(page);
    await expect(page.locator('footer a[href="https://github.com/andrey-krasheninnikov/want-wallpapers"]')).toHaveText(interfaceCopy.ar.githubProject);
    if (path === '/ar/') await expect(page.locator('[data-slot="accordion-trigger"]').first()).toHaveCSS('text-align', 'start');
    if (path!.includes('/collections/') && path !== '/ar/collections/') await expect(page.locator('[data-slot="breadcrumb-separator"] svg').first()).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
    if (path === '/ar/' || path === '/ar/feedback/') await page.screenshot({ path: info.outputPath((path === '/ar/' ? 'home-' : 'feedback-') + width + '.png') });
    if (path!.includes('/wallpapers/')) await expect(page.getByRole('alert')).toContainText(ui.serviceError);
    if (path === '/ar/contact/') await expect(page.locator('[data-owner-contact] a[href="mailto:wallpapers@want.foundation"]')).toHaveAccessibleName('البريد الإلكتروني wallpapers@want.foundation');
  }
  expect(failedFonts).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('Existing English FAQ, footer and breadcrumbs preserve LTR', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-slot="accordion-trigger"]').first()).toHaveCSS('text-align', 'start');
  await expect(page.locator('footer a[href="https://github.com/andrey-krasheninnikov/want-wallpapers"]')).toHaveText('GitHub Project');
  await page.goto('/collections/' + collection.slug + '/');
  await expect(page.locator('[data-slot="breadcrumb-separator"] svg').first()).toHaveCSS('transform', 'none');
});
test('Arabic story dialogs, consent and feedback keep keyboard focus and drafts', async ({ page }) => {
  await page.goto('/ar/');
  const card = page.locator('[data-story-carousel] a[data-story]').first();
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.evaluate(element => element.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  await card.focus(); await card.press('Enter');
  const story = page.getByRole('dialog', { name: collection.title.ar, exact: true });
  await expect(story).toBeVisible();
  for (const paragraph of collectionStories[collection.slug]!.ar) await expect(story.getByText(paragraph, { exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(card).toBeFocused();
  await page.locator('[data-cookie-settings]').click();
  await expect(page.getByRole('dialog')).toContainText(interfaceCopy.ar.settings);
  await page.getByRole('button', { name: interfaceCopy.ar.close, exact: true }).click();
  const feedback = page.locator('header a[href="/ar/feedback/"]').first(); await feedback.click();
  const dialog = page.getByRole('dialog', { name: ui.feedback, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('direction', 'rtl');
  await dialog.getByLabel(ui.topic, { exact: true }).fill('خلفية PNG');
  await dialog.getByLabel(ui.message, { exact: true }).fill('أحببت ألوان المجموعة.');
  await dialog.getByLabel(ui.emailOptional).fill('test@example.org');
  await expect(dialog.getByLabel(ui.emailOptional)).toHaveCSS('direction', 'ltr');
  await page.keyboard.press('Escape'); await expect(feedback).toBeFocused();
  await feedback.click(); await expect(dialog.getByLabel(ui.topic, { exact: true })).toHaveValue('خلفية PNG');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.locator('[data-menu-trigger]').click(); await expect(page.getByRole('dialog')).toBeVisible();
  expect((await page.getByRole('dialog').boundingBox())!.x).toBe(0);
  await page.keyboard.press('Escape');
});
test('Arabic search and downloads preserve localized navigation and original filenames', async ({ page }) => {
  await page.goto('/ar/search/');
  await page.getByRole('searchbox', { name: ui.search, exact: true }).fill('مفاتيح');
  const result = page.locator('[data-wallpaper-card="neon-tide-4"] a');
  await expect(result).toHaveCount(1); await result.click();
  await expect(page).toHaveURL(/\/ar\/wallpapers\/neon-tide-4\//);
  await expect.poll(() => page.locator('[data-wallpaper-detail]').evaluate(node => node.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  await page.getByRole('tab', { name: ui.mobile, exact: true }).click();
  await expect(page.locator('#download-link')).toHaveAttribute('href', '/downloads/neon-tide-4-mobile.png');
  const downloading = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await downloading).suggestedFilename()).toBe('neon-tide-4-mobile.png');
  await page.getByRole('link', { name: /^الخلفية التالية:/ }).click();
  await expect(page).toHaveURL(/\/ar\/wallpapers\/[^/]+\/\?variant=mobile/);
});
test('Arabic routes, full stories and downloads work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: 'ar' });
  try {
    const page = await context.newPage(); await page.goto('/');
    await page.getByRole('link', { name: languageLabels.ar, exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/$/);
    await page.locator('[data-story-carousel] a[data-story]').first().click();
    await expect(page).toHaveURL(new RegExp('/ar/collections/' + collection.slug + '/#collection-story'));
    await expect(page.getByText(collectionStories[collection.slug]!.ar.at(-1)!, { exact: true })).toBeVisible();
    await page.goto('/ar/wallpapers/' + wallpaper.slug + '/');
    const urls = await page.locator('a[download]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(urls).toContain('/downloads/neon-tide-4-desktop.png'); expect(urls).toContain('/downloads/neon-tide-4-mobile.png');
  } finally { await context.close(); }
});
test('Arabic translation tab fits the existing Russian administration', async ({ page }) => {
  await page.route('**/api/v1/admin/session', route => route.fulfill({ json: { csrf: 'local-fixture', username: 'admin' } }));
  await page.route('**/api/v1/admin/catalog', route => route.fulfill({ json: { collections: [{ item: collection, version: 1, archived: false }], wallpapers: [] } }));
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Изменить ' + collection.title.ru, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: languageLabels.ar, exact: true }).click();
  await expect(dialog.getByLabel('Название · العربية')).toHaveValue(collection.title.ar);
  await expect(dialog.getByLabel('Название · العربية')).toHaveAttribute('dir', 'rtl');
  await expect(dialog.getByLabel('Название · العربية')).toHaveCSS('font-family', /Noto Sans Arabic Variable/);
  await dialog.getByLabel('Название · العربية').fill('عنوان جديد');
  await expect(dialog.getByLabel('Описание · العربية')).toHaveValue(collection.description.ar);
  await page.setViewportSize({ width: 320, height: 900 }); await noOverflow(page);
  await expect(dialog.getByRole('tab', { name: languageLabels.ar, exact: true })).toBeInViewport();
  const tabs = await dialog.getByRole('tablist').evaluate(list => {
    const frame = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="tab"]')].map(tab => {
      const rect = tab.getBoundingClientRect();
      return { height: rect.height, contained: rect.top >= frame.top && rect.bottom <= frame.bottom && rect.left >= frame.left && rect.right <= frame.right };
    });
  });
  expect(tabs).toHaveLength(6);
  for (const tab of tabs) { expect(tab.height).toBeGreaterThanOrEqual(44); expect(tab.contained).toBe(true); }
});

test('RTL collections have finite boundaries and native keyboard and touch scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/ar/');
  const carousel = page.locator('[data-collection-carousel]'), track = carousel.getByRole('region');
  await track.scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate(node => node.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  const previous = carousel.getByRole('button', { name: 'المجموعات السابقة', exact: true });
  const next = carousel.getByRole('button', { name: 'المجموعات التالية', exact: true });
  await expect(previous).toBeDisabled();
  for (let index = 1; index < collections.length; index++) await next.click();
  await expect(next).toBeDisabled(); await expect(carousel.locator('output')).toHaveText('6 / 6');
  for (let index = 1; index < collections.length; index++) await previous.click();
  await expect(previous).toBeDisabled(); await track.focus(); await page.keyboard.press('ArrowLeft');
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeLessThan(0);
  await previous.click(); await expect(previous).toBeDisabled();
  const box = (await track.boundingBox())!, session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 40, y: box.y + 100 }] });
  for (const x of [80, 130, 180, 230]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + x, y: box.y + 100 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeLessThan(0);
  const stories = page.locator('[data-story-carousel]'); await stories.scrollIntoViewIfNeeded();
  for (let index = 1; index < collections.length; index++) await stories.getByRole('button', { name: 'الحكايات التالية', exact: true }).click();
  await expect(stories.getByRole('button', { name: 'الحكايات التالية', exact: true })).toBeDisabled();
  await expect(stories.locator('output')).toHaveText('6 / 6');
});
for (const locale of ['ar', 'en'] as const) test('directional wallpaper navigation and comment boundaries: ' + locale, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/wallpapers/*/social', route => route.fulfill({ json: {
    counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: '', ownUid: null,
    comments: Array.from({ length: 10 }, (_, index) => ({ id: String(index), uid: 'guest', text: 'تعليق مع PNG و https://example.org/ ' + index, createdAt: 1792454400000 })),
  } }));
  const prefix = locale === 'ar' ? '/ar' : ''; await page.goto(prefix + '/wallpapers/neon-tide-4/?variant=mobile');
  const next = page.locator('[data-wallpaper-next]'); await next.scrollIntoViewIfNeeded();
  await expect.poll(() => next.evaluate(node => node.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  const destination = new URL((await next.getAttribute('href'))!, page.url());
  await page.locator('#wallpaper-view').focus(); await page.keyboard.press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight');
  await expect(page).toHaveURL(new RegExp(destination.pathname + '\\?variant=mobile'));
  await page.goBack(); await expect(page).toHaveURL(/neon-tide-4/);
  await expect(page.locator('[data-wallpaper-detail="neon-tide-4"]')).toBeVisible();
  const viewer = page.locator('#wallpaper-view');
  await expect.poll(() => viewer.evaluate(node => node.closest('astro-island')?.hasAttribute('ssr'))).toBe(false);
  await viewer.scrollIntoViewIfNeeded();
  await viewer.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerId: 1, clientX: 150, clientY: 100 });
  await viewer.dispatchEvent('pointerup', { button: 0, isPrimary: true, pointerId: 1, clientX: locale === 'ar' ? 230 : 70, clientY: 100 });
  await expect(page).toHaveURL(new RegExp(destination.pathname + '\\?variant=mobile'));
  const comments = page.locator('[data-comment-carousel]'); await comments.scrollIntoViewIfNeeded();
  const previous = comments.getByRole('button', { name: locale === 'ar' ? 'التعليقات السابقة' : 'Previous comments', exact: true });
  const forward = comments.getByRole('button', { name: locale === 'ar' ? 'التعليقات التالية' : 'Next comments', exact: true });
  await expect(previous).toBeDisabled();
  for (let index = 0; index < 3; index++) await forward.click();
  await expect(forward).toBeDisabled(); await expect(comments.locator('output')).toHaveText('4 / 4');
  await expect(comments.locator('article').last()).toBeInViewport();
  await previous.click(); await expect(comments.locator('output')).toHaveText('3 / 4'); await noOverflow(page);
});

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import type { Locale } from '../../src/data/catalog';

const wallpaper = 'contours-of-silence-1';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('UI tests require local Firebase emulators. Run bun run test:ui.');
const db = getFirestore(initializeApp({ projectId: 'demo-want-wallpapers' }, 'ui-tests'));
test.beforeAll(async () => { await db.doc(`wallpapers/${wallpaper}`).set({ id: wallpaper }); });
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

async function dismissCookies(page: Page, locale: Locale) {
  await page.getByRole('button', { name: copy[locale].essentialOnly, exact: true }).click();
}

const templates = ['/', '/collections/', '/collections/contours-of-silence/', '/collections/path-to-the-light/', `/wallpapers/${wallpaper}/`, '/search/', '/feedback/', '/privacy/', '/terms/', '/cookies/', '/license/', '/contact/'];
for (const locale of ['ru', 'en', 'zh-cn', 'pt-br'] as Locale[]) {
  for (const width of [320, 768, 1024, 1440]) {
    test(`layouts and accessibility: ${locale}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      for (const [index, path] of templates.entries()) {
        await page.goto(localPath(locale, path));
        await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
        if (index === 0) await dismissCookies(page, locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main')).not.toBeEmpty();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://want-wallpapers.web.app${localPath(locale, path)}`);
        await expect(page.locator('link[rel="alternate"]')).toHaveCount(5);
        if (path === '/') {
          await expect(page.locator('main .eyebrow')).toHaveCount(0);
          await expect(page.locator('main figure a').first()).toHaveAttribute('href', localPath(locale, '/wallpapers/contours-of-silence-11/'));
          await expect(page.locator('main figure img').first()).toHaveAttribute('src', '/previews/contours-of-silence-11-desktop.webp');
          await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://want-wallpapers.web.app/previews/contours-of-silence-11-desktop.webp');
          await expect(page.locator('footer')).toContainText('© 2026 Want Foundation');
          await expect(page.locator('footer a[href="https://t.me/want_wallpapers"]')).toBeVisible();
          const buttons = await page.locator('footer nav a').evaluateAll((links) => links.map((link) => {
            const style = getComputedStyle(link);
            return { left: style.paddingLeft, right: style.paddingRight, top: style.paddingTop, bottom: style.paddingBottom, height: link.getBoundingClientRect().height };
          }));
          for (const button of buttons) {
            expect(button).toMatchObject({ left: '16px', right: '16px', top: '8px', bottom: '8px' });
            expect(button.height).toBeGreaterThanOrEqual(44);
          }
        }
        if (['/privacy/', '/terms/', '/contact/'].includes(path)) {
          const owner = page.locator('[data-owner-contact]');
          await expect(owner).toContainText('Andrey Krasheninnikov');
          for (const href of ['https://t.me/andrey_krasheninnikov', 'https://t.me/want_foundation', 'https://github.com/andrey-krasheninnikov']) await expect(owner.locator(`a[href="${href}"]`)).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await expect(page.locator('astro-error-overlay')).toHaveCount(0);
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(accessibility.violations, JSON.stringify(accessibility.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })))).toEqual([]);
        const name = `${locale}-${width}-${index}.png`;
        await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('variant selection and downloads survive a failed region lookup', async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.abort());
  await page.goto(`/ru/wallpapers/${wallpaper}/`);
  await dismissCookies(page, 'ru');
  await expect(page.getByText(copy.ru.regionUnavailable)).toBeVisible();
  await page.getByRole('tab', { name: copy.ru.mobile }).click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${wallpaper}-mobile.webp`);
  await expect(page.locator('#download-link')).toHaveAttribute('href', `/downloads/${wallpaper}-mobile.png`);
  expect(await page.locator('#detail-image').evaluate((image: HTMLImageElement) => ({ fit: getComputedStyle(image).objectFit, width: image.width, naturalWidth: image.naturalWidth }))).toMatchObject({ fit: 'contain' });
  const download = page.waitForEvent('download');
  await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe(`${wallpaper}-mobile.png`);
  await page.getByRole('tab', { name: copy.ru.desktop }).click();
  await expect(page.locator('#download-link')).toHaveAttribute('href', `/downloads/${wallpaper}-desktop.png`);
});

test('search URLs, filters, empty state and reset', async ({ page }) => {
  await page.goto('/ru/search/?q=арка&category=fantasy&collection=contours-of-silence');
  await dismissCookies(page, 'ru');
  await expect(page.locator('[data-wallpaper-card]')).toHaveCount(1);
  await expect(page.locator('[data-wallpaper-card]')).toHaveAttribute('data-wallpaper-card', 'contours-of-silence-5');
  await expect(page.getByRole('searchbox')).toHaveValue('арка');
  await page.getByRole('searchbox').fill('нет-такого-рисунка');
  await expect(page.getByText(copy.ru.noResults)).toBeVisible();
  await page.getByRole('button', { name: interfaceCopy.ru.reset }).first().click();
  await expect(page.locator('[data-wallpaper-card]')).toHaveCount(25);
  await expect(page).toHaveURL('/ru/search/');
  await page.getByRole('combobox', { name: copy.ru.category, exact: true }).click();
  await page.getByRole('option', { name: 'Фэнтези', exact: true }).click();
  await expect(page).toHaveURL(/category=fantasy/);
  expect(await page.locator('[data-wallpaper-card]').count()).toBeLessThan(25);
});

test('mobile menu and cookie dialog support keyboard focus and persistence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/ru/');
  await expect(page.getByRole('button', { name: copy.ru.essentialOnly, exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('cookie-banner.png') });
  await dismissCookies(page, 'ru');
  const menu = page.getByRole('button', { name: copy.ru.menu, exact: true });
  await menu.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await page.locator('[data-cookie-settings]').click();
  await expect(page.getByRole('dialog', { name: copy.ru.cookieSettings })).toBeVisible();
  await expect(page.getByRole('switch', { name: copy.ru.analyticsLabel })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('cookie-settings.png') });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: interfaceCopy.ru.save, exact: true }).click();
  await expect(page.locator('[data-cookie-settings]')).toBeFocused();
  await page.reload();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: copy.ru.essentialOnly, exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: interfaceCopy.ru.skip })).toBeFocused();
});

test('ratings, comments, deletion, reporting and feedback use the local emulators', async ({ page }, testInfo) => {
  await page.goto(`/ru/wallpapers/${wallpaper}/`);
  await dismissCookies(page, 'ru');
  for (const [label, emoji, value] of [[copy.ru.cringe, '👎', 'cringe'], [copy.ru.minus, '👍', 'minus'], [copy.ru.plus, '💖', 'plus'], [copy.ru.imba, '🚀', 'imba']]) {
    await expect(page.getByText(emoji, { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: label, exact: true }).click();
    await expect(page.getByText(interfaceCopy.ru.ratingSaved)).toBeVisible();
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
    expect((await db.collection(`wallpapers/${wallpaper}/ratings`).where('value', '==', value).get()).size).toBe(1);
  }
  await page.reload();
  await expect(page.getByRole('radio', { name: copy.ru.imba, exact: true })).toBeChecked();
  await page.getByRole('radio', { name: copy.ru.plus, exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: copy.ru.plus, exact: true })).toBeChecked();
  await page.getByRole('textbox', { name: interfaceCopy.ru.ownComment, exact: true }).fill('Мне нравится этот горизонт.');
  await page.getByRole('button', { name: copy.ru.commentSubmit }).click();
  await expect(page.getByText('Мне нравится этот горизонт.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  const commentFits = await page.locator('[data-comment]').evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    return [...card.querySelectorAll('button, [data-slot="badge"]')].every((child) => {
      const box = child.getBoundingClientRect();
      return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
    });
  });
  expect(commentFits).toBe(true);
  await page.locator('[data-comment]').screenshot({ path: testInfo.outputPath('own-comment-mobile.png') });
  await page.locator('[data-social-panel]').screenshot({ path: testInfo.outputPath('comments-populated-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-social-panel]').screenshot({ path: testInfo.outputPath('comments-populated-desktop.png') });
  await page.getByRole('textbox', { name: interfaceCopy.ru.ownComment, exact: true }).fill('Ещё один комментарий.');
  await page.getByRole('button', { name: copy.ru.commentSubmit }).click();
  await expect(page.getByText(copy.ru.commentWait)).toBeVisible();
  await expect(page.getByRole('textbox', { name: interfaceCopy.ru.ownComment, exact: true })).toHaveValue('Ещё один комментарий.');
  await page.getByRole('button', { name: copy.ru.delete, exact: true }).click();
  await expect(page.getByText('Мне нравится этот горизонт.', { exact: true })).toHaveCount(0);
  await db.doc(`wallpapers/${wallpaper}/comments/other-comment`).set({ uid: 'another-visitor', text: `Другая работа с цветом.\n${'Оченьдлинноесловобезпробелов'.repeat(20)}`, createdAt: Timestamp.now() });
  await page.reload();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.locator('[data-comment="other-comment"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('[data-social-panel]').screenshot({ path: testInfo.outputPath('comments-long-mobile.png') });
  await page.getByRole('button', { name: copy.ru.report, exact: true }).click();
  await expect(page.getByText(copy.ru.reportThanks)).toBeVisible();
  await page.goto('/ru/feedback/');
  await page.getByLabel(copy.ru.topic).fill('Цветовые коллекции');
  await page.getByLabel(copy.ru.message).fill('Хочется больше тёплых оттенков.');
  await page.getByLabel(copy.ru.emailOptional).fill('visitor@example.test');
  await page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true }).click();
  await expect(page.getByText(copy.ru.feedbackThanks)).toBeVisible();
  expect((await db.collection('feedback').where('email', '==', 'visitor@example.test').get()).empty).toBe(false);
});

test('a failed feedback request preserves the message and permits retry', async ({ page }) => {
  await page.goto('/ru/feedback/');
  await dismissCookies(page, 'ru');
  await page.getByLabel(copy.ru.topic).fill('Деталь');
  await page.getByLabel(copy.ru.message).fill('Сохраните это сообщение при ошибке.');
  await page.route('http://127.0.0.1:9099/**', (route) => route.abort());
  await page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(copy.ru.serviceError);
  await expect(page.getByLabel(copy.ru.message)).toHaveValue('Сохраните это сообщение при ошибке.');
  await page.unroute('http://127.0.0.1:9099/**');
  await page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true }).click();
  await expect(page.getByText(copy.ru.feedbackThanks)).toBeVisible();
});

test('catalogue, metadata and both PNG links render with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4322/ru/wallpapers/${wallpaper}/`);
  await expect(page.locator('h1')).toHaveText('Фиолетовый горизонт');
  await expect(page.locator(`a[href="/downloads/${wallpaper}-desktop.png"]`)).toBeVisible();
  await expect(page.locator(`a[href="/downloads/${wallpaper}-mobile.png"]`)).toBeVisible();
  expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}')['@type']).toBe('ImageObject');
  await expect(page.locator('main noscript p')).toHaveText(interfaceCopy.ru.javascriptRequired);
  await expect(page.locator('main noscript p')).toBeVisible();
  await expect(page.locator('[data-region-pending]')).toBeHidden();
  await page.goto('http://127.0.0.1:4322/ru/');
  await expect(page.getByText(interfaceCopy.ru.faq[0][1], { exact: true })).toBeVisible();
  await page.goto('http://127.0.0.1:4322/404/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('link', { name: interfaceCopy.en.back })).toBeVisible();
  await context.close();
});

test('FAQ keyboard interaction and language selection preserve the current page', async ({ page }) => {
  await page.goto('/ru/');
  await dismissCookies(page, 'ru');
  const question = page.getByRole('button', { name: interfaceCopy.ru.faq[0][0], exact: true });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(interfaceCopy.ru.faq[0][1], { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(interfaceCopy.ru.faq[0][1], { exact: true })).toBeHidden();
  await page.goto(`/ru/wallpapers/${wallpaper}/`);
  await page.getByRole('combobox', { name: interfaceCopy.ru.language }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(`/wallpapers/${wallpaper}/`);
  await expect(page.locator('h1')).toHaveText('Violet Horizon');
});

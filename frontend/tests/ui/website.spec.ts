import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { database } from './database';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { collections, wallpapers, downloadUrl, previewUrl, tagLabels, type Locale } from '../../src/data/catalog';

const wallpaper = 'contours-of-silence-1';
test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

async function dismissCookies(page: Page, locale: Locale) {
  await page.getByRole('button', { name: copy[locale].essentialOnly, exact: true }).click();
}

const templates = ['/', '/collections/', '/collections/contours-of-silence/', '/collections/path-to-the-light/', '/collections/where-stars-graze/', '/wallpapers/where-stars-graze-4/', '/collections/a-night-beneath-the-ice/', '/wallpapers/a-night-beneath-the-ice-1/', `/wallpapers/${wallpaper}/`, '/search/', '/feedback/', '/privacy/', '/terms/', '/cookies/', '/license/', '/contact/', '/404/'];
for (const locale of ['ru', 'en', 'zh-cn', 'pt-br'] as Locale[]) {
  for (const width of [320, 768, 1024, 1440] as const) {
    test(`layouts and accessibility: ${locale}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        const expected404 = message.location().url === page.url() && page.url().endsWith('/404/') && message.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)';
        if (message.type() === 'error' && !expected404) errors.push(message.text());
      });
      for (const [index, path] of templates.entries()) {
        expect((await page.goto(localPath(locale, path)))?.status()).toBe(path === '/404/' ? 404 : 200);
        await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
        if (index === 0) await dismissCookies(page, locale);
        await expect(page.locator('h1')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        const title = page.locator('h1.display-title');
        if (await title.count()) {
          const size = await title.evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
          expect(size).toBeGreaterThanOrEqual(32);
          expect(size).toBeLessThanOrEqual(56);
          if (width === 320) expect(size).toBeCloseTo(32);
          if (width === 1440) expect(size).toBeCloseTo(56);
          const overflow = await title.evaluate((heading) => ({
            fitsWidth: heading.scrollWidth <= heading.clientWidth + 1,
            unclipped: getComputedStyle(heading).overflowY === 'visible' || heading.scrollHeight <= heading.clientHeight + 1,
          }));
          expect(overflow).toEqual({ fitsWidth: true, unclipped: true });
        }
        const legalTitle = page.locator('.prose h1');
        if (await legalTitle.count()) {
          const size = await legalTitle.evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
          expect(size).toBeCloseTo({ 320: 36, 768: 38.4, 1024: 51.2, 1440: 64 }[width]!);
        }
        await expect(page.locator('main')).not.toBeEmpty();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://wallpapers.want.foundation${localPath(locale, path)}`);
        await expect(page.locator('link[rel="alternate"]')).toHaveCount(['/search/', '/404/'].includes(path) ? 0 : 5);
        if (path === '/search/') await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
        if (path === '/') {
          await expect(page.locator('main .eyebrow')).toHaveCount(0);
          await expect(page.locator('main figure a').first()).toHaveAttribute('href', localPath(locale, '/wallpapers/contours-of-silence-11/'));
          await expect(page.locator('main figure img').first()).toHaveAttribute('src', '/previews/contours-of-silence-11-desktop.webp');
          await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://wallpapers.want.foundation/previews/contours-of-silence-11-desktop.webp');
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

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`localized 404 routes and fallback: ${locale}`, async ({ page, request }) => {
    const path = localPath(locale, '/missing-heading-check/');
    expect((await page.goto(path))?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale);
    await expect(page.locator('h1')).toHaveText(interfaceCopy[locale].notFoundTitle);
    await dismissCookies(page, locale);
    await expect(page.getByRole('link', { name: interfaceCopy[locale].back })).toHaveAttribute('href', localPath(locale));
    const route = localPath(locale, '/404/');
    for (const url of [route, path]) {
      const response = await request.get(url);
      expect(response.status()).toBe(404);
      expect(response.headers()['content-type']).toContain('text/html');
      const body = await response.text();
      expect(body).toContain('name="robots" content="noindex"');
      for (const script of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/\bsrc\s*=/i.test(script[1]!)) continue;
        expect(response.headers()['content-security-policy']).toContain(`'sha256-${createHash('sha256').update(script[2]!).digest('base64')}'`);
      }
      const head = await request.head(url);
      expect(head.status()).toBe(404);
      expect(await head.body()).toHaveLength(0);
      const reload = await request.get(url, { headers: { 'if-modified-since': response.headers()['last-modified']!, range: 'bytes=0-10' } });
      expect(reload.status()).toBe(404);
      expect(await reload.text()).toBe(body);
    }
    const sitemap = await request.get('/sitemap-0.xml');
    expect(await sitemap.text()).not.toContain(`https://wallpapers.want.foundation${route}`);
    if (locale === 'en') {
      const fallback = await request.get('/russian/missing-heading-check/');
      expect(fallback.status()).toBe(404);
      expect(await fallback.text()).toContain('lang="en"');
      for (const url of ['/api/unknown', '/health/unknown']) {
        const response = await request.get(url);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ error: { code: 'not-found' } });
        expect(response.headers()['cache-control']).toBe('no-store');
      }
    }
  });
}

for (const [slug, number] of [['where-stars-graze', 4], ['a-night-beneath-the-ice', 1]] as const) for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`collection, search and PNG downloads: ${slug}, ${locale}`, async ({ page, request }) => {
    const collection = collections.find((item) => item.slug === slug)!;
    const designs = wallpapers.filter((item) => item.collectionId === collection.id);
    await page.goto(localPath(locale, `/collections/${slug}/`));
    await dismissCookies(page, locale);
    await expect(page.locator('h1')).toHaveText(collection.title[locale]);
    await expect(page.locator('[data-wallpaper-card]')).toHaveCount(designs.length);
    for (const design of designs) {
      await expect(page.locator(`[data-wallpaper-card="${design.id}"] a`)).toHaveAttribute('href', localPath(locale, `/wallpapers/${design.slug}/`));
      const detail = await request.get(localPath(locale, `/wallpapers/${design.slug}/`));
      expect(detail.status()).toBe(200);
      for (const variant of ['desktop', 'mobile'] as const) {
        const response = await request.get(downloadUrl(design, variant));
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
        expect((await response.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      }
    }
    const design = designs.find((item) => item.number === number)!;
    await page.goto(localPath(locale, '/search/') + `?q=${encodeURIComponent(tagLabels.water[locale])}&category=fantasy&collection=${slug}`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.locator('[data-wallpaper-card]')).toHaveCount(designs.filter((item) => item.category === 'fantasy' && item.tags.includes('water')).length);
    await expect(page.locator(`[data-wallpaper-card="${design.id}"]`)).toBeVisible();
    await page.locator(`[data-wallpaper-card="${design.id}"] a`).click();
    await expect(page.locator('h1')).toHaveText(design.title[locale]);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    for (const variant of ['mobile', 'desktop'] as const) {
      await page.getByRole('tab', { name: copy[locale][variant], exact: true }).click();
      await expect(page.locator('#detail-image')).toHaveAttribute('src', previewUrl(design, variant));
      await expect(page.locator('#detail-image')).toHaveAttribute('alt', design.description[locale]);
      const download = page.waitForEvent('download');
      await page.locator('#download-link').click();
      const saved = await download;
      expect(saved.suggestedFilename()).toBe(`${design.slug}-${variant}.png`);
      expect(await readFile((await saved.path())!)).toEqual(await readFile(new URL(`../../public/downloads/${design.slug}-${variant}.png`, import.meta.url)));
      const response = await request.get(downloadUrl(design, variant));
      expect(await response.body()).toEqual(await readFile((await saved.path())!));
    }
    const social = await request.get(`/api/v1/wallpapers/${design.id}/social`);
    expect(social.status()).toBe(200);
  });
}

test('variant selection and downloads survive a failed region lookup', async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.abort());
  await page.goto(`/ru/wallpapers/${wallpaper}/`);
  await dismissCookies(page, 'ru');
  await expect(page.locator('[data-social-panel]')).toBeVisible();
  await page.getByRole('tab', { name: copy.ru.mobile }).click();
  await expect(page.locator('#detail-image')).toHaveAttribute('src', `/previews/${wallpaper}-mobile.webp`);
  await expect(page.locator('#download-form')).toHaveAttribute('action', `/downloads/${wallpaper}-mobile.png`);
  expect(await page.locator('#detail-image').evaluate((image: HTMLImageElement) => ({ fit: getComputedStyle(image).objectFit, width: image.width, naturalWidth: image.naturalWidth }))).toMatchObject({ fit: 'contain' });
  const download = page.waitForEvent('download');
  await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe(`${wallpaper}-mobile.png`);
  await page.getByRole('tab', { name: copy.ru.desktop }).click();
  await expect(page.locator('#download-form')).toHaveAttribute('action', `/downloads/${wallpaper}-desktop.png`);
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
  await expect(page.locator('[data-wallpaper-card]')).toHaveCount(wallpapers.length);
  await expect(page).toHaveURL('/ru/search/');
  await page.getByRole('combobox', { name: copy.ru.category, exact: true }).click();
  await page.getByRole('option', { name: 'Фэнтези', exact: true }).click();
  await expect(page).toHaveURL(/category=fantasy/);
  expect(await page.locator('[data-wallpaper-card]').count()).toBeLessThan(wallpapers.length);
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
  await expect(page.getByRole('switch', { name: copy.ru.analyticsLabel })).toBeEnabled();
  await expect(page.getByRole('switch', { name: copy.ru.advertisingLabel })).toBeEnabled();
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

test('ratings, comments, deletion, reporting and feedback use the Rust server', async ({ page }, testInfo) => {
  await page.goto(`/ru/wallpapers/${wallpaper}/`);
  await dismissCookies(page, 'ru');
  for (const [label, emoji, value] of [[copy.ru.cringe, '👎', 'cringe'], [copy.ru.minus, '👍', 'minus'], [copy.ru.plus, '💖', 'plus'], [copy.ru.imba, '🚀', 'imba']]) {
    await expect(page.getByText(emoji, { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: label, exact: true }).click();
    await expect(page.getByText(interfaceCopy.ru.ratingSaved)).toBeVisible();
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
    expect(Number((await database`SELECT count(*) AS count FROM ratings WHERE wallpaper_id=${wallpaper} AND value=${value}`)[0].count)).toBe(1);
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
  const visitor = crypto.randomUUID();
  await database`INSERT INTO visitors(id) VALUES(${visitor})`;
  const otherComment = crypto.randomUUID();
  await database`INSERT INTO comments(id,wallpaper_id,visitor_id,text) VALUES(${otherComment},${wallpaper},${visitor},${`Другая работа с цветом.\n${'Оченьдлинноесловобезпробелов'.repeat(20)}`})`;
  await page.reload();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.locator(`[data-comment="${otherComment}"]`)).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
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
  expect((await database`SELECT id FROM feedback WHERE email='visitor@example.test'`).length).toBeGreaterThan(0);
});

test('a failed feedback request preserves the message and permits retry', async ({ page }) => {
  await page.goto('/ru/feedback/');
  await dismissCookies(page, 'ru');
  await page.getByLabel(copy.ru.topic).fill('Деталь');
  await page.getByLabel(copy.ru.message).fill('Сохраните это сообщение при ошибке.');
  await page.route('**/api/v1/feedback', (route) => route.abort());
  await page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(copy.ru.serviceError);
  await expect(page.getByLabel(copy.ru.message)).toHaveValue('Сохраните это сообщение при ошибке.');
  await page.unroute('**/api/v1/feedback');
  await page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true }).click();
  await expect(page.getByText(copy.ru.feedbackThanks)).toBeVisible();
});

test('catalogue, metadata and both PNG links render with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4322/ru/wallpapers/${wallpaper}/`);
  await expect(page.locator('h1')).toHaveText('Фиолетовый горизонт');
  await expect(page.locator(`form[action="/downloads/${wallpaper}-desktop.png"] button`)).toBeVisible();
  await expect(page.locator(`form[action="/downloads/${wallpaper}-mobile.png"] button`)).toBeVisible();
  expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}')['@type']).toBe('ImageObject');
  await expect(page.locator('main noscript p')).toHaveText(interfaceCopy.ru.javascriptRequired);
  await expect(page.locator('main noscript p')).toBeVisible();
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
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('combobox', { name: interfaceCopy.ru.language }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(`/wallpapers/${wallpaper}/`);
  await expect(page.locator('h1')).toHaveText('Violet Horizon');
});

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`native PNG downloads without JavaScript: ${locale}`, async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4322${localPath(locale, `/wallpapers/${wallpaper}/`)}`);
    await expect(page.locator('footer a[href="mailto:wallpapers@want.foundation"]')).toBeVisible();
    for (const variant of ['desktop', 'mobile'] as const) {
      const form = page.locator(`form[action="/downloads/${wallpaper}-${variant}.png"]`);
      await expect(form).toHaveAttribute('method', 'get');
      const waiting = page.waitForEvent('download');
      await form.getByRole('button').click();
      const download = await waiting;
      expect(download.suggestedFilename()).toBe(`${wallpaper}-${variant}.png`);
      const bytes = await readFile((await download.path())!);
      expect(bytes).toEqual(await readFile(new URL(`../../public/downloads/${wallpaper}-${variant}.png`, import.meta.url)));
      const response = await request.get(`/downloads/${wallpaper}-${variant}.png`);
      expect(response.headers()['content-type']).toContain('image/png');
      expect(response.headers()['content-disposition']).toBe(`attachment; filename="${wallpaper}-${variant}.png"`);
      expect(await response.body()).toEqual(bytes);
    }
    const summary = page.locator('details.original-preview summary');
    await summary.press('Enter');
    await expect(page.locator('details.original-preview')).toHaveAttribute('open', '');
    await expect(page.locator('details.original-preview img')).toBeVisible();
    await expect(summary).toBeFocused();
    // axe needs JavaScript timers; inspect the same no-script DOM with site scripts removed.
    const html = await new HTMLRewriter().on('script', { element(element) { element.remove(); } }).on('noscript', { element(element) { element.removeAndKeepContent(); } }).transform(new Response(await page.content())).text();
    const accessibilityContext = await browser.newContext({ viewport: { width: 320, height: 900 } });
    const accessibilityPage = await accessibilityContext.newPage();
    await accessibilityPage.route(page.url(), (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await accessibilityPage.goto(page.url());
    await expect(accessibilityPage.locator('form button')).toHaveCount(await page.locator('form button').count());
    const accessibility = await new AxeBuilder({ page: accessibilityPage }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await accessibilityContext.close();
    await context.close();
  });

  test(`original preview, download event and search history: ${locale}`, async ({ page, request }, testInfo) => {
    await page.route('https://ipwho.is/**', (route) => route.abort());
    await page.goto(localPath(locale, `/wallpapers/${wallpaper}/`));
    await dismissCookies(page, locale);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.evaluate(() => window.addEventListener('want:download', (event) => { document.body.dataset.lastDownload = JSON.stringify((event as CustomEvent).detail); }));
    for (const variant of ['desktop', 'mobile'] as const) {
      await page.getByRole('tab', { name: copy[locale][variant], exact: true }).click();
      const summary = page.locator('details.original-preview summary');
      await summary.press('Enter');
      await expect(summary).toBeFocused();
      await expect(page.locator('details.original-preview img')).toHaveAttribute('src', `https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/1-${variant}.png`);
      await expect(page.locator('details.original-preview img')).toBeVisible();
      await expect.poll(() => page.locator('details.original-preview img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`original-${variant}-${width}.png`), fullPage: true });
      }
      const waiting = page.waitForEvent('download');
      await page.locator('#download-link').focus();
      await page.keyboard.press('Enter');
      const download = await waiting;
      expect(download.suggestedFilename()).toBe(`${wallpaper}-${variant}.png`);
      expect(await readFile((await download.path())!)).toEqual(await readFile(new URL(`../../public/downloads/${wallpaper}-${variant}.png`, import.meta.url)));
      await expect(page.locator('body')).toHaveAttribute('data-last-download', JSON.stringify({ wallpaper, variant }));
    }
    const query = tagLabels.city[locale];
    const searchParameters = new URLSearchParams({ q: query, category: 'fantasy', collection: 'path-to-the-light' });
    await page.goto(localPath(locale, '/search/') + '?' + searchParameters);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('link[hreflang]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://wallpapers.want.foundation${localPath(locale, '/search/')}`);
    await expect(page.locator('[data-wallpaper-card]')).toHaveCount(1);
    await page.locator('[data-wallpaper-card] a').click();
    await page.goBack();
    await expect(page.getByRole('searchbox')).toHaveValue(query);
    expect(new URL(page.url()).searchParams.toString()).toBe(searchParameters.toString());
    await expect(page.locator('[data-wallpaper-card]')).toHaveCount(1);
    await page.getByRole('searchbox').fill('no-matching-design-731');
    await expect(page.getByText(copy[locale].noResults, { exact: true })).toBeVisible();
    const sitemap = await request.get('/sitemap-0.xml');
    expect(await sitemap.text()).not.toContain('/search/');
    const llms = await request.get('/llms.txt');
    expect(llms.status()).toBe(200);
    expect(llms.headers()['content-type']).toContain('text/plain');
    expect(await llms.text()).toContain(`## ${locale}\n`);
  });
}

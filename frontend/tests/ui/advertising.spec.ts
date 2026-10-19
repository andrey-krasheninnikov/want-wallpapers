import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import type { Locale } from '../../src/data/catalog';

let bundle: string;
const preferenceKey = 'want-cookie-preferences-v2';
const locales = ['ru', 'en', 'zh-cn', 'pt-br'] as Locale[];
test.beforeAll(async () => {
  const result = await Bun.build({ entrypoints: [resolve(import.meta.dir, 'advertising-fixture.tsx')], target: 'browser', minify: true, external: ['astro:transitions/client'], define: { 'import.meta.env': '{}' } });
  if (!result.success) throw new Error(result.logs.map(String).join('\n'));
  bundle = await result.outputs[0]!.text();
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
});

async function fixture(page: Page, locale: Locale, mode = 'ready', privatePage = false) {
  const response = await page.request.get(localPath(locale, '/wallpapers/contours-of-silence-1/'));
  const styles = [...(await response.text()).matchAll(/href="([^"<>]+\.css)"/g)].map((match) => `<link rel="stylesheet" href="${match[1]}">`).join('');
  await page.route('**/__advertising-fixture.js', (route) => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const path = privatePage ? '/admin/test-advertising/' : '/test-advertising/';
  await page.route(`**${path}**`, (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="${locale}" class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Advertising fixture</title>${styles}</head><body><div id="fixture"></div><script type="module" src="/__advertising-fixture.js"></script></body></html>` }));
  await page.goto(`${path}?locale=${locale}&mode=${mode}`);
  await expect(page.locator('h1')).toBeVisible();
}
async function country(page: Page, value: string | null) {
  await page.route('https://ipwho.is/**', (route) => value === null ? route.abort() : route.fulfill({ json: { success: true, country_code: value } }));
}

for (const locale of locales) {
  test(`side placements preserve the centre and accessible layout: ${locale}`, async ({ page }, testInfo) => {
    await country(page, ' ru ');
    await fixture(page, locale);
    for (const width of [320, 768, 1024, 1440, 1711]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
      expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (const width of [1712, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const placements = page.getByRole('complementary', { name: interfaceCopy[locale].advertisement });
      await expect(placements).toHaveCount(2);
      for (const fontSize of ['', '20px']) {
        await page.evaluate((value) => { document.documentElement.style.fontSize = value; }, fontSize);
        const centre = await page.locator('.wallpaper-advertising-layout').boundingBox();
        expect(centre!.width).toBe(1280);
        for (const side of ['left', 'right']) {
          const box = await page.locator(`.wallpaper-advertisement[data-side="${side}"]`).boundingBox();
          expect(box!.width).toBe(160); expect(box!.x).toBeGreaterThanOrEqual(32);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width - 32);
          expect(side === 'left' ? centre!.x - (box!.x + box!.width) : box!.x - (centre!.x + centre!.width)).toBe(24);
        }
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      if (locale === 'ru') await page.screenshot({ path: testInfo.outputPath(`advertising-${width}.png`) });
    }
    expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual(['yandex:left', 'yandex:right']);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => page.evaluate(() => window.advertisingFixture.cancelled.length)).toBe(2);
    await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
  });

  test(`country selection and independent explicit consent: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    for (const value of ['RU', 'KZ', 'BY', 'US', 'DE', null]) {
      await country(page, value); await fixture(page, locale);
      await expect(page.locator('html')).toHaveAttribute('data-country', value ?? 'unknown');
      if (value === 'DE' || value === null) {
        expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
        await page.getByRole('region', { name: copy[locale].cookieSettings }).getByRole('button', { name: copy[locale].cookieSettings, exact: true }).click();
        await page.getByRole('switch', { name: copy[locale].advertisingLabel, exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: interfaceCopy[locale].save, exact: true }).click();
        expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({ analytics: false, advertising: true });
      }
      const provider = ['RU', 'KZ', 'BY'].includes(value!) ? 'yandex' : 'adsterra';
      await expect.poll(() => page.evaluate(() => window.advertisingFixture.calls)).toEqual([`${provider}:left`, `${provider}:right`]);
    }
    await page.addInitScript((key) => localStorage.setItem(key, '{"analytics":true,"advertising":false}'), preferenceKey);
    await country(page, 'RU'); await fixture(page, locale);
    await expect(page.locator('html')).toHaveAttribute('data-country', 'RU');
    expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
  });

  test(`provider failures and withdrawal preserve PNG downloads: ${locale}`, async ({ page }) => {
    await country(page, 'RU'); await page.setViewportSize({ width: 1920, height: 900 });
    for (const mode of ['error', 'no-fill', 'pending']) {
      await fixture(page, locale, mode);
      await expect.poll(() => page.evaluate(() => window.advertisingFixture.calls.length)).toBe(2);
      await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
      await page.getByRole('button', { name: copy[locale].essentialOnly, exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.advertisingFixture.cancelled.length)).toBe(2);
      await page.evaluate(() => window.advertisingFixture.finish());
      if (mode === 'pending') await expect.poll(() => page.evaluate(() => window.advertisingFixture.disposed.length)).toBe(2);
      await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
      for (const variant of ['mobile', 'desktop'] as const) {
        await page.getByRole('tab', { name: copy[locale][variant], exact: true }).focus(); await page.keyboard.press('Enter');
        const download = page.waitForEvent('download');
        await page.locator('#download-link').focus(); await page.keyboard.press('Enter');
        const saved = await download;
        expect(saved.suggestedFilename()).toBe(`contours-of-silence-1-${variant}.png`);
        expect(await readFile((await saved.path())!)).toEqual(await readFile(resolve(import.meta.dir, `../../public/downloads/contours-of-silence-1-${variant}.png`)));
      }
      await expect(page.locator('[data-social-panel]')).toBeVisible();
      await expect(page.getByRole('radio', { name: copy[locale].plus, exact: true })).toBeEnabled();
    }
  });
}

test('stored denial and cross-tab withdrawal prevent new optional operations', async ({ page, context }) => {
  await country(page, 'RU'); await page.setViewportSize({ width: 1920, height: 900 });
  await page.addInitScript((key) => localStorage.setItem(key, '{"analytics":true,"advertising":false}'), preferenceKey);
  await fixture(page, 'en'); await expect(page.locator('html')).toHaveAttribute('data-country', 'RU');
  expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
  await page.locator('[data-cookie-settings]').click();
  await page.getByRole('switch', { name: copy.en.advertisingLabel, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: interfaceCopy.en.save, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.advertisingFixture.calls.length)).toBe(2);
  const second = await context.newPage(); await country(second, 'RU');
  await fixture(second, 'en'); await second.locator('[data-cookie-settings]').click();
  await second.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.advertisingFixture.cancelled.length)).toBe(2);
  await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
  await second.close();
});

test('late country lookup never starts the wrong provider', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.addInitScript((key) => localStorage.setItem(key, '{"analytics":false,"advertising":true}'), preferenceKey);
  let resume!: () => void; const wait = new Promise<void>((resolve) => { resume = resolve; });
  await page.route('https://ipwho.is/**', async (route) => { await wait; await route.fulfill({ json: { success: true, country_code: 'KZ' } }); });
  await fixture(page, 'en'); expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
  resume(); await expect.poll(() => page.evaluate(() => window.advertisingFixture.calls)).toEqual(['yandex:left', 'yandex:right']);
});

test('private pages exclude advertising even when an integration is supplied', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  const lookups: string[] = []; page.on('request', (request) => { if (request.url().startsWith('https://ipwho.is/')) lookups.push(request.url()); });
  for (const locale of locales) {
    await fixture(page, locale, 'ready', true);
    expect(await page.evaluate(() => window.advertisingFixture.calls)).toEqual([]);
    await expect(page.locator('.wallpaper-advertisement:not([hidden])')).toHaveCount(0);
  }
  expect(lookups).toEqual([]);
});

test('normal pages have no placements, provider requests or test entrypoints', async ({ page }) => {
  await country(page, 'RU'); await page.setViewportSize({ width: 1920, height: 900 });
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  for (const locale of locales) for (const path of ['/', '/search/', '/wallpapers/contours-of-silence-1/']) {
    const response = await page.goto(localPath(locale, path));
    const csp = response!.headers()['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|yastatic|yandex|adsterra/);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.locator('.wallpaper-advertisement')).toHaveCount(0);
    expect(await page.evaluate(() => typeof window.advertisingFixture)).toBe('undefined');
  }
  await page.goto('/admin/login/'); await expect(page.locator('.wallpaper-advertisement')).toHaveCount(0);
  expect(requests.some((url) => /yastatic|yandex|adsterra|__advertising-fixture/.test(url))).toBe(false);
});

test('unmount cancels pending placements and late completion stays detached', async ({ page }) => {
  await country(page, 'RU'); await page.setViewportSize({ width: 1920, height: 900 });
  await fixture(page, 'en', 'pending');
  await expect.poll(() => page.evaluate(() => window.advertisingFixture.calls.length)).toBe(2);
  await page.evaluate(() => window.advertisingFixture.unmount());
  await expect.poll(() => page.evaluate(() => window.advertisingFixture.cancelled.length)).toBe(2);
  await page.evaluate(() => window.advertisingFixture.finish());
  await expect.poll(() => page.evaluate(() => window.advertisingFixture.disposed.length)).toBe(2);
  await expect(page.locator('.wallpaper-advertisement')).toHaveCount(0);
});

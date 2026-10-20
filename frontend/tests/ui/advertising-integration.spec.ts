import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { locales } from '../../src/data/catalog';
import { hilltopAdvertisement } from '../../src/lib/advertising-providers';

const preferenceKey = 'want-cookie-preferences-v2';
const banner = 'iframe[data-test-banner]';

async function network(page: Page, country: string | null, mode = 'ready') {
  const calls: string[] = [];
  await page.context().route('https://**/*', route => route.abort());
  await page.context().route('https://massivesalad.com/mock-popup', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test popup</title>' }));
  await page.route('**/*.glb', route => route.abort());
  await page.route('https://ipwho.is/**', route => country === null ? route.abort() : route.fulfill({ json: { success: true, country_code: country } }));
  await page.route('**/api/v1/**', route => route.fulfill({ json: route.request().url().endsWith('/social') ? { counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: null, ownUid: null, comments: [] } : { enabled: false } }));
  await page.route('https://massivesalad.com/mock-banner', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test banner</title><body style="margin:0;background:#252525;color:#e8e8e8">Test banner</body>' }));
  await page.route(hilltopAdvertisement.src, async route => {
    calls.push(route.request().url());
    if (mode === 'error') { await route.abort(); return; }
    await route.fulfill({ contentType: 'text/javascript', body: mode === 'empty' ? '' : `
      if (JSON.stringify(document.currentScript.settings) !== '{}' || !document.currentScript.async || document.currentScript.referrerPolicy !== 'no-referrer-when-downgrade') throw new Error('Invalid placement setup');
      const frame = document.createElement('iframe');
      frame.dataset.testBanner = ''; frame.title = 'Test banner'; frame.width = '300'; frame.height = '250';
      frame.style.cssText = 'border:0;display:block'; frame.src = 'https://massivesalad.com/mock-banner';
      document.currentScript.before(frame);
      setTimeout(() => { window.testPopupAttempts = (window.testPopupAttempts || 0) + 1; window.open('https://massivesalad.com/mock-popup', '_blank'); }, 15000);
    ` });
  });
  return calls;
}
async function ready(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-country', /.+/);
  await expect.poll(() => page.locator('astro-island[ssr]:not([client="visible"])').evaluateAll(elements => elements.map(element => element.getAttribute('component-url')))).toEqual([]);
}
async function allow(page: Page) {
  await page.locator('[data-cookie-settings]').click();
  await page.getByRole('switch', { name: copy.en.advertisingLabel, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: interfaceCopy.en.save, exact: true }).click();
}

for (const locale of locales) test(`one banner fits without covering content: ${locale}`, async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const calls = await network(page, 'US');
  await page.setViewportSize({ width: 300, height: 900 });
  await page.goto(localPath(locale, '/wallpapers/contours-of-silence-1/')); await ready(page);
  expect(calls).toEqual([]);
  for (const width of [320, 375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(banner)).toBeVisible();
    await expect(page.getByRole('complementary', { name: interfaceCopy[locale].advertisement })).toHaveCount(1);
    const box = await page.locator(banner).boundingBox();
    expect(box!.width).toBe(300); expect(box!.height).toBe(250);
    expect(box!.x).toBeGreaterThanOrEqual(10); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 10);
    expect(await page.evaluate(selector => { const frame = document.querySelector(selector)!.getBoundingClientRect(); const main = document.querySelector('main')!.getBoundingClientRect(); return frame.top >= main.bottom; }, banner)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (locale === 'en' && [320, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`hilltop-${width}.png`), fullPage: true });
  }
  expect(calls).toEqual([hilltopAdvertisement.src]); expect(errors).toEqual([]);
});

for (const country of ['RU', 'KZ', 'BY', 'US']) test(`the same provider starts outside the EEA: ${country}`, async ({ page }) => {
  const calls = await network(page, country);
  await page.goto('/search/'); await ready(page);
  await expect(page.locator(banner)).toBeVisible(); expect(calls).toEqual([hilltopAdvertisement.src]);
});

for (const country of ['DE', null]) test(`explicit permission and withdrawal: ${country ?? 'unknown'}`, async ({ page }) => {
  await page.clock.install();
  const calls = await network(page, country);
  await page.goto('/search/'); await ready(page); expect(calls).toEqual([]);
  await allow(page); await expect(page.locator(banner)).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({ analytics: false, advertising: true });
  const popup = page.context().waitForEvent('page'); await page.clock.fastForward(15000);
  const opened = await popup; await opened.waitForLoadState('domcontentloaded');
  expect(opened.url()).toBe('https://massivesalad.com/mock-popup'); await opened.close();
  expect(await page.evaluate(() => Reflect.get(window, 'testPopupAttempts'))).toBe(1);
  await page.locator('[data-cookie-settings]').click();
  const reload = page.waitForEvent('domcontentloaded');
  await page.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click(); await reload; await ready(page);
  await page.clock.fastForward(60000);
  expect(await page.evaluate(() => Reflect.get(window, 'testPopupAttempts'))).toBeUndefined();
  await expect(page.locator(banner)).toHaveCount(0); expect(calls).toHaveLength(1);
});

test('stored denial and cross-tab withdrawal prevent further ads', async ({ page, context }) => {
  const calls = await network(page, 'US');
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, '{"analytics":true,"advertising":false}'); }, preferenceKey);
  await page.goto('/search/'); await ready(page); expect(calls).toEqual([]);
  await allow(page); await expect(page.locator(banner)).toBeVisible();
  const second = await context.newPage(); await network(second, 'US'); await second.goto('/'); await ready(second);
  const reload = page.waitForEvent('domcontentloaded');
  await second.locator('[data-cookie-settings]').click();
  await second.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click(); await reload; await ready(page);
  await expect(page.locator(banner)).toHaveCount(0); expect(calls).toHaveLength(1); await second.close();
});

for (const mode of ['error', 'empty']) test(`failure and no-fill leave downloads and social actions working: ${mode}`, async ({ page }) => {
  const calls = await network(page, 'US', mode);
  await page.unroute('**/api/v1/**');
  await page.goto('/wallpapers/contours-of-silence-1/'); await ready(page);
  await expect.poll(() => calls.length).toBe(1);
  await expect(page.locator('.inline-advertisement:not([hidden])')).toHaveCount(0);
  for (const variant of ['mobile', 'desktop'] as const) {
    await page.getByRole('tab', { name: copy.en[variant], exact: true }).click();
    const download = page.waitForEvent('download'); await page.locator('#download-link').click();
    expect((await download).suggestedFilename()).toBe(`contours-of-silence-1-${variant}.png`);
  }
  await page.getByRole('radio', { name: copy.en.plus, exact: true }).click();
  await expect(page.getByText(interfaceCopy.en.ratingSaved)).toBeVisible();
  await page.getByRole('textbox', { name: interfaceCopy.en.commentTitle, exact: true }).fill(`Advertisement ${mode} does not block comments.`);
  await page.getByRole('button', { name: copy.en.commentSubmit, exact: true }).click();
  await expect(page.getByText(`Advertisement ${mode} does not block comments.`, { exact: true })).toBeVisible();
  await page.goto('/search/?q=ice'); await ready(page);
  await expect(page.getByRole('searchbox')).toHaveValue('ice');
  await expect(page.locator('[data-wallpaper-card]').first()).toBeVisible();
});

test('no-fill times out without retrying or leaving a placement', async ({ page }) => {
  await page.clock.install(); const calls = await network(page, 'US', 'empty');
  await page.goto('/search/'); await ready(page); await expect.poll(() => calls.length).toBe(1);
  await page.clock.fastForward(10001);
  await expect(page.locator('.inline-advertisement > div')).toHaveCount(0);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  await page.setViewportSize({ width: 400, height: 900 });
  expect(calls).toHaveLength(1);
});

test('advertising documents reload and preserve the selected download variant', async ({ page }) => {
  const calls = await network(page, 'RU');
  await page.goto('/wallpapers/contours-of-silence-1/?variant=mobile'); await ready(page); await expect(page.locator(banner)).toBeVisible();
  await page.evaluate(() => Object.assign(window, { documentMarker: true }));
  const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-mobile.png');
  await page.locator('[data-wallpaper-next]').click();
  await expect(page).toHaveURL(/\?variant=mobile#wallpaper-view$/); await ready(page);
  expect(await page.evaluate(() => Reflect.get(window, 'documentMarker'))).toBeUndefined();
  await expect(page.locator(banner)).toBeVisible(); expect(calls).toHaveLength(2);
  await page.getByRole('link', { name: 'Want Wallpapers', exact: true }).first().click();
  await expect(page.locator('.public-advertisements')).toHaveCount(0); expect(calls).toHaveLength(2);
});

test('cached documents refresh their privacy state before resuming advertising', async ({ page }) => {
  const calls = await network(page, 'US');
  await page.goto('/search/'); await ready(page); await expect(page.locator(banner)).toBeVisible();
  const reload = page.waitForEvent('domcontentloaded');
  await page.evaluate(key => { localStorage.setItem(key, '{"analytics":false,"advertising":false}'); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }, preferenceKey);
  await reload; await ready(page); await expect(page.locator(banner)).toHaveCount(0); expect(calls).toHaveLength(1);
});

for (const action of ['initialize', 'withdraw']) test(`a pending tag survives initialization and cannot outlive withdrawal: ${action}`, async ({ page }) => {
  await network(page, 'US');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await page.route(hilltopAdvertisement.src, async route => {
    requests.push(route.request().url()); await pending;
    await route.fulfill({ contentType: 'text/javascript', body: 'window.testLateAdvertising = true;' }).catch(() => {});
  });
  try {
    await page.goto('/search/', { waitUntil: 'domcontentloaded' }); await ready(page); await expect.poll(() => requests.length).toBe(1);
    if (action === 'initialize') {
      await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load'))); release();
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'testLateAdvertising'))).toBe(true);
      await expect(page.locator(`script[src="${hilltopAdvertisement.src}"]`)).toHaveCount(1);
    } else {
      await page.locator('[data-cookie-settings]').click(); const reload = page.waitForEvent('domcontentloaded');
      await page.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click(); await reload; await ready(page); release();
      expect(await page.evaluate(() => Reflect.get(window, 'testLateAdvertising'))).toBeUndefined();
      await expect(page.locator(`script[src="${hilltopAdvertisement.src}"]`)).toHaveCount(0);
    }
    expect(requests).toHaveLength(1);
  } finally { release(); }
});

test('CSP isolates the provider and verification file from excluded routes', async ({ page, request }) => {
  for (const locale of locales) {
    for (const route of ['/wallpapers/contours-of-silence-1/', '/search/']) {
      const response = await request.get(localPath(locale, route)); expect(response.status()).toBe(200);
      const policy = response.headers()['content-security-policy'];
      expect(policy).toContain('https://massivesalad.com'); expect(policy).toContain('https://phoroglopsu.com');
      expect(policy).not.toMatch(/yandex|yastatic|adfox|bauval|unsafe-eval|script-src-elem/);
      expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    }
    const calls = await network(page, 'US');
    for (const route of ['/', '/404/', '/unknown/']) {
      const response = await page.goto(localPath(locale, route));
      expect(response!.headers()['content-security-policy']).not.toMatch(/massivesalad|phoroglopsu|unsafe-eval|script-src-elem/);
      await expect(page.locator('.public-advertisements')).toHaveCount(0);
    }
    expect(calls).toEqual([]);
  }
  for (const route of ['/admin/login/', '/api/v1/catalog', '/ui-kit/', '/2405ea2a7a861b5bc39f.txt']) {
    const response = await request.get(route);
    expect(response.headers()['content-security-policy']).not.toMatch(/massivesalad|phoroglopsu/);
    if (route.endsWith('.txt')) { expect(response.status()).toBe(200); expect(await response.text()).toBe('66236f1398a411bf35ec'); }
  }
  await network(page, 'US'); await page.goto('/search/'); await ready(page); await expect(page.locator(banner)).toBeVisible();
  await page.evaluate(() => {
    const violations: string[] = []; Object.assign(window, { advertisingCspViolations: violations });
    document.addEventListener('securitypolicyviolation', event => violations.push(event.blockedURI));
    const script = document.createElement('script'); script.src = 'https://ads.invalid/unapproved.js'; document.head.append(script);
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'advertisingCspViolations'))).toContain('https://ads.invalid/unapproved.js');
});

test('without JavaScript the original PNG bytes and filename remain available', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage(); const calls = await network(page, 'US');
    await page.goto('/ja/wallpapers/contours-of-silence-1/'); const url = page.url(), download = page.waitForEvent('download');
    await page.locator('a[download]').first().click(); const saved = await download;
    expect(saved.suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
    expect(await readFile((await saved.path())!)).toEqual(await readFile(new URL('../../public/downloads/contours-of-silence-1-desktop.png', import.meta.url)));
    expect(page.url()).toBe(url); expect(calls).toEqual([]);
  } finally { await context.close(); }
});

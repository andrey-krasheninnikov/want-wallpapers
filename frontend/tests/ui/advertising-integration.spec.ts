import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import { locales } from '../../src/data/catalog';
import { adsterraUnits } from '../../src/lib/advertising-providers';

const preferenceKey = 'want-cookie-preferences-v2';

async function network(page: Page, country: string | null, mode = 'ready') {
  const calls: string[] = [];
  await page.route('https://**/*', route => route.abort());
  await page.route('**/*.glb', route => route.abort());
  await page.route('https://ipwho.is/**', route => country === null ? route.abort() : route.fulfill({ json: { success: true, country_code: country } }));
  await page.route('**/api/v1/**', route => route.fulfill({ json: route.request().url().endsWith('/social') ? { counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: null, ownUid: null, comments: [] } : { enabled: false } }));
  await page.route('https://yandex.ru/ads/system/**', async route => {
    const context = route.request().url().endsWith('/context.js');
    calls.push(context ? 'yandex:context' : 'yandex:auto');
    if (mode === 'error') { await route.abort(); return; }
    await route.fulfill({ contentType: 'text/javascript', body: context ? 'window.testYandexContext = true;' : `if (!window.testYandexContext || document.currentScript.dataset.pageId !== '20177169') throw new Error('Invalid auto placement setup'); const ad = document.createElement('div'); ad.dataset.testYandex = ''; ad.textContent = 'Test advertisement'; document.body.append(ad);` });
  });
  await page.route('https://bauval.org/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/mock/')) { await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test advertisement</title><body style="margin:0;background:#252525;color:#e8e8e8">Test advertisement</body>' }); return; }
    const key = url.pathname.split('/').at(-1)!;
    calls.push(`adsterra:${key}`);
    if (mode === 'error') { await route.abort(); return; }
    const unit = Object.values(adsterraUnits).find(unit => unit.key === key)!;
    const frame = `<iframe title="Test advertisement" data-test-unit="${key}" width="${unit.width}" height="${unit.height}" src="https://bauval.org/mock/${key}" style="border:0;display:block"></iframe>`;
    await route.fulfill({ contentType: 'text/javascript', body: mode === 'empty' ? '' : `if (window.atOptions?.key !== '${key}') throw new Error('Placement options raced'); document.writeln(${JSON.stringify(frame)});` });
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

for (const locale of locales) {
  test(`Adsterra adapts without overlap or duplicate keys: ${locale}`, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const calls = await network(page, 'US');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(localPath(locale, '/wallpapers/contours-of-silence-1/')); await ready(page);
    await expect(page.locator('.inline-advertisement:not([hidden]), .wallpaper-advertisement:not([hidden])')).toHaveCount(0);
    expect(calls).toEqual([]);
    for (const [width, units] of [[335, ['rectangle']], [375, ['mobile']], [500, ['banner']], [768, ['banner']], [1024, ['leaderboard']], [1440, ['leaderboard']], [1712, ['left', 'right']], [1920, ['left', 'right']]] as const) {
      await page.setViewportSize({ width, height: 900 });
      const frames = page.locator('iframe[data-test-unit]');
      await expect(frames).toHaveCount(units.length);
      for (const frame of await frames.all()) await expect(frame).toBeVisible();
      await expect.poll(() => frames.evaluateAll(elements => elements.map(element => element.getAttribute('data-test-unit')).sort())).toEqual(units.map(name => adsterraUnits[name].key).sort());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width >= 1712) {
        const centre = await page.locator('.wallpaper-advertising-layout').boundingBox();
        expect(centre!.width).toBe(1280);
        for (const side of ['left', 'right']) {
          const box = await page.locator(`.wallpaper-advertisement[data-side="${side}"]`).boundingBox();
          expect(box!.width).toBe(160); expect(box!.x).toBeGreaterThanOrEqual(32);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width - 32);
          expect(side === 'left' ? centre!.x - box!.x - box!.width : box!.x - centre!.x - centre!.width).toBe(24);
        }
      }
      if (locale === 'en' && [375, 1440, 1920].includes(width)) await page.screenshot({ path: testInfo.outputPath(`advertising-${width}.png`), fullPage: true });
    }
    expect(new Set(calls).size).toBe(6); expect(errors).toEqual([]);
  });

  test(`Yandex is installed once on public pages while homes and private routes stay excluded: ${locale}`, async ({ page }) => {
    const calls = await network(page, 'RU');
    for (const route of ['/', '/404/', '/admin/login/', '/ui-kit/']) {
      await page.goto(route.startsWith('/admin') || route === '/ui-kit/' ? route : localPath(locale, route));
      await expect(page.locator('.public-advertisements')).toHaveCount(0);
    }
    expect(calls).toEqual([]);
    for (const route of ['/search/', '/collections/', '/collections/contours-of-silence/', '/license/', '/cookies/', '/contact/', '/feedback/']) {
      calls.length = 0;
      await page.goto(localPath(locale, route)); await ready(page);
      await expect(page.locator('[data-test-yandex]')).toHaveCount(1);
      expect(calls).toEqual(['yandex:context', 'yandex:auto']);
      await expect(page.locator('script[data-page-id="20177169"]')).toHaveCount(1);
      await expect(page.locator('iframe[data-test-unit]')).toHaveCount(0);
    }
  });
}

for (const country of ['KZ', 'BY', 'US']) test(`only the selected network starts: ${country}`, async ({ page }) => {
  const calls = await network(page, country);
  await page.goto('/search/'); await ready(page);
  if (country === 'US') { await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1); expect(calls).toEqual([`adsterra:${adsterraUnits.leaderboard.key}`]); }
  else { await expect(page.locator('[data-test-yandex]')).toHaveCount(1); expect(calls).toEqual(['yandex:context', 'yandex:auto']); }
});

for (const country of ['DE', null]) test(`explicit advertising permission and withdrawal: ${country ?? 'unknown'}`, async ({ page }) => {
  const calls = await network(page, country);
  await page.goto('/search/'); await ready(page); expect(calls).toEqual([]);
  await allow(page); await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({ analytics: false, advertising: true });
  await page.evaluate(() => { (window as Window & { documentMarker?: boolean }).documentMarker = true; });
  await page.locator('[data-cookie-settings]').click();
  const reload = page.waitForEvent('domcontentloaded');
  await page.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click(); await reload; await ready(page);
  expect(await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)).toBeUndefined();
  expect(calls).toHaveLength(1); await expect(page.locator('iframe[data-test-unit]')).toHaveCount(0);
});

test('stored denial and cross-tab withdrawal stop further requests', async ({ page, context }) => {
  const calls = await network(page, 'US');
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, '{"analytics":true,"advertising":false}'); }, preferenceKey);
  await page.goto('/search/'); await ready(page); expect(calls).toEqual([]);
  await allow(page); await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  const second = await context.newPage(); await network(second, 'US'); await second.goto('/'); await ready(second);
  const reload = page.waitForEvent('domcontentloaded');
  await second.locator('[data-cookie-settings]').click();
  await second.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click(); await reload; await ready(page);
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(0); expect(calls).toHaveLength(1); await second.close();
});

for (const mode of ['error', 'empty']) test(`failed and empty placements keep native downloads available: ${mode}`, async ({ page }) => {
  const calls = await network(page, 'US', mode);
  await page.unroute('**/api/v1/**');
  await page.goto('/wallpapers/contours-of-silence-1/'); await ready(page);
  await expect.poll(() => calls.length).toBe(1);
  if (mode === 'empty') await page.waitForTimeout(10500);
  await expect(page.locator('.inline-advertisement:not([hidden]), .wallpaper-advertisement:not([hidden])')).toHaveCount(0);
  for (const variant of ['mobile', 'desktop'] as const) {
    await page.getByRole('tab', { name: copy.en[variant], exact: true }).click();
    const download = page.waitForEvent('download'); await page.locator('#download-link').click();
    expect((await download).suggestedFilename()).toBe(`contours-of-silence-1-${variant}.png`);
  }
  await expect(page.locator('h1')).toBeVisible(); expect(calls).toHaveLength(1);
  await page.getByRole('radio', { name: copy.en.plus, exact: true }).click();
  await expect(page.getByText(interfaceCopy.en.ratingSaved)).toBeVisible();
  await page.getByRole('textbox', { name: interfaceCopy.en.commentTitle, exact: true }).fill(`Advertisement ${mode} does not block comments.`);
  await page.getByRole('button', { name: copy.en.commentSubmit, exact: true }).click();
  await expect(page.getByText(`Advertisement ${mode} does not block comments.`, { exact: true })).toBeVisible();
  await page.goto('/search/?q=ice'); await ready(page);
  await expect(page.getByRole('searchbox')).toHaveValue('ice');
  await expect(page.locator('[data-wallpaper-card]').first()).toBeVisible();
});

test('Yandex navigation reloads, preserves variant and never gates downloads', async ({ page }) => {
  const calls = await network(page, 'RU');
  await page.goto('/wallpapers/contours-of-silence-1/?variant=mobile'); await ready(page);
  await expect(page.locator('[data-test-yandex]')).toHaveCount(1);
  await page.evaluate(() => { (window as Window & { documentMarker?: boolean }).documentMarker = true; });
  const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-mobile.png');
  await page.locator('[data-wallpaper-next]').click(); await ready(page);
  expect(page.url()).toContain('?variant=mobile#wallpaper-view');
  expect(await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)).toBeUndefined();
  await expect(page.locator('[data-test-yandex]')).toHaveCount(1); expect(calls).toHaveLength(4);
  await page.getByRole('link', { name: 'Want Wallpapers', exact: true }).first().click();
  await expect(page.locator('.public-advertisements, [data-test-yandex]')).toHaveCount(0); expect(calls).toHaveLength(4);
});

test('Adsterra survives client navigation and reloads when leaving advertising routes', async ({ page }) => {
  const calls = await network(page, 'US');
  await page.goto('/wallpapers/contours-of-silence-1/'); await ready(page);
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  await page.evaluate(() => { (window as Window & { documentMarker?: boolean }).documentMarker = true; });
  const previous = page.url();
  await page.locator('[data-wallpaper-next]').click();
  await expect.poll(() => page.url()).not.toBe(previous); await ready(page);
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)).toBe(true);
  expect(calls).toHaveLength(2);
  await page.getByRole('link', { name: 'Want Wallpapers', exact: true }).first().click();
  expect(await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)).toBeUndefined();
  await expect(page.locator('.public-advertisements')).toHaveCount(0); expect(calls).toHaveLength(2);
});


test('restoring a cached advertising document refreshes its privacy state', async ({ page }) => {
  const calls = await network(page, 'US');
  await page.goto('/wallpapers/contours-of-silence-1/'); await ready(page);
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  const reload = page.waitForEvent('domcontentloaded');
  await page.evaluate(key => {
    localStorage.setItem(key, '{"analytics":false,"advertising":false}');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, preferenceKey);
  await reload; await ready(page);
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(0); expect(calls).toHaveLength(1);
});


test('repeated initialization cannot cancel a pending Yandex loader', async ({ page }) => {
  await network(page, 'RU');
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route('https://yandex.ru/ads/system/context.js', async route => {
    started(); await pending;
    await route.fulfill({ contentType: 'text/javascript', body: 'window.testYandexContext = true;' }).catch(() => {});
  });
  await page.goto('/wallpapers/contours-of-silence-1/', { waitUntil: 'domcontentloaded' });
  await requested;
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  release();
  await expect(page.locator('[data-test-yandex]')).toHaveCount(1);
  await expect(page.locator('script[data-page-id="20177169"]')).toHaveCount(1);
});


test('Rust CSP permits selected providers only on known advertising documents', async ({ page, request }) => {
  for (const locale of locales) {
    for (const route of ['/wallpapers/contours-of-silence-1/', '/search/']) {
      const response = await request.get(localPath(locale, route));
      expect(response.status()).toBe(200);
      const policy = response.headers()['content-security-policy'];
      expect(policy).toContain('https://bauval.org'); expect(policy).toContain('https://yandex.ru');
      expect(policy).toContain("object-src 'none'"); expect(policy).toContain("frame-ancestors 'none'");
    }
    for (const route of ['/', '/404/', '/unknown/']) {
      const response = await request.get(localPath(locale, route));
      const policy = response.headers()['content-security-policy'];
      expect(policy).not.toContain('bauval.org'); expect(policy).not.toContain('yandex.ru');
      expect(policy).not.toContain("'unsafe-eval'"); expect(policy).not.toContain('script-src-elem');
    }
  }
  for (const route of ['/admin/login/', '/api/v1/catalog', '/ui-kit/']) {
    const policy = (await request.get(route)).headers()['content-security-policy'];
    expect(policy).not.toContain('bauval.org'); expect(policy).not.toContain('yandex.ru');
  }
  await network(page, 'US');
  const response = await page.goto('/search/'); await ready(page);
  expect(response!.headers()['content-security-policy']).toContain('https://bauval.org');
  await expect(page.locator('iframe[data-test-unit]')).toHaveCount(1);
  await page.evaluate(() => {
    const violations: string[] = [];
    Object.assign(window, { advertisingCspViolations: violations });
    document.addEventListener('securitypolicyviolation', event => violations.push(event.blockedURI));
    const script = document.createElement('script'); script.src = 'https://ads.invalid/unapproved.js'; document.head.append(script);
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'advertisingCspViolations'))).toContain('https://ads.invalid/unapproved.js');
});

test('without JavaScript native PNG bytes and filenames remain available', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    const calls = await network(page, 'US');
    await page.goto('/ja/wallpapers/contours-of-silence-1/');
    const url = page.url(), download = page.waitForEvent('download');
    await page.locator('a[download]').first().click();
    const saved = await download;
    expect(saved.suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
    expect(await readFile((await saved.path())!)).toEqual(await readFile(new URL('../../public/downloads/contours-of-silence-1-desktop.png', import.meta.url)));
    expect(page.url()).toBe(url); expect(calls).toEqual([]);
  } finally { await context.close(); }
});

test('blocked Yandex leaves the artwork and PNG download available', async ({ page }) => {
  const calls = await network(page, 'RU', 'error');
  await page.goto('/wallpapers/contours-of-silence-1/'); await ready(page);
  await expect.poll(() => calls).toEqual(['yandex:context']);
  await expect(page.locator('script[data-page-id="20177169"], iframe[data-test-unit]')).toHaveCount(0);
  await expect(page.locator('#wallpaper-view')).toBeVisible();
  const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
});

for (const country of ['RU', 'US']) test(`withdrawal during a pending provider script prevents later advertising: ${country}`, async ({ page }) => {
  const calls = await network(page, country);
  const scriptUrl = country === 'RU' ? 'https://yandex.ru/ads/system/context.js' : `https://bauval.org/22/${adsterraUnits.leaderboard.key}`;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await page.route(scriptUrl, async route => {
    requests.push(route.request().url()); await pending;
    await route.fulfill({ contentType: 'text/javascript', body: 'window.testLateAdvertising = true;' }).catch(() => {});
  });
  try {
    await page.goto('/wallpapers/contours-of-silence-1/', { waitUntil: 'domcontentloaded' }); await ready(page);
    await expect.poll(() => requests.length).toBe(1);
    await page.locator('[data-cookie-settings]').click();
    const reload = page.waitForEvent('domcontentloaded');
    await page.getByRole('dialog').getByRole('button', { name: copy.en.essentialOnly, exact: true }).click();
    await reload; await ready(page); release();
    await expect(page.locator('script[data-page-id="20177169"], iframe[data-test-unit]')).toHaveCount(0);
    expect(requests).toHaveLength(1); expect(calls).toEqual([]);
    expect(await page.evaluate(() => (window as Window & { testLateAdvertising?: boolean }).testLateAdvertising)).toBeUndefined();
  } finally { release(); }
});

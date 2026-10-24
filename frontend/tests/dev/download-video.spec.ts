import { test, expect } from '../browser';
import { fileURLToPath } from 'node:url';
import { hilltopVideoAdvertisement } from '../../src/lib/advertising-providers';
import { downloadCopy } from '../../src/data/download-copy';
import { locales } from '../../src/data/catalog';

const clip = fileURLToPath(new URL('../fixtures/advertisement.mp4', import.meta.url));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=', 'base64');
async function fixture(page: import('@playwright/test').Page, mode = 'ready', consent = true) {
  const calls: string[] = [], tracking: string[] = [];
  await page.context().route('https://**/*', route => route.abort());
  await page.context().route(hilltopVideoAdvertisement.src, async route => {
    calls.push(route.request().url());
    if (mode === 'blocked') { await route.abort(); return; }
    if (mode === 'pending') { await new Promise(resolve => setTimeout(resolve, 12000)); await route.fulfill({ body: '' }).catch(() => {}); return; }
    const origin = new URL(page.url()).origin;
    const duration = mode === 'tiny-duration' ? '00:00:00.0000000001' : mode === 'bad-duration' ? 'invalid' : '00:00:03';
    const body = mode === 'invalid' ? '<VAST><' : mode === 'empty' ? '<VAST version="3.0" />' : mode === 'wrapper'
      ? `<VAST version="3.0"><Ad><Wrapper><AdSystem>Fixture</AdSystem><VASTAdTagURI>${hilltopVideoAdvertisement.src}</VASTAdTagURI><Impression>${origin}/test-tracking/impression</Impression><Creatives /></Wrapper></Ad></VAST>`
      : `<VAST version="3.0"><Ad id="fixture"><InLine><AdSystem version="1">Fixture</AdSystem><AdTitle>Video fixture</AdTitle><Impression>${origin}/test-tracking/impression</Impression><Creatives><Creative><Linear><Duration>${duration}</Duration><TrackingEvents>${['start','complete','closeLinear'].map(event => `<Tracking event="${event}">${origin}/test-tracking/${event}</Tracking>`).join('')}</TrackingEvents><MediaFiles><MediaFile delivery="progressive" type="${mode === 'unsupported' ? 'application/javascript' : 'video/mp4'}" width="160" height="90">${origin}/test-advertisement.mp4</MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`;
    await route.fulfill({ contentType: 'application/xml', headers: { 'Access-Control-Allow-Origin': '*' }, body });
  });
  await page.route('**/test-advertisement.mp4', route => mode === 'media-error' ? route.abort() : route.fulfill({ contentType: 'video/mp4', path: clip }));
  await page.route('**/test-tracking/*', route => { tracking.push(new URL(route.request().url()).pathname.split('/').at(-1)!); return route.fulfill({ status: 204 }); });
  await page.route('**/downloads/fixture-*.png', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.addInitScript(allowed => {
    localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: allowed }));
    sessionStorage.setItem('want-country-v1', 'DE');
  }, consent);
  return { calls, tracking };
}
async function ready(page: import('@playwright/test').Page, query = '') {
  await page.goto(`/ui-kit/download-video/?enabled=true${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-country', 'DE');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test('disabled flag, denial and no JavaScript preserve native downloads without VAST', async ({ page, browser }) => {
  const { calls } = await fixture(page);
  await page.goto('/ui-kit/download-video/?enabled=false'); await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  let download = page.waitForEvent('download'); await page.locator('#download-link').click(); expect((await download).suggestedFilename()).toBe('fixture-desktop.png');
  await ready(page); await page.getByRole('button', { name: 'Deny advertising', exact: true }).click();
  download = page.waitForEvent('download'); await page.locator('#download-link').click(); await download;
  expect(calls).toEqual([]); await expect(page.getByRole('dialog')).toHaveCount(0);
  const context = await browser.newContext({ javaScriptEnabled: false }); const native = await context.newPage(); await fixture(native);
  await native.goto('http://127.0.0.1:4386/ui-kit/download-video/'); download = native.waitForEvent('download'); await native.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('fixture-desktop.png'); await context.close();
});

for (const locale of locales) test(`dismiss keeps the selected PNG, keyboard focus and responsive layout: ${locale}`, async ({ page }, info) => {
  const { calls, tracking } = await fixture(page); await ready(page, `&locale=${locale}`);
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  await page.locator('#download-link').focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: downloadCopy[locale].title, exact: true }); await expect(dialog).toBeVisible();
  await expect.poll(() => tracking.includes('impression')).toBe(true);
  await dialog.locator('video').evaluate((element: HTMLVideoElement) => element.pause());
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(16); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 16);
    if (locale === 'en' && [320, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`download-video-${width}.png`) });
  }
  const download = page.waitForEvent('download'); await page.keyboard.press('Escape');
  expect((await download).suggestedFilename()).toBe('fixture-mobile.png'); await expect(dialog).toHaveCount(0);
  await expect(page.locator('#download-link')).toBeFocused(); expect(calls).toHaveLength(1); expect(tracking).not.toContain('complete');
});

for (const mode of ['blocked','empty','invalid','unsupported','media-error','wrapper','bad-duration']) test(`${mode} falls back to exactly one PNG download`, async ({ page }) => {
  const { calls } = await fixture(page, mode); await ready(page);
  const downloads: string[] = []; page.on('download', item => downloads.push(item.suggestedFilename()));
  await page.locator('#download-link').click(); await expect.poll(() => downloads).toEqual(['fixture-desktop.png']);
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(calls.length).toBeGreaterThan(0); expect(calls.length).toBeLessThanOrEqual(6);
});

for (const mode of ['ready', 'tiny-duration']) test(`completion records an actual view and downloads once: ${mode}`, async ({ page }) => {
  const { calls, tracking } = await fixture(page, mode); await ready(page);
  const download = page.waitForEvent('download'); await page.locator('#download-link').click();
  await expect.poll(() => tracking.includes('impression')).toBe(true);
  expect((await download).suggestedFilename()).toBe('fixture-desktop.png'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls).toHaveLength(1);
  for (const event of ['impression', 'start', 'complete']) expect(tracking.filter(item => item === event)).toHaveLength(1);
});

test('pending video can be dismissed immediately without duplicate dialogs or late playback', async ({ page }) => {
  const { calls, tracking } = await fixture(page, 'pending'); await ready(page);
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  await page.locator('#download-link').click(); await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect.poll(() => calls.length).toBe(1);
  await page.getByRole('button', { name: 'Desktop', exact: true, includeHidden: true }).evaluate(element => (element as HTMLElement).click());
  await expect(page.getByRole('dialog').getByRole('link')).toHaveAttribute('href', '/downloads/fixture-mobile.png');
  await page.locator('#download-link').evaluate(element => (element as HTMLElement).click()); await expect(page.getByRole('dialog')).toHaveCount(1);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: downloadCopy.en.close, exact: true }).click(); expect((await download).suggestedFilename()).toBe('fixture-mobile.png');
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(calls.length).toBeLessThanOrEqual(1); expect(tracking).toEqual([]);
});

test('ten-second timeout and cross-tab withdrawal release the download', async ({ page, context }) => {
  await fixture(page, 'pending'); await ready(page); await page.clock.install();
  let download = page.waitForEvent('download'); await page.locator('#download-link').click(); await page.clock.fastForward(10001); await download;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#download-link').click(); await expect(page.getByRole('dialog')).toHaveCount(1);
  const second = await context.newPage(); await second.goto('http://127.0.0.1:4386/ui-kit/download-video/');
  download = page.waitForEvent('download'); await second.evaluate(() => localStorage.setItem('want-cookie-preferences-v2', '{"analytics":false,"advertising":false}')); await download;
  await expect(page.getByRole('dialog')).toHaveCount(0); await second.close();
});

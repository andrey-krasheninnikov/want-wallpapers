import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { CollectionCard } from '../../src/components/Gallery';
import { CoverMedia, CoverControl } from '../../src/components/CollectionCover';
import { collections, locales, type Locale } from '../../src/data/catalog';
import { interfaceCopy } from '../../src/data/interface-copy';

const videoUrl = 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/cover.mp4';
const image = { src: '/previews/cover-fixture.webp', width: 640, height: 512 };
const bytes = await readFile(new URL('../fixtures/covers/valid.mp4', import.meta.url));
const poster = await sharp(await readFile(new URL('../../public/previews/contours-of-silence-1-desktop.webp', import.meta.url))).resize(640, 512, { fit: 'cover' }).webp().toBuffer();
async function fixture(page: Page, locale: Locale, kind = 'card', fail = false) {
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  const collection = collections[0]!;
  const markup = kind === 'card'
    ? renderToStaticMarkup(<div className="gallery-grid"><CollectionCard item={{ href: '/collections/contours-of-silence/', title: collection.title[locale], description: collection.description[locale], countLabel: '15', image, video: videoUrl, locale }} headingLevel={2} /></div>)
    : renderToStaticMarkup(<figure className="relative" data-collection-cover><CoverMedia image={image} alt={collection.description[locale]} src={videoUrl} priority /><CoverControl locale={locale} /></figure>);
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'DE' } }));
  await page.route('**/previews/cover-fixture.webp', (route) => route.fulfill({ contentType: 'image/webp', body: poster }));
  await page.route(videoUrl, (route) => route.fulfill(fail ? { status: 500 } : { contentType: 'video/mp4', body: bytes }));
  // Only the CDN boundary and HTML fixture change; components, CSS and playback code are real.
  await page.route('http://127.0.0.1:4322/**', async (route) => {
    if (route.request().resourceType() !== 'document') { await route.fallback(); return; }
    const response = await route.fetch();
    const html = (await response.text()).replace('</main>', `<section class="shell mt-8" data-testid="cover-fixture">${markup}</section></main>`);
    await route.fulfill({ response, body: html });
  });
}
test.use({ reducedMotion: 'no-preference' });
for (const locale of locales) {
  test(`${locale}: cover cards and collection media require keyboard activation and preserve responsive layout`, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    const prefix = locale === 'en' ? '' : `/${locale}`;
    for (const path of ['/', '/collections/', '/collections/contours-of-silence/']) {
      await page.unrouteAll({ behavior: 'wait' });
      await fixture(page, locale, path.endsWith('contours-of-silence/') ? 'page' : 'card');
      await page.goto(prefix + path);
      expect(await page.title()).toContain('Want Wallpapers');
      const cover = page.getByTestId('cover-fixture'), video = cover.locator('video');
      await cover.scrollIntoViewIfNeeded();
      await expect(video).toBeHidden();
      await expect(video).not.toHaveAttribute('src');
      await cover.getByRole('button', { name: interfaceCopy[locale].playCover }).press('Enter');
      await expect(video).toBeVisible();
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
      expect(await video.evaluate((element: HTMLVideoElement) => element.muted && element.loop && element.playsInline)).toBe(true);
      const control = cover.getByRole('button', { name: interfaceCopy[locale].pauseCover });
      expect(await control.evaluate((element) => element.closest('a'))).toBeNull();
      await control.focus(); await page.keyboard.press('Enter');
      await expect(video).toBeHidden();
      await page.evaluate(() => scrollTo(0, 0)); await cover.scrollIntoViewIfNeeded();
      await expect(cover.getByRole('button', { name: interfaceCopy[locale].playCover })).toBeVisible();
      expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await cover.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (width === 320 && path === '/collections/') await cover.screenshot({ path: testInfo.outputPath(`cover-${locale}-mobile.png`) });
      }
      expect((await new AxeBuilder({ page }).include('[data-testid="cover-fixture"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      await cover.screenshot({ path: testInfo.outputPath(`cover-${locale}-${path === '/' ? 'home' : path === '/collections/' ? 'list' : 'page'}.png`) });
    }
    expect(errors).toEqual([]);
  });
}
test('offscreen and reduced-motion covers never request video, including preference changes', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => { if (request.url() === videoUrl) requests.push(request.url()); });
  await fixture(page, 'en'); await page.goto('/collections/');
  const cover = page.getByTestId('cover-fixture'), video = cover.locator('video');
  await expect(video).not.toHaveAttribute('src'); expect(requests).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await cover.scrollIntoViewIfNeeded();
  await expect(cover.locator('img')).toBeVisible(); await expect(video).not.toHaveAttribute('src'); expect(requests).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(video).not.toHaveAttribute('src'); expect(requests).toHaveLength(0);
  await cover.getByRole('button', { name: interfaceCopy.en.playCover }).click();
  await expect(video).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(video).toBeHidden(); await expect(video).not.toHaveAttribute('src');
});
test('data-saving and unavailable video retain the static poster', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), { saveData: true }), configurable: true }); });
  await fixture(page, 'en'); await page.goto('/collections/');
  const cover = page.getByTestId('cover-fixture'); await cover.scrollIntoViewIfNeeded();
  await expect(cover.locator('video')).not.toHaveAttribute('src'); await expect(cover.locator('img')).toBeVisible();
});
test('video failure and unsupported playback retain the poster', async ({ page }) => {
  const failure = page.waitForResponse((response) => response.url() === videoUrl && response.status() === 500);
  await fixture(page, 'en', 'card', true); await page.goto('/collections/');
  const cover = page.getByTestId('cover-fixture'); await cover.scrollIntoViewIfNeeded();
  await cover.getByRole('button', { name: interfaceCopy.en.playCover }).click();
  await failure;
  await expect(cover.locator('video')).not.toHaveAttribute('src');
  await expect(cover.locator('[data-cover-control]')).toBeHidden(); await expect(cover.locator('video')).toBeHidden(); await expect(cover.locator('img')).toBeVisible();
  await page.addInitScript(() => { HTMLMediaElement.prototype.canPlayType = () => ''; });
  await page.reload(); await cover.scrollIntoViewIfNeeded(); await expect(cover.locator('video')).not.toHaveAttribute('src');
});
test('without JavaScript the SSR poster remains and no video is requested', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  const requests: string[] = []; page.on('request', (request) => { if (request.url() === videoUrl) requests.push(request.url()); });
  await fixture(page, 'en'); await page.goto('http://127.0.0.1:4322/collections/');
  const cover = page.getByTestId('cover-fixture'); await cover.scrollIntoViewIfNeeded();
  await expect(cover.locator('img')).toBeVisible(); await expect(cover.locator('video')).not.toHaveAttribute('src'); expect(requests).toHaveLength(0);
  await context.close();
});

test('leaving the viewport or hiding the page stops playback until another click', async ({ page }) => {
  await fixture(page, 'en'); await page.goto('/collections/');
  const cover = page.getByTestId('cover-fixture'), video = cover.locator('video');
  await cover.scrollIntoViewIfNeeded();
  await cover.getByRole('button', { name: interfaceCopy.en.playCover }).click();
  await expect(video).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(video).toBeHidden();
  await cover.scrollIntoViewIfNeeded();
  await expect(cover.getByRole('button', { name: interfaceCopy.en.playCover })).toBeVisible();
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await cover.getByRole('button', { name: interfaceCopy.en.playCover }).click();
  await expect(video).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(video).toBeHidden();
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(cover.getByRole('button', { name: interfaceCopy.en.playCover })).toBeVisible();
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await cover.getByRole('button', { name: interfaceCopy.en.playCover }).click();
  await expect(video).toBeVisible();
});

test('a rejected play request waits for another explicit press', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      this.dataset.playAttempts = String(Number(this.dataset.playAttempts || 0) + 1);
      return Promise.reject(new DOMException('Playback denied', 'NotAllowedError'));
    };
  });
  await fixture(page, 'en'); await page.goto('/collections/');
  const cover = page.getByTestId('cover-fixture'), video = cover.locator('video');
  await cover.scrollIntoViewIfNeeded();
  const play = cover.getByRole('button', { name: interfaceCopy.en.playCover });
  await play.click();
  await expect(video).toHaveAttribute('data-play-attempts', '1');
  await expect(video).toBeHidden();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(video).toHaveAttribute('data-play-attempts', '1');
  await play.click();
  await expect(video).toHaveAttribute('data-play-attempts', '2');
  await expect(cover.locator('img')).toBeVisible();
});

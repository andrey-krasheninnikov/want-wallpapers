import { test, expect } from '@playwright/test';
import { localPath } from '../../src/data/copy';

test.describe('pixel background', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })); } catch {} });
  });

  test('reading stays still while the background glow remains faint', async ({ page }) => {
    expect((await page.goto('/ru/'))?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 16, 25)');
    await expect(page.locator('h1')).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    const background = await page.evaluate(() => {
      const grid = getComputedStyle(document.body, '::before');
      const glow = getComputedStyle(document.body, '::after');
      const animation = document.getAnimations().find((item) => (item as CSSAnimation).animationName === 'want-pixel-glow');
      if (!animation) throw new Error('Background glow missing');
      animation.pause(); animation.currentTime = 12000;
      return { gridOpacity: grid.opacity, duration: glow.animationDuration, maxOpacity: getComputedStyle(document.body, '::after').opacity };
    });
    expect(background).toEqual({ gridOpacity: '0.12', duration: '24s', maxOpacity: '0.04' });
    const card = page.locator('.gallery-card').first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.media-frame')).toHaveCSS('animation-name', 'none');
    expect(await card.locator('.media-frame').evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none');
  });

  test('localized controls preserve pause and resume across pages', async ({ page }) => {
    const labels = [
      ['en', 'Pause background glow', 'Resume background glow'],
      ['ru', 'Остановить свечение фона', 'Включить свечение фона'],
      ['zh-cn', '暂停背景光效', '恢复背景光效'],
      ['pt-br', 'Pausar brilho de fundo', 'Retomar brilho de fundo'],
    ] as const;
    for (const [locale, pause, resume] of labels) {
      expect((await page.goto(localPath(locale, '/contact/')))?.status()).toBe(200);
      const root = page.locator('html');
      const control = page.locator('footer [data-background-toggle]');
      await expect(root).toHaveAttribute('data-background-motion', 'running');
      await expect(control).toHaveText(pause!);
      await control.click();
      await expect(root).toHaveAttribute('data-background-motion', 'paused');
      expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('paused');
      expect((await page.goto(localPath(locale, '/cookies/')))?.status()).toBe(200);
      await expect(root).toHaveAttribute('data-background-motion', 'paused');
      await expect(control).toHaveText(resume!);
      await control.focus();
      await control.press('Enter');
      await expect(root).toHaveAttribute('data-background-motion', 'running');
      expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('running');
    }
  });

  test('system motion and forced colors override motion without discarding the choice', async ({ page }) => {
    await page.goto('/ru/');
    const root = page.locator('html');
    const control = page.locator('footer [data-background-toggle]');
    await control.click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    await expect(control).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body, '::after').animationName)).toBe('none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(control).toHaveText('Включить свечение фона');
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    await control.click();
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(control).toBeHidden();
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').display)).toBe('none');
    await page.emulateMedia({ forcedColors: 'none' });
    await expect(root).toHaveAttribute('data-background-motion', 'running');
  });

  test('unavailable storage keeps the control usable', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage unavailable', 'SecurityError'); } }));
    await page.goto('/ru/');
    const control = page.locator('footer [data-background-toggle]');
    await control.click();
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'paused');
    await expect(control).toHaveText('Включить свечение фона');
    await control.click();
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    expect(errors).toEqual([]);
  });

  test('invalid stored values use the default without writing a preference', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('want-background-motion', 'invalid'));
    await page.goto('/ru/');
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('invalid');
  });

  test('visibility events pause and restore the glow', async ({ page }) => {
    await page.goto('/ru/');
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'paused');
    expect(await page.evaluate(() => getComputedStyle(document.body, '::after').animationPlayState)).toBe('paused');
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBeNull();
  });

  test('navigation and footer fit with 200% text in every locale', async ({ page }) => {
    for (const locale of ['en', 'ru', 'zh-cn', 'pt-br'] as const) {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect((await page.goto(localPath(locale, '/feedback/')))?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.locator('footer a[href="mailto:wallpapers@want.foundation"]')).toHaveText('wallpapers@want.foundation');
      }
    }
  });

  test('without JavaScript the pixel background stays static', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'no-preference', viewport: { width: 320, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/ru/', testInfo.project.use.baseURL).href);
      await expect(page.locator('footer [data-background-toggle]')).toBeHidden();
      expect(await page.evaluate(() => getComputedStyle(document.body, '::after').animationPlayState)).toBe('paused');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

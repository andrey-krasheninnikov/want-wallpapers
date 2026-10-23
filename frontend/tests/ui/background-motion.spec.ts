import { test, expect } from '../browser';
import { localPath } from '../../src/data/copy';
import { collections, wallpapers } from '../../src/data/catalog';

test.describe('gradient sphere background', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })); } catch {} });
  });

  test('reading stays still while one clipped sphere moves behind the page', async ({ page }) => {
    expect((await page.goto('/ru/'))?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 20, 20)');
    await expect(page.locator('h1')).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    const background = page.locator('.page-background');
    await expect(background).toHaveCount(1);
    await expect(background).toHaveAttribute('inert', '');
    await expect(background).toHaveCSS('position', 'fixed');
    await expect(background).toHaveCSS('pointer-events', 'none');
    await expect(background).toHaveCSS('overflow', 'hidden');
    const sphere = await background.locator(':scope > div').evaluate((element) => {
      const style = getComputedStyle(element);
      const animations = element.getAnimations({ subtree: true });
      const transforms = () => ['::before', '::after'].map((pseudo) => getComputedStyle(element, pseudo).transform);
      const positions = [0, 7000, 14000, 21000, 28000].map((time) => {
        for (const animation of animations) { animation.pause(); animation.currentTime = time; }
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, flows: transforms() };
      });
      return { duration: style.animationDuration, opacity: style.opacity, blur: style.filter,
        gradients: [style.backgroundImage, ...['::before', '::after'].map((pseudo) => getComputedStyle(element, pseudo).backgroundImage)],
        animations: animations.length, positions, width: innerWidth, height: innerHeight,
        properties: [...new Set(animations.flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().flatMap(Object.keys)))],
      };
    });
    expect(sphere.duration).toBe('28s');
    expect(sphere.opacity).toBe('0.28');
    expect(sphere.blur).toBe('blur(48px)');
    expect(sphere.animations).toBe(3);
    expect(sphere.gradients.every((gradient) => gradient.includes('radial-gradient'))).toBe(true);
    expect(sphere.properties.filter((property) => !['offset', 'computedOffset', 'easing', 'composite', 'transform'].includes(property))).toEqual([]);
    expect(Math.abs(sphere.positions[0]!.x - sphere.positions[2]!.x)).toBeGreaterThan(sphere.width * .45);
    expect(Math.abs(sphere.positions[0]!.y - sphere.positions[2]!.y)).toBeGreaterThan(sphere.height * .4);
    expect(sphere.positions[4]!.x).toBeCloseTo(sphere.positions[0]!.x);
    expect(sphere.positions[4]!.y).toBeCloseTo(sphere.positions[0]!.y);
    for (const index of [0, 1]) expect(sphere.positions[1]!.flows[index]).not.toBe(sphere.positions[0]!.flows[index]);
    expect(await page.evaluate(() => ['::before', '::after'].map((pseudo) => getComputedStyle(document.body, pseudo).content))).toEqual(['none', 'none']);
    const card = page.locator('.gallery-card').first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.media-frame')).toHaveCSS('animation-name', 'none');
    expect(await card.locator('.media-frame').evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none');
  });

  test('localized controls preserve pause and resume across pages', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const labels = [
      ['en', 'Pause background glow', 'Resume background glow'],
      ['ru', 'Остановить свечение фона', 'Включить свечение фона'],
      ['zh-cn', '暂停背景光效', '恢复背景光效'],
      ['pt-br', 'Pausar brilho de fundo', 'Retomar brilho de fundo'],
      ['ja', '背景の光を一時停止', '背景の光を再開'],
      ['ar', 'إيقاف توهج الخلفية', 'استئناف توهج الخلفية'],
    ] as const;
    for (const [locale, pause, resume] of labels) {
      expect((await page.goto(localPath(locale, '/contact/')))?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const root = page.locator('html');
      const control = page.locator('footer [data-background-toggle]');
      await expect(root).toHaveAttribute('data-background-motion', 'running');
      await expect(root).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(control).toHaveText(pause!);
      await control.click();
      await expect(root).toHaveAttribute('data-background-motion', 'paused');
      expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('paused');
      expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['paused', 'paused', 'paused']);
      expect((await page.goto(localPath(locale, '/cookies/')))?.status()).toBe(200);
      await expect(root).toHaveAttribute('data-background-motion', 'paused');
      await expect(control).toHaveText(resume!);
      await control.focus();
      await control.press('Enter');
      await expect(root).toHaveAttribute('data-background-motion', 'running');
      expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('running');
      expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['running', 'running', 'running']);
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
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(control).toHaveText('Включить свечение фона');
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    await control.click();
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    await expect(control).toBeHidden();
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    await expect(page.locator('.page-background')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('running');
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
    await expect(root).toHaveAttribute('data-background-motion', 'running');
  });

  test('client navigation preserves the motion choice, element and every animation phase', async ({ page }) => {
    await page.goto(localPath('ru', `/wallpapers/${wallpapers[0]!.slug}/`));
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.locator('footer [data-background-toggle]').click();
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    const originalBackground = await page.locator('.page-background').elementHandle();
    await originalBackground!.evaluate((element) => {
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) animation.currentTime = 6500;
    });
    await page.evaluate(() => { (window as Window & { backgroundNavigation?: boolean }).backgroundNavigation = true; });
    const next = page.locator('[data-wallpaper-next]');
    const destination = new URL((await next.getAttribute('href'))!, page.url());
    await next.click();
    await expect(page).toHaveURL((url) => url.pathname === destination.pathname && url.search === destination.search);
    expect(await page.evaluate(() => (window as Window & { backgroundNavigation?: boolean }).backgroundNavigation)).toBe(true);
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    await expect(page.locator('.page-background')).toHaveCount(1);
    expect(await originalBackground!.evaluate((element) => element === document.querySelector('.page-background'))).toBe(true);
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) =>
      ({ time: animation.currentTime, state: animation.playState })))).toEqual(Array.from({ length: 3 }, () => ({ time: 6500, state: 'paused' })));
    await page.locator('footer [data-background-toggle]').click();
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.reload();
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('running');
  });

  for (const width of [320, 1440]) test(`public pages and motion fallbacks fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const routes = [
      ['home', '/ru/'],
      ['collection', localPath('ru', `/collections/${collections[0]!.slug}/`)],
      ['wallpaper', localPath('ru', `/wallpapers/${wallpapers[0]!.slug}/`)],
      ['reading', '/ru/privacy/'],
    ];
    for (const [name, route] of routes) {
      expect((await page.goto(route!))?.status()).toBe(200);
      await expect(page.locator('.page-background')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const time of name === 'home' ? [0, 7000, 14000, 21000] : [0, 14000]) {
        const position = await page.locator('.page-background > div').evaluate((element, time) => {
          for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
          const rect = element.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, diameter: rect.width };
        }, time);
        if (name === 'home') {
          expect(position.diameter).toBeLessThanOrEqual(Math.min(width, 900) * .81);
          expect(position.x / width).toBeGreaterThan(width < 768 ? .3 : .2);
          expect(position.x / width).toBeLessThan(width < 768 ? .7 : .8);
          expect(position.y / 900).toBeGreaterThan(width < 768 ? .3 : .2);
          expect(position.y / 900).toBeLessThan(width < 768 ? .7 : .8);
        }
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${time}.png`) });
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('footer [data-background-toggle]')).toBeHidden();
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`reduced-motion-${width}.png`) });
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.page-background')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath(`forced-colors-${width}.png`) });
  });

  test('the development kit shares the living sphere and pause control', async ({ page }) => {
    expect((await page.goto('/ui-kit/'))?.status()).toBe(200);
    await expect(page.locator('.page-background > div')).toHaveCount(1);
    await expect(page.locator('.page-background > div')).toHaveCSS('animation-duration', '28s');
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['running', 'running', 'running']);
    await page.locator('[data-background-toggle]').click();
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['paused', 'paused', 'paused']);
  });

  test('administration has no decorative background', async ({ page }) => {
    expect((await page.goto('/admin/login/'))?.status()).toBe(200);
    await expect(page.locator('.page-background')).toHaveCount(0);
    expect(await page.evaluate(() => ['::before', '::after'].map((pseudo) => getComputedStyle(document.body, pseudo).content))).toEqual(['none', 'none']);
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

  test('visibility events pause and restore the sphere', async ({ page }) => {
    await page.goto('/ru/');
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'paused');
    expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['paused', 'paused', 'paused']);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBeNull();
  });

  test('navigation and footer fit with 200% text', async ({ page }) => {
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

  test('without JavaScript the sphere stays static', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'no-preference', viewport: { width: 320, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/ru/', testInfo.project.use.baseURL).href);
      await expect(page.locator('footer [data-background-toggle]')).toBeHidden();
      expect(await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => animation.playState))).toEqual(['paused', 'paused', 'paused']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

import { test, expect, type Page } from '../browser';
import { localPath } from '../../src/data/copy';
import { collections, wallpapers } from '../../src/data/catalog';

async function expectMotion(page: Page, expected: 'running' | 'paused') {
  const states = await page.locator('.page-background').evaluate(element => element.getAnimations({ subtree: true }).map(animation => animation.playState));
  expect(states.length).toBeGreaterThanOrEqual(2);
  expect(states.every(state => state === expected)).toBe(true);
}

test.describe('gradient sphere background', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0; try { localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })); } catch {} });
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
    await expect(background).toHaveCSS('position', 'absolute');
    await expect(background).toHaveCSS('pointer-events', 'none');
    await expect(background).toHaveCSS('overflow', 'hidden');
    const sphere = await background.locator(':scope > div').evaluate((element) => {
      const style = getComputedStyle(element);
      const animations = element.getAnimations({ subtree: true });
      const transforms = () => ['::before', '::after'].map((pseudo) => getComputedStyle(element, pseudo).transform);
      const positions = [0, .25, .5, .75, 1].map((progress) => {
        for (const animation of animations) { animation.pause(); animation.currentTime = progress * Number(animation.effect!.getComputedTiming().duration); }
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 + scrollY, flows: transforms() };
      });
      return { duration: style.animationDuration, opacity: style.opacity, blur: style.filter,
        gradients: [style.backgroundImage, ...['::before', '::after'].map((pseudo) => getComputedStyle(element, pseudo).backgroundImage)],
        animations: animations.length, positions, width: innerWidth, height: element.parentElement!.clientHeight,
        properties: [...new Set(animations.flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().flatMap(Object.keys)))],
      };
    });
    expect(parseFloat(sphere.duration)).toBeCloseTo(Math.max(28, sphere.height / 30));
    expect(sphere.opacity).toBe('0.12');
    expect(sphere.blur).toBe('blur(48px)');
    expect(sphere.animations).toBe(2);
    expect(sphere.gradients.slice(0, 2).every((gradient) => gradient.includes('radial-gradient'))).toBe(true);
    expect(sphere.gradients[2]).toContain('conic-gradient');
    expect(sphere.properties.filter((property) => !['offset', 'computedOffset', 'easing', 'composite', 'transform'].includes(property))).toEqual([]);
    expect(Math.abs(sphere.positions[0]!.x - sphere.positions[2]!.x)).toBeGreaterThan(sphere.width * .45);
    expect(Math.abs(sphere.positions[0]!.y - sphere.positions[2]!.y)).toBeGreaterThan(sphere.height * .8);
    expect(sphere.positions[4]!.x).toBeCloseTo(sphere.positions[0]!.x);
    expect(sphere.positions[4]!.y).toBeCloseTo(sphere.positions[0]!.y);
    expect(sphere.positions[1]!.flows[0]).not.toBe(sphere.positions[0]!.flows[0]);
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
      await expectMotion(page, 'paused');
      expect((await page.goto(localPath(locale, '/cookies/')))?.status()).toBe(200);
      await expect(root).toHaveAttribute('data-background-motion', 'paused');
      await expect(control).toHaveText(resume!);
      await control.focus();
      await control.press('Enter');
      await expect(root).toHaveAttribute('data-background-motion', 'running');
      expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBe('running');
      await expectMotion(page, 'running');
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
    const time = new Date('2026-10-24T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.goto(localPath('ru', `/wallpapers/${wallpapers[0]!.slug}/`));
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.clock.fastForward(8000);
    await expect(page.locator('.page-background')).toHaveAttribute('data-background-shimmer', '');
    await page.locator('footer [data-background-toggle]').click();
    await expect(root).toHaveAttribute('data-background-motion', 'paused');
    const originalBackground = await page.locator('.page-background').elementHandle();
    await originalBackground!.evaluate((element) => {
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * .25;
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
    const phases = await page.locator('.page-background').evaluate((element) => element.getAnimations({ subtree: true }).map((animation) =>
      ({ progress: Number(animation.currentTime) / Number(animation.effect!.getComputedTiming().duration), state: animation.playState })));
    expect(phases).toHaveLength(3);
    for (const phase of phases) { expect(phase.progress).toBeCloseTo(.25, 3); expect(phase.state).toBe('paused'); }
    await page.locator('footer [data-background-toggle]').click();
    await expect(root).toHaveAttribute('data-background-motion', 'running');
    await page.locator('.page-background').evaluate(element => element.getAnimations({ subtree: true }).find(animation => (animation as CSSAnimation).animationName === 'want-gradient-shimmer')!.finish());
    await expect(page.locator('.page-background')).not.toHaveAttribute('data-background-shimmer');
    await page.clock.fastForward(8000);
    await expect(page.locator('.page-background')).toHaveAttribute('data-background-shimmer', '');
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
      for (const progress of name === 'home' ? [0, .25, .5, .75] : [0, .5]) {
        const position = await page.locator('.page-background > div').evaluate((element, progress) => {
          for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = progress * Number(animation.effect!.getComputedTiming().duration); }
          const rect = element.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 + scrollY, height: element.parentElement!.clientHeight, diameter: rect.width };
        }, progress);
        if (name === 'home') {
          expect(position.diameter).toBeGreaterThan(width);
          expect(position.diameter).toBeLessThanOrEqual(width * 1.5);
          expect(position.x / width).toBeGreaterThan(width < 768 ? .3 : .2);
          expect(position.x / width).toBeLessThan(width < 768 ? .7 : .8);
          expect(position.y / position.height).toBeGreaterThan(.04);
          expect(position.y / position.height).toBeLessThan(.96);
        }
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${progress}.png`) });
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('footer [data-background-toggle]')).toBeHidden();
    await expect.poll(() => page.locator('.page-background').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`reduced-motion-${width}.png`) });
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.page-background')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath(`forced-colors-${width}.png`) });
  });

  test('the production build excludes the development kit', async ({ page }) => {
    expect((await page.goto('/ui-kit/'))?.status()).toBe(404);
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
    await expectMotion(page, 'paused');
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
    expect(await page.evaluate(() => localStorage.getItem('want-background-motion'))).toBeNull();
  });

  test('navigation and footer fit with 200% text', async ({ page }) => {
    for (const locale of ['en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar'] as const) {
      for (const width of [320, 375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect((await page.goto(localPath(locale, '/feedback/')))?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('data-background-motion', 'running');
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; return document.fonts.ready; });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${locale}: ${width}px at 200% text` }).toBe(true);
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
      await expectMotion(page, 'paused');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await context.close();
    }
  });
  test('document geometry preserves progress through scrolling and content resizing', async ({ page }) => {
    await page.goto('/ru/contact/');
    await page.locator('footer [data-background-toggle]').click();
    const read = () => page.locator('.page-background > div').evaluate(element => {
      const animation = element.getAnimations().find(item => (item as CSSAnimation).animationName === 'want-gradient-sphere')!;
      const duration = Number(animation.effect!.getComputedTiming().duration);
      const rect = element.getBoundingClientRect();
      return { height: element.parentElement!.clientHeight, y: rect.y + rect.height / 2 + scrollY, duration, progress: Number(animation.currentTime) / duration };
    });
    await page.locator('.page-background > div').evaluate(element => {
      const animation = element.getAnimations().find(item => (item as CSSAnimation).animationName === 'want-gradient-sphere')!;
      animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * .5;
    });
    const before = await read();
    expect(before.y / before.height).toBeCloseTo(.95, 3);
    for (const fraction of [0, .5, 1]) {
      await page.evaluate(fraction => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), fraction);
      expect((await read()).y).toBeCloseTo(before.y);
      expect((await read()).progress).toBeCloseTo(.5, 3);
    }
    await page.evaluate(() => {
      const spacer = document.createElement('div'); spacer.style.height = '1200px'; document.body.append(spacer);
    });
    await expect.poll(async () => (await read()).height).toBeGreaterThan(before.height + 1000);
    await expect.poll(async () => {
      const current = await read();
      return current.duration / 1000 - Math.max(28, current.height / 30);
    }).toBeCloseTo(0);
    const after = await read();
    expect(after.progress).toBeCloseTo(.5, 3);
    expect(after.y / after.height).toBeCloseTo(.95, 3);
  });

  test('random waves respect their delay, pause together and stop for motion preferences', async ({ page }) => {
    const time = new Date('2026-10-24T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.goto('/ru/contact/');
    const background = page.locator('.page-background');
    await page.clock.fastForward(7999);
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    await page.clock.fastForward(1);
    await expect(background).toHaveAttribute('data-background-shimmer', '');
    const wave = await background.evaluateHandle(element => element.getAnimations({ subtree: true }).find(animation => (animation as CSSAnimation).animationName === 'want-gradient-shimmer')!);
    expect(await wave.evaluate(animation => Number(animation.effect!.getComputedTiming().duration))).toBe(4000);
    await page.locator('footer [data-background-toggle]').click();
    await wave.evaluate(animation => { animation.currentTime = 2000; });
    await expectMotion(page, 'paused');
    await page.clock.fastForward(20000);
    expect(await wave.evaluate(animation => animation.currentTime)).toBe(2000);
    await expect(background).toHaveAttribute('data-background-shimmer', '');
    await page.locator('footer [data-background-toggle]').click();
    await expectMotion(page, 'running');
    await wave.evaluate(animation => animation.finish());
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    await page.clock.fastForward(7999);
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    await page.clock.fastForward(1);
    await expect(background).toHaveAttribute('data-background-shimmer', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    expect(await background.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.clock.fastForward(20000);
    await expect(background).not.toHaveAttribute('data-background-shimmer');
  });

  test('hidden tabs clear a pending wave and resume with one fresh delay', async ({ page }) => {
    const time = new Date('2026-10-24T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.goto('/ru/contact/');
    const background = page.locator('.page-background');
    await page.clock.fastForward(7000);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.fastForward(30000);
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.fastForward(7999);
    await expect(background).not.toHaveAttribute('data-background-shimmer');
    await page.clock.fastForward(1);
    await expect(background).toHaveAttribute('data-background-shimmer', '');
  });

});

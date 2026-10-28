import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../browser';

async function openHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await expect(page.locator('astro-island[ssr]:has(header)')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

test('system theme follows preferences until an explicit choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openHome(page);
  const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('want-theme'))).toBeNull();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toBeChecked();
  await toggle.click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

for (const width of [320, 1440]) {
  test(`light and dark themes remain readable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await openHome(page);
    const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
    await expect(toggle).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('want-theme'))).toBeNull();
    for (const theme of ['light', 'dark']) {
      await toggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(toggle).toBeChecked({ checked: theme === 'dark' });
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase())).toBe('#5962F0');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = await toggle.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(accessibility.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
      await page.reload();
      await expect(page.locator('astro-island[ssr]:has(header)')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(toggle).toBeChecked({ checked: theme === 'dark' });
    }
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
}

test('theme survives language selection and wallpaper client navigation', async ({ page }) => {
  await openHome(page);
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/$/);
  await expect(page.getByRole('switch', { name: 'Тёмная тема', exact: true })).not.toBeChecked();
  await page.goto('/ru/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]:has(header)')).toHaveCount(0);
  await expect(page.locator('astro-island[ssr]:has([data-wallpaper-next])')).toHaveCount(0);
  const next = page.locator('[data-wallpaper-next]');
  const href = await next.getAttribute('href');
  await next.click();
  const destination = new URL(href!, page.url()); destination.hash = '';
  await expect(page).toHaveURL(destination.href);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F6F5F3');
});

test('localized theme control fits beside language and menu in every locale', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const [path, name] of [
    ['/', 'Dark theme'], ['/ru/', 'Тёмная тема'], ['/zh-cn/', '深色主题'],
    ['/pt-br/', 'Tema escuro'], ['/ja/', 'ダークテーマ'], ['/ar/', 'المظهر الداكن'],
  ]) {
    await page.goto(path!);
    const toggle = page.getByRole('switch', { name, exact: true });
    await expect(toggle).toBeVisible();
    const bounds = await page.locator('.header-bar').boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('theme works without storage and reduced motion disables toggle animation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.locator('astro-island[ssr]:has(header)')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const duration = await page.locator('.theme-switch [data-slot="switch-thumb"]').evaluate(thumb => getComputedStyle(thumb).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(.00001);
  await page.goto('/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]:has(header)')).toHaveCount(0);
  await expect(page.locator('astro-island[ssr]:has([data-wallpaper-next])')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await page.evaluate(() => {
    document.addEventListener('astro:before-swap', () => Reflect.set(window, 'themeSwapSeen', true), { once: true });
  });
  const next = page.locator('[data-wallpaper-next]');
  const href = await next.getAttribute('href');
  await next.click();
  const destination = new URL(href!, page.url()); destination.hash = '';
  await expect(page).toHaveURL(destination.href);
  expect(await page.evaluate(() => Reflect.get(window, 'themeSwapSeen'))).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

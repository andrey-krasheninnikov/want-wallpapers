import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { copy, localPath } from '../../src/data/copy';
import { interfaceCopy } from '../../src/data/interface-copy';
import type { Locale } from '../../src/data/catalog';

const preferenceKey = 'want-cookie-preferences-v2';
async function openSettings(page: Page) {
  const trigger = page.locator('[data-cookie-settings]');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.click();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'DE' } }));
});

for (const locale of ['ru', 'en', 'zh-cn', 'pt-br'] as Locale[]) {
  test(`independent preferences, keyboard focus and responsive dialog: ${locale}`, async ({ page }, testInfo) => {
    const ui = copy[locale], text = interfaceCopy[locale];
    await page.goto(localPath(locale, '/'));
    await expect(page.getByRole('button', { name: ui.acceptAll, exact: true })).toBeVisible();
    for (const [width, analytics, advertising] of [[320, false, true], [768, true, false], [1024, true, true], [1440, false, false]] as const) {
      await page.setViewportSize({ width, height: 900 });
      const banner = page.getByRole('region', { name: ui.cookieSettings, exact: true });
      if (await banner.isVisible()) await banner.getByRole('button', { name: ui.cookieSettings, exact: true }).click();
      else await openSettings(page);
      const dialog = page.getByRole('dialog', { name: ui.cookieSettings });
      const necessary = dialog.getByRole('switch', { name: text.necessary, exact: true });
      await expect(necessary).toBeChecked(); await expect(necessary).toBeDisabled();
      for (const [name, checked] of [[ui.analyticsLabel, analytics], [ui.advertisingLabel, advertising]] as const) {
        const control = dialog.getByRole('switch', { name, exact: true });
        await expect(control).toBeEnabled();
        if (await control.getAttribute('aria-checked') !== String(checked)) {
          await control.focus(); await page.keyboard.press('Space');
        }
        await expect(control).toHaveAttribute('aria-checked', String(checked));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      if (locale === 'ru' && [320, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`cookie-dialog-${width}.png`) });
      await dialog.getByRole('button', { name: text.save, exact: true }).click();
      await expect(page.locator('[data-cookie-settings]')).toBeFocused();
      await page.reload();
      await openSettings(page);
      await expect(page.getByRole('switch', { name: ui.analyticsLabel, exact: true })).toHaveAttribute('aria-checked', String(analytics));
      await expect(page.getByRole('switch', { name: ui.advertisingLabel, exact: true })).toHaveAttribute('aria-checked', String(advertising));
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-cookie-settings]')).toBeFocused();
    }
  });
}

for (const [country, group, enabled] of [['RU', 'ru', true], ['KZ', 'kz', true], ['BY', 'by', true], ['GE', 'other', true], ['DE', 'eea', false], ['NO', 'eea', false]] as const) {
  test(`new visitor defaults and available social features: ${country}`, async ({ page }) => {
    await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: country.toLowerCase() } }));
    await page.goto('/ru/wallpapers/contours-of-silence-1/');
    await expect(page.locator('html')).toHaveAttribute('data-country', country);
    await expect(page.locator('html')).toHaveAttribute('data-country-group', group);
    await expect(page.locator('[data-social-panel]')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), preferenceKey)).toBeNull();
    await page.getByRole('region', { name: copy.ru.cookieSettings }).getByRole('button', { name: copy.ru.cookieSettings, exact: true }).click();
    for (const name of [copy.ru.analyticsLabel, copy.ru.advertisingLabel]) await expect(page.getByRole('switch', { name, exact: true })).toHaveAttribute('aria-checked', String(enabled));
    await page.getByRole('dialog').getByRole('button', { name: copy.ru.essentialOnly, exact: true }).click();
    await expect(page.getByRole('radio', { name: copy.ru.plus, exact: true })).toBeEnabled();
  });
}

for (const [legacy, analytics] of [['essential', false], ['analytics', true]] as const) {
  test(`legacy migration preserves the ${legacy} choice and refuses advertising`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('want-cookie-choice-v1', value);
      sessionStorage.setItem('want-region-v1', 'open');
    }, legacy);
    await page.goto('/ru/');
    await openSettings(page);
    await expect(page.getByRole('switch', { name: copy.ru.analyticsLabel, exact: true })).toHaveAttribute('aria-checked', String(analytics));
    await expect(page.getByRole('switch', { name: copy.ru.advertisingLabel, exact: true })).not.toBeChecked();
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({ analytics, advertising: false });
  });
}

test('allow all stores both choices and withdrawal persists in another tab', async ({ page, context }) => {
  const optional: string[] = [];
  page.on('request', (request) => { if (/google-analytics|googletagmanager|firebaseinstallations/.test(request.url())) optional.push(request.url()); });
  await page.goto('/ru/');
  await page.getByRole('button', { name: 'разрешить все', exact: true }).click();
  const second = await context.newPage();
  await second.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'DE' } }));
  await second.goto('/ru/');
  await openSettings(second);
  await second.getByRole('dialog').getByRole('button', { name: copy.ru.essentialOnly, exact: true }).click();
  await openSettings(page);
  await expect(page.getByRole('switch', { name: copy.ru.analyticsLabel, exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: copy.ru.advertisingLabel, exact: true })).not.toBeChecked();
  expect(optional).toEqual([]);
});

test('country timeout never delays feedback and unknown results still allow an explicit choice', async ({ page }) => {
  await page.route('https://ipwho.is/**', () => {});
  await page.goto('/ru/feedback/');
  await page.locator('#feedback-topic').fill('Проверка доступности');
  await page.locator('#feedback-message').fill('Форма работает до окончания проверки страны.');
  await expect(page.locator('html')).toHaveAttribute('data-country', 'unknown', { timeout: 10000 });
  await expect(page.locator('#feedback-message')).toHaveValue('Форма работает до окончания проверки страны.');
  await page.getByRole('button', { name: copy.ru.acceptAll, exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({ analytics: true, advertising: true });
  await expect(page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true })).toBeEnabled();
});

test('private pages ignore previously enabled optional preferences', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{"analytics":true,"advertising":true}'), preferenceKey);
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('/admin/login/');
  await expect(page.getByRole('heading', { name: 'Вход в управление' })).toBeVisible();
  expect(requests.some((url) => /ipwho|google-analytics|googletagmanager|firebase/.test(url))).toBe(false);
});

test('cookie settings link advertises a dialog only after its handler mounts', async ({ page }) => {
  let resume!: () => void;
  const hydration = new Promise<void>((resolve) => { resume = resolve; });
  await page.route('**/_astro/*.js', async (route) => { await hydration; await route.continue(); });
  try {
    await page.goto('/ru/', { waitUntil: 'commit' });
    const trigger = page.locator('[data-cookie-settings]');
    await expect(trigger).toHaveAttribute('href', '/ru/cookies/');
    await expect(trigger).not.toHaveAttribute('aria-haspopup', 'dialog');
  } finally { resume(); }
  await openSettings(page);
  await expect(page.getByRole('dialog', { name: copy.ru.cookieSettings })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cookie-settings]')).toBeFocused();
});

import { test, expect, type Page } from '@playwright/test';
import { copy } from '../../src/data/copy';

async function enable(page: Page) {
  await page.route('**/api/v1/recaptcha/config', (route) => route.fulfill({ json: { enabled: true, siteKey: 'test-web-site-key' } }));
}
const sdk = `window.grecaptcha = { enterprise: { ready(callback) { callback(); }, async execute(key, options) { window.captchaCalls ??= []; window.captchaCalls.push(options.action); return options.action + '-' + window.captchaCalls.length; } } };`;

test('reading, downloads and Russian feedback do not load reCAPTCHA before a protected action', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await enable(page);
  await page.goto('/ru/wallpapers/contours-of-silence-1/');
  await page.getByRole('button', { name: copy.ru.essentialOnly, exact: true }).click();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'RU' } }));
  await page.evaluate(() => sessionStorage.removeItem('want-country-v1'));
  await page.goto('/ru/feedback/');
  await expect(page.locator('#feedback-message')).toBeVisible();
  expect(requests.filter((url) => /recaptcha/.test(url))).toEqual([]);
});

test('feedback retries a blocked script and a rejected assessment without losing input', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route('https://ipwho.is/**', (route) => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await enable(page);
  let scripts = 0;
  await page.route('https://www.google.com/recaptcha/enterprise.js?*', (route) => {
    scripts++;
    return scripts === 1 ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: sdk });
  });
  const tokens: string[] = [];
  await page.route('**/api/v1/feedback', async (route) => {
    tokens.push(route.request().headers()['x-recaptcha-token']!);
    expect(route.request().headers()['x-csrf-token']).toBeTruthy();
    await route.fulfill(tokens.length === 1 ? { status: 403, json: { error: { code: 'recaptcha-rejected' } } } : { json: {} });
  });
  await page.goto('/ru/feedback/');
  await page.getByRole('button', { name: copy.ru.essentialOnly, exact: true }).click();
  await expect(page).toHaveTitle(/Want/);
  await page.locator('#feedback-topic').fill('Проверка защиты');
  await page.locator('#feedback-message').fill('Сообщение сохраняется после ошибки проверки.');
  expect(scripts).toBe(0);
  const submit = page.getByRole('button', { name: copy.ru.feedbackSubmit, exact: true });
  await submit.click();
  await expect(page.getByText(copy.ru.recaptchaUnavailable, { exact: true })).toBeVisible();
  expect(tokens).toEqual([]);
  await submit.click();
  await expect(page.getByText(copy.ru.recaptchaRejected, { exact: true })).toBeVisible();
  await expect(page.locator('#feedback-message')).toHaveValue('Сообщение сохраняется после ошибки проверки.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('recaptcha-retry-320.png'), fullPage: true });
  await submit.click();
  await expect(page.getByText(copy.ru.feedbackThanks)).toBeVisible();
  expect(tokens).toEqual(['feedback-1', 'feedback-2']);
  expect(scripts).toBe(2);
  await expect(page.locator('#feedback-message')).toHaveValue('');
});

test('admin login requests its own action independently of regional lookup', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await enable(page);
  await page.route('https://www.google.com/recaptcha/enterprise.js?*', (route) => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  let token = '';
  await page.route('**/api/v1/admin/login', async (route) => {
    token = route.request().headers()['x-recaptcha-token']!;
    await route.fulfill({ status: 503, json: { error: { code: 'recaptcha-unavailable' } } });
  });
  await page.goto('/admin/login/');
  await expect(page.getByRole('heading', { name: 'Вход в управление' })).toBeVisible();
  expect(requests.some((url) => /recaptcha/.test(url))).toBe(false);
  await page.getByLabel('Логин', { exact: true }).fill('admin');
  await page.getByLabel('Пароль', { exact: true }).fill('test-only-password');
  await page.getByLabel('Код аутентификатора').fill('123456');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText(copy.ru.recaptchaUnavailable, { exact: true })).toBeVisible();
  expect(token).toBe('admin_login-1');
  await expect(page.getByLabel('Логин', { exact: true })).toHaveValue('admin');
  expect(requests.some((url) => /ipwho|google-analytics|googletagmanager/.test(url))).toBe(false);
});

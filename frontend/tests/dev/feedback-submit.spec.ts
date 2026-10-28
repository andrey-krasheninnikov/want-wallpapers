import { test, expect, type Locator, type Page } from '../browser';
import AxeBuilder from '@axe-core/playwright';
import { copy, localPath } from '../../src/data/copy';
import type { Locale } from '../../src/data/catalog';

type Presentation = 'page' | 'dialog';
const presentations: Presentation[] = ['page', 'dialog'];

async function openForm(page: Page, locale: Locale, presentation: Presentation) {
  await page.goto(localPath(locale, presentation === 'page' ? '/feedback/' : '/collections/'));
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
  if (presentation === 'dialog') {
    const desktopLink = page.locator('header a').filter({ hasText: copy[locale].feedback }).first();
    if (!await desktopLink.isVisible()) await page.locator('[data-menu-trigger]').click();
    await page.getByRole('link', { name: copy[locale].feedback, exact: true }).click();
    await expect(page.getByRole('dialog', { name: copy[locale].feedback, exact: true })).toBeVisible();
  }
  const form = page.locator('.feedback-form:visible');
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  return form;
}

async function expectFullWidth(form: Locator) {
  const geometry = await form.evaluate(element => {
    const button = element.querySelector('button[type="submit"]')!.getBoundingClientRect();
    const field = element.querySelector('input[name="topic"]')!.getBoundingClientRect();
    const privacy = element.querySelector('.feedback-private')!.getBoundingClientRect();
    const notice = element.querySelector('.feedback-footer > p')!.getBoundingClientRect();
    const surface = element.closest('[role="dialog"]') ?? element;
    const frame = surface.getBoundingClientRect();
    return {
      left: Math.abs(button.left - field.left), right: Math.abs(button.right - field.right),
      privacyGap: privacy.top - button.bottom, noticeGap: notice.top - privacy.bottom,
      leftPadding: button.left - frame.left, rightPadding: frame.right - button.right,
      height: button.height, fits: element.scrollWidth <= element.clientWidth,
    };
  });
  expect(geometry.left).toBeLessThanOrEqual(1);
  expect(geometry.right).toBeLessThanOrEqual(1);
  expect(geometry.privacyGap).toBeGreaterThanOrEqual(15);
  expect(geometry.noticeGap).toBeGreaterThanOrEqual(15);
  expect(geometry.leftPadding).toBeGreaterThanOrEqual(19);
  expect(geometry.rightPadding).toBeGreaterThanOrEqual(19);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.fits).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.route('**/api/v1/session', route => route.fulfill({ json: { csrf: 'local-feedback-csrf', uid: 'local-feedback-visitor' } }));
  await page.route('**/api/v1/recaptcha/config', route => route.fulfill({ json: { enabled: false, siteKey: null } }));
});

for (const locale of ['en', 'ar'] as const) for (const width of [320, 768, 1024, 1440]) {
  test(`feedback button fills both forms: ${locale} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    for (const presentation of presentations) {
      const form = await openForm(page, locale, presentation);
      await expectFullWidth(form);
      await form.locator('textarea').focus();
      await page.keyboard.press('Tab');
      const button = form.locator('button[type="submit"]');
      await expect(button).toBeFocused();
      await expect(button).toHaveCSS('outline-color', 'rgb(89, 98, 240)');
      await expect(button).toHaveCSS('outline-style', 'solid');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 320 || width === 1440) await page.screenshot({ path: info.outputPath(`${presentation}-${locale}-${width}.png`), fullPage: true });
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

for (const [locale, width] of [['en', 320], ['ar', 1440]] as const) for (const presentation of presentations) {
  test(`feedback keeps loading, retry and result states: ${locale} ${presentation}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const form = await openForm(page, locale, presentation), ui = copy[locale];
    const topic = form.getByLabel(ui.topic, { exact: true });
    const message = form.getByLabel(ui.message, { exact: true });
    const submit = form.locator('button[type="submit"]');
    let requests = 0;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/feedback', async route => {
      requests++;
      if (requests === 1) {
        await pending;
        await route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } });
      } else await route.fulfill({ json: { ok: true } });
    });
    await submit.click();
    await expect(topic).toBeFocused();
    expect(requests).toBe(0);
    await topic.fill('Gallery feedback');
    await message.fill('Please keep this message while sending.');
    if (presentation === 'dialog') {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const menu = page.locator('[data-menu-trigger]');
      if (await menu.isVisible()) { await expect(menu).toBeFocused(); await menu.click(); }
      else await expect(page.getByRole('link', { name: ui.feedback, exact: true })).toBeFocused();
      await page.getByRole('link', { name: ui.feedback, exact: true }).click();
      await expect(message).toHaveValue('Please keep this message while sending.');
    }
    try {
      await submit.click();
      await expect(submit).toBeDisabled();
      await expect(submit).toHaveText(ui.loading);
      await expect(form.locator('form')).toHaveAttribute('aria-busy', 'true');
      await expectFullWidth(form);
    } finally { release(); }
    await expect(form).toContainText(ui.serviceError);
    await expect(submit).toBeEnabled();
    await expect(message).toHaveValue('Please keep this message while sending.');
    await submit.click();
    await expect(form.getByRole('status')).toContainText(ui.feedbackThanks);
    await expect(message).toHaveValue('');
    await expect(submit).toBeEnabled();
    await expectFullWidth(form);
    expect(requests).toBe(2);
  });
}

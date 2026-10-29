import { test, expect } from '../browser';
import AxeBuilder from '@axe-core/playwright';
import { localPath } from '../../src/data/copy';
import { locales } from '../../src/data/catalog';

const address = 'wallpapers@want.foundation';
const href = `mailto:${address}`;
const paths = ['/contact/', '/privacy/', '/terms/'];
const labels = { en: 'Email', ru: 'Почта', 'zh-cn': '邮箱', 'pt-br': 'Email', ja: 'メール', ar: 'البريد الإلكتروني' };
const destinations = [
  'https://t.me/andrey_krasheninnikov',
  'https://t.me/want_foundation',
  'https://github.com/andrey-krasheninnikov',
  'https://github.com/andrey-krasheninnikov/want-wallpapers',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
});

for (const locale of locales) for (const width of [320, 1440]) {
  test(`public email contact: ${locale}, ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(localPath(locale, path));
      await page.evaluate(() => document.fonts.ready);
      const owner = page.locator('[data-owner-contact]');
      const email = owner.getByRole('link', { name: `${labels[locale]} ${address}`, exact: true });
      await expect(owner.locator('a')).toHaveCount(5);
      await expect(email).toBeVisible();
      await expect(email).toHaveAttribute('href', href);
      expect(await email.getAttribute('target')).toBeNull();
      expect(await email.getAttribute('rel')).toBeNull();
      const detail = email.locator('small');
      await expect(detail).toHaveText(address);
      expect((await email.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await email.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      for (const destination of destinations) {
        const link = owner.locator(`a[href="${destination}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
      for (const direction of ['ltr', 'rtl']) {
        await owner.evaluate((element, value) => element.setAttribute('dir', value), direction);
        await expect(detail).toHaveCSS('direction', 'ltr');
        const dimensions = await detail.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }));
        expect(dimensions.scrollWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width + 1);
        expect(dimensions.scrollHeight, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.height + 1);
        expect(await detail.evaluate(element => getComputedStyle(element).userSelect)).not.toBe('none');
        const selected = await detail.evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range);
          const text = selection.toString();
          selection.removeAllRanges();
          return text;
        });
        expect(selected).toBe(address);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await owner.evaluate(element => element.removeAttribute('dir'));
      await owner.locator('a').nth(3).focus();
      await page.keyboard.press('Tab');
      await expect(email).toBeFocused();
      await expect(email).toHaveCSS('outline-width', '2px');
      await expect(email).toHaveCSS('outline-color', 'rgb(89, 98, 240)');
      await email.evaluate(link => link.addEventListener('click', event => {
        link.setAttribute('data-activation', `${event.isTrusted}:${event.defaultPrevented}:${link.getAttribute('href')}`);
        // Avoid opening the local mail application during the test.
        event.preventDefault();
      }, { once: true }));
      await page.keyboard.press('Enter');
      await expect(email).toHaveAttribute('data-activation', `true:false:${href}`);
      expect(page.context().pages()).toHaveLength(1);
      expect((await new AxeBuilder({ page }).include('[data-owner-contact]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      if (['en', 'ar'].includes(locale) && path === '/contact/') await owner.screenshot({ path: testInfo.outputPath(`contact-${locale}-${width}.png`) });
    }
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('public email contact remains a native link in every locale', async ({ page }) => {
    for (const locale of locales) for (const path of paths) {
      await page.goto(localPath(locale, path));
      const email = page.locator(`[data-owner-contact] a[href="${href}"]`);
      await expect(email).toBeVisible();
      await expect(email.locator('small')).toHaveText(address);
      expect(await email.getAttribute('target')).toBeNull();
    }
  });
});

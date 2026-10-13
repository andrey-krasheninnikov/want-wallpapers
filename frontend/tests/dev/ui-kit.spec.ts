import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'no-preference' });

for (const width of [320, 1440]) test(`UI-kit variants and interactions: ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ui-kit/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'UI kit', exact: true })).toBeVisible();
  await page.getByLabel('Wallpaper title', { exact: true }).fill('Violet Horizon');
  await page.getByRole('button', { name: 'Save example', exact: true }).click();
  await expect(page.getByText('Example saved locally.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Collection', exact: true }).click();
  await page.getByRole('option', { name: 'Woven Spectrum', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toContainText('Woven Spectrum');
  await page.getByRole('switch', { name: 'Enable example setting', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Enable example setting', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Mobile', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Mobile', exact: true })).toBeChecked();
  await page.getByRole('tab', { name: 'Mobile', exact: true }).click();
  await expect(page.getByText('Portrait wallpaper preview.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'How do downloads work?', exact: true }).press('Enter');
  await expect(page.getByText('Original PNG downloads use a native download link.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Wallpaper details', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Wallpaper details', exact: true })).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Open sheet', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Collection navigation', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Collection navigation', exact: true })).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open sheet', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  const button = page.getByRole('button', { name: 'Save example', exact: true });
  await page.keyboard.press('Tab');
  await button.focus();
  await expect(button).toHaveCSS('background-color', 'rgb(91, 79, 255)');
  await expect(button).toHaveCSS('outline-color', 'rgb(91, 79, 255)');
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('border-width', '0px');
  for (const label of ['Wallpaper title', 'Description', 'Invalid example']) {
    const field = page.getByLabel(label, { exact: true });
    await field.focus();
    await expect(field).toHaveCSS('color', 'rgb(232, 232, 232)');
    await expect(field).toHaveCSS('outline-width', '2px');
    const background = await field.evaluate(element => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe('rgb(232, 232, 232)');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(`ui-kit-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});

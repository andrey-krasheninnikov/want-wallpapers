import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { database, secretDirectory } from './database';
function totp() {
  const encoded = readFileSync(join(secretDirectory, 'ui_admin_totp'), 'utf8').trim();
  const bits = [...encoded.replaceAll('=', '')].map((char) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char).toString(2).padStart(5, '0')).join('');
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', bytes).update(counter).digest(), offset = hash[19]! & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
test.use({ trace: 'off', screenshot: 'off' });

test('private routes require login and never load regional lookup or analytics', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  const response = await page.goto('/admin/');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page).toHaveURL(/\/admin\/login\/$/);
  await expect(page.getByRole('heading', { name: 'Вход в управление' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(requests.some((url) => /ipwho|google-analytics|googletagmanager|firebase/.test(url))).toBe(false);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
test('administrator edits translations, creates CDN records, archives and moderates', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const visitor = crypto.randomUUID(), comment = crypto.randomUUID(), feedback = crypto.randomUUID();
  await database`INSERT INTO visitors(id) VALUES(${visitor})`;
  await database`INSERT INTO comments(id,wallpaper_id,visitor_id,text) VALUES(${comment},'contours-of-silence-11',${visitor},'Комментарий для проверки модерации')`;
  await database`INSERT INTO reports(id,comment_id,visitor_id) VALUES(${crypto.randomUUID()},${comment},${visitor})`;
  await database`INSERT INTO feedback(id,visitor_id,topic,message,email) VALUES(${feedback},${visitor},'Обращение для проверки','Сообщение для проверки интерфейса','ui@example.test')`;
  await page.goto('/admin/login/');
  await page.getByLabel('Логин', { exact: true }).fill('admin');
  await page.getByLabel('Пароль', { exact: true }).fill(readFileSync(join(secretDirectory, 'ui_admin_password'), 'utf8').trim());
  await page.getByLabel('Код аутентификатора').fill(totp());
  const login = page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const result = await login;
  expect(result.status(), result.ok() ? 'Administrator login' : await result.text()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/$/); await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменить Контуры тишины' })).toBeVisible();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`admin-catalog-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Номер папки CDN').fill('0009'); await page.getByLabel('Slug', { exact: true }).fill('ui-check');
  for (const language of ['English', 'Русский', '中文', 'Português']) {
    await page.getByRole('tab', { name: language, exact: true }).click();
    await page.getByLabel(`Название · ${language}`).fill(`UI check ${language}`); await page.getByLabel(`Описание · ${language}`).fill('Описание коллекции для проверки');
  }
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByRole('heading', { name: 'UI check Русский', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Изменить UI check Русский' }).click();
  await page.getByLabel('Название · Русский').fill('Коллекция для проверки');
  await page.route('**/api/v1/admin/catalog/collections', (route) => route.abort());
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Не удалось выполнить действие');
  await expect(page.getByLabel('Название · Русский')).toHaveValue('Коллекция для проверки');
  await page.unroute('**/api/v1/admin/catalog/collections'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Коллекция для проверки', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Архивировать Коллекция для проверки', exact: true }).click();
  await page.getByRole('button', { name: 'Архивировать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Коллекция для проверки', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Показать архив', exact: true }).click();
  await page.getByRole('button', { name: 'Восстановить Коллекция для проверки', exact: true }).click();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('button', { name: 'В архиве', exact: true }).click();
  await page.getByRole('button', { name: 'Обои', exact: true }).click(); await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('combobox', { name: 'Коллекция', exact: true }).click(); await page.getByRole('option', { name: 'Коллекция для проверки', exact: true }).click();
  for (const language of ['English', 'Русский', '中文', 'Português']) {
    await page.getByRole('tab', { name: language, exact: true }).click(); await page.getByLabel(`Название · ${language}`).fill(`Design ${language}`); await page.getByLabel(`Описание · ${language}`).fill('Описание обоев для проверки');
  }
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await page.getByRole('textbox', { name: 'Поиск по каталогу', exact: true }).fill('ui-check-1'); await expect(page.getByRole('heading', { name: 'Design Русский', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Комментарии', exact: true }).click();
  const commentCard = page.locator('li').filter({ hasText: 'Комментарий для проверки модерации' });
  await commentCard.getByRole('button', { name: 'Скрыть', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(commentCard).toContainText('Скрыт'); await commentCard.getByRole('button', { name: 'Вернуть', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click(); await expect(commentCard).toContainText('Виден');
  await page.getByRole('button', { name: 'Жалобы', exact: true }).click();
  await page.locator('li').filter({ hasText: 'Комментарий для проверки модерации' }).getByRole('button', { name: 'Обработано', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await page.getByRole('button', { name: 'Обращения', exact: true }).click();
  await page.locator('li').filter({ hasText: 'Обращение для проверки' }).getByRole('button', { name: 'Закрыть', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыто', exact: true }).click(); await page.locator('li').filter({ hasText: 'Обращение для проверки' }).getByRole('button', { name: 'Открыть повторно', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click(); await expect(page).toHaveURL(/\/admin\/login\/$/);
});

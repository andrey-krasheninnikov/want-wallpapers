import { test, expect, type Page } from '../browser';

type ProductEvent = { name: string; parameters: Record<string, string | number> };
async function events(page: Page): Promise<ProductEvent[]> {
  return page.evaluate(() => ((window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? [])
    .map(entry => Array.from(entry)).filter(entry => entry[0] === 'event').map(entry => ({ name: String(entry[1]), parameters: entry[2] as Record<string, string | number> })));
}
async function prepare(page: Page, enabled = true) {
  await page.addInitScript(value => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: value, advertising: false })), enabled);
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'DE' } }));
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const layer = window.dataLayer;
    const reply = entry => { if (entry[0] === 'get' && typeof entry[3] === 'function') entry[3]('test-client-id'); };
    const push = layer.push.bind(layer);
    layer.push = function(entry) { const result = push(entry); reply(entry); return result; };
    layer.forEach(reply);
  ` }));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/social')) return route.fulfill({ json: { counts: { cringe: 0, minus: 0, plus: 0, imba: 0 }, ownRating: '', ownUid: 'test-visitor', comments: [] } });
    if (path.endsWith('/recaptcha/config')) return route.fulfill({ json: { enabled: false, siteKey: null } });
    if (path.endsWith('/session')) return route.fulfill({ json: { csrf: 'test-csrf', uid: 'test-visitor' } });
    return route.fulfill({ json: {} });
  });
}
async function ready(page: Page) { await expect.poll(async () => (await events(page)).filter(event => event.name === 'page_view').length).toBe(1); }

test('canonical views and recognized searches exclude free input and URL secrets', async ({ page }) => {
  await prepare(page); await page.goto('/search/?q=private%40example.com#private-fragment'); await ready(page);
  await page.locator('#search-query').fill('blue private@example.com');
  await expect.poll(async () => (await events(page)).findLast(event => event.name === 'catalog_search')?.parameters.search_terms).toBe('blue');
  expect(JSON.stringify(await events(page))).not.toMatch(/private|example\.com/);
  expect((await events(page)).filter(event => event.name === 'page_view')).toHaveLength(1);
  await page.locator('#search-query').fill('no matching works');
  await expect.poll(async () => (await events(page)).findLast(event => event.name === 'catalog_search')?.parameters.result_count).toBe(0);
});

test('card visibility requires one active second and does not duplicate unchanged results', async ({ page }) => {
  await prepare(page); await page.goto('/search/'); await ready(page);
  const card = page.locator('[data-wallpaper-card]').first(); await card.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'card_view').length).toBeGreaterThan(0);
  const id = await card.getAttribute('data-wallpaper-card');
  await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
  expect((await events(page)).filter(event => event.name === 'card_view' && event.parameters.item_id === id)).toHaveLength(1);
  expect((await events(page)).filter(event => event.name === 'section_view')).toEqual([]);
  await card.locator('a').click();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'wallpaper_view').length).toBe(1);
});

for (const locale of ['en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar']) test(`native mobile PNG and one conversion retain ${locale} context`, async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${locale === 'en' ? '' : '/' + locale}/wallpapers/neon-tide-7/?variant=mobile`); await ready(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-link').click()]);
  expect(download.suggestedFilename()).toBe('neon-tide-7-mobile.png');
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'wallpaper_download').length).toBe(1);
  const event = (await events(page)).find(event => event.name === 'wallpaper_download')!;
  expect(event.parameters).toMatchObject({ locale, variant: 'mobile', collection_id: 'neon-tide', wallpaper: 'neon-tide-7' });
  expect(event.parameters.page_location).not.toContain('?');
});

test('Astro navigation sends one view per work and no view for variant changes', async ({ page }) => {
  await prepare(page); await page.goto('/wallpapers/neon-tide-7/'); await ready(page);
  await page.getByRole('tab', { name: 'Mobile', exact: true }).click();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'variant_change').length).toBe(1);
  expect((await events(page)).filter(event => event.name === 'page_view')).toHaveLength(1);
  await page.locator('#wallpaper-view').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'page_view').length).toBe(2);
  expect((await events(page)).filter(event => event.name === 'wallpaper_navigate')).toHaveLength(1);
});

test('refusal and withdrawal in another tab stop further product events', async ({ page, context }) => {
  await prepare(page, false); await page.goto('/search/'); await page.locator('#search-query').fill('blue');
  await page.waitForTimeout(800); expect(await events(page)).toEqual([]);
  // Storage notifications belong to other documents, so grant from a second tab.
  const second = await context.newPage(); await second.goto('/license/');
  await second.evaluate(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: true, advertising: false })));
  await ready(page);
  await second.evaluate(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'ga-disable-G-TEST'))).toBe(true);
  const before = (await events(page)).length;
  await page.locator('#search-query').fill('night'); await page.waitForTimeout(800);
  expect((await events(page)).length).toBe(before); await second.close();
});

test('ratings and feedback record confirmed outcomes without form values', async ({ page }) => {
  await prepare(page); await page.goto('/wallpapers/neon-tide-7/'); await ready(page);
  await expect(page.locator('#rating-plus')).toBeEnabled();
  await page.locator('#rating-plus').click({ force: true });
  await expect.poll(async () => (await events(page)).find(event => event.name === 'rating_action' && event.parameters.stage === 'success')?.parameters.rating).toBe('plus');
  await page.goto('/feedback/'); await ready(page);
  await page.locator('input[name="topic"]').fill('private topic');
  await page.locator('textarea[name="message"]').fill('private feedback message');
  await page.locator('input[name="email"]').fill('private@example.com');
  await page.locator('form button[type="submit"]').click();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'feedback_action' && event.parameters.stage === 'success').length).toBe(1);
  expect(JSON.stringify(await events(page))).not.toContain('private');
});

test('all owned Telegram destinations are distinct key events', async ({ page }) => {
  await prepare(page); await page.goto('/contact/'); await ready(page);
  for (const [href, destination] of [['https://t.me/want_wallpapers', 'channel'], ['https://t.me/andrey_krasheninnikov', 'author'], ['https://t.me/want_foundation', 'foundation']]) {
    const link = page.locator(`a[href="${href}"]`).first();
    await link.evaluate(element => element.addEventListener('click', event => event.preventDefault()));
    await link.click();
    await expect.poll(async () => (await events(page)).filter(event => event.name === 'telegram_click' && event.parameters.destination === destination).length).toBe(1);
  }
});

test('comment success and API failure remain distinct without comment text or raw error messages', async ({ page }) => {
  await prepare(page); await page.goto('/wallpapers/neon-tide-7/'); await ready(page);
  await page.locator('#comment-text').fill('private comment');
  await page.locator('.comment-composer button[type="submit"]').click();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'comment_action' && event.parameters.stage === 'success').length).toBe(1);
  await page.route('**/api/v1/wallpapers/*/comments', route => route.fulfill({ status: 503, json: { error: { code: 'private@example.com' } } }));
  await page.locator('#comment-text').fill('another private comment');
  await page.locator('.comment-composer button[type="submit"]').click();
  await expect.poll(async () => (await events(page)).find(event => event.name === 'comment_action' && event.parameters.stage === 'error')?.parameters.error_code).toBe('request_failed');
  expect(JSON.stringify(await events(page))).not.toContain('private');
});

test('native form validation and document Web Vitals have bounded payloads', async ({ page }) => {
  await prepare(page); await page.goto('/feedback/'); await ready(page);
  await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  await page.locator('form button[type="submit"]').click();
  await expect.poll(async () => (await events(page)).find(event => event.name === 'feedback_action' && event.parameters.error_code === 'validation')?.parameters.stage).toBe('error');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'web_vital').length).toBeGreaterThan(0);
  for (const event of (await events(page)).filter(event => event.name === 'web_vital')) {
    expect(['LCP', 'INP', 'CLS']).toContain(event.parameters.metric_name);
    expect(Number.isFinite(event.parameters.metric_value)).toBe(true);
  }
});

test('no JavaScript keeps PNG downloads and produces no analytics requests', async ({ context }) => {
  const isolated = await context.browser()!.newContext({ javaScriptEnabled: false });
  const page = await isolated.newPage(); const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('http://127.0.0.1:4387/wallpapers/neon-tide-7/');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-link').click()]);
  expect(download.suggestedFilename()).toBe('neon-tide-7-desktop.png');
  expect(requests.some(url => /firebase|google-analytics|googletagmanager/.test(url))).toBe(false);
  await isolated.close();
});


test('search debounce never replays input across permission changes', async ({ page, context }) => {
  await prepare(page, false); await page.goto('/search/');
  const second = await context.newPage(); await second.goto('/license/');
  const preference = async (analytics: boolean) => second.evaluate(value => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: value, advertising: false })), analytics);
  await page.locator('#search-query').fill('blue');
  await preference(true); await ready(page);
  await page.waitForTimeout(650); // Observe the complete 500 ms debounce window.
  expect((await events(page)).filter(event => event.name === 'catalog_search')).toEqual([]);
  await page.locator('#search-query').fill('night');
  await preference(false);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'ga-disable-G-TEST'))).toBe(true);
  await preference(true);
  await page.waitForTimeout(650);
  expect((await events(page)).filter(event => event.name === 'catalog_search')).toEqual([]);
  await page.locator('#search-query').fill('blue night');
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'catalog_search').length).toBe(1);
  await second.close();
});

test('carousel resize updates pagination without a navigation action', async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await ready(page);
  const track = page.locator('[data-collection-carousel] .collection-track');
  await track.scrollIntoViewIfNeeded();
  await track.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }));
  const next = page.locator('[data-collection-carousel] nav button').last();
  await expect(next).toBeDisabled();
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'feature_action' && event.parameters.feature === 'carousel').length).toBeGreaterThan(0);
  const before = (await events(page)).filter(event => event.name === 'feature_action' && event.parameters.feature === 'carousel').length;
  const pagination = page.locator('[data-collection-carousel] output');
  const previous = await pagination.textContent();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(pagination).not.toHaveText(previous!);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect((await events(page)).filter(event => event.name === 'feature_action' && event.parameters.feature === 'carousel')).toHaveLength(before);
});

test('a rating response retains the originating collection after Astro navigation', async ({ page }) => {
  await prepare(page); await page.goto('/wallpapers/neon-tide-1/'); await ready(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const request = page.waitForRequest('**/api/v1/wallpapers/neon-tide-1/rating');
  await page.route('**/api/v1/wallpapers/neon-tide-1/rating', async route => { await pending; await route.fulfill({ json: {} }); });
  await expect(page.locator('#rating-plus')).toBeEnabled(); await page.locator('#rating-plus').click({ force: true }); await request;
  try {
    await page.locator('#wallpaper-view').focus(); await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/a-night-beneath-the-ice-5/);
    await expect.poll(async () => (await events(page)).filter(event => event.name === 'page_view').length).toBe(2);
  } finally { release(); }
  await expect.poll(async () => (await events(page)).filter(event => event.name === 'rating_action' && event.parameters.stage === 'success').length).toBe(1);
  const result = (await events(page)).find(event => event.name === 'rating_action' && event.parameters.stage === 'success')!;
  expect(result.parameters).toMatchObject({ item_id: 'neon-tide-1', collection_id: 'neon-tide', page_location: 'http://127.0.0.1:4387/wallpapers/neon-tide-1/' });
});

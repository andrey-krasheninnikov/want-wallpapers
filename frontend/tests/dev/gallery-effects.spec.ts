import { test, expect, type Page } from '../browser';

test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ page }) => {
  await page.route('https://ipwho.is/**', route => route.fulfill({ json: { success: true, country_code: 'GE' } }));
  await page.addInitScript(() => localStorage.setItem('want-cookie-preferences-v2', JSON.stringify({ analytics: false, advertising: false })));
});

async function controls(page: Page) {
  await page.goto('/contact/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'wand-controls';
    fixture.innerHTML = `
      <button id="wand-button" class="ui-button-base ui-button-secondary ui-button-size-default"><span id="wand-label">Action</span><svg id="wand-icon" viewBox="0 0 24 24"><path id="wand-path" d="M2 2h20v20H2z" /></svg></button>
      <a id="wand-link" href="#main"><span id="wand-link-label">Link</span><svg id="wand-link-icon" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" /></svg></a>
      <button id="wand-icon-only" aria-label="Icon action"><svg viewBox="0 0 24 24"><path id="wand-only-path" d="M2 2h20v20H2z" /></svg></button>
      <p id="wand-text">Ordinary selectable text</p><h2 id="wand-heading">Heading</h2><label id="wand-field-label">Field label</label><summary id="wand-summary">Disclosure</summary><svg id="wand-plain-icon"></svg>
      <a id="wand-no-href">Placeholder link</a><button id="wand-disabled" disabled>Disabled</button><a id="wand-aria-disabled" href="#main" aria-disabled="true">Unavailable</a>
      <fieldset disabled><button id="wand-fieldset">Unavailable action</button></fieldset><div inert><button id="wand-inert">Inert</button></div>
      <div contenteditable="true"><button id="wand-editable">Editable action</button></div>
      <a href="#main"><input id="wand-input" aria-label="Input" /><textarea id="wand-textarea" aria-label="Text"></textarea><select id="wand-select" aria-label="Choice"><option>One</option></select><img id="wand-image" alt="Example" /><video id="wand-video"></video><audio id="wand-audio"></audio><canvas id="wand-canvas"></canvas><model-viewer id="wand-model"></model-viewer></a>`;
    document.body.append(fixture);
    fixture.querySelector('#wand-button')!.addEventListener('click', () => { fixture.dataset.clicks = String(Number(fixture.dataset.clicks ?? 0) + 1); });
  });
  await page.clock.install();
}

async function move(page: Page, selector: string) {
  await page.clock.runFor(160);
  await page.locator(selector).dispatchEvent('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 200 });
}

async function finishSparks(page: Page) {
  await page.locator('.wand-spark').evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => animation.finish())));
  await expect(page.locator('.wand-spark')).toHaveCount(0);
}

test('only active links and buttons, including nested icons and labels, emit sparks', async ({ page }) => {
  await controls(page);
  for (const selector of ['#wand-button', '#wand-label', '#wand-icon', '#wand-path', '#wand-link', '#wand-link-label', '#wand-link-icon', '#wand-only-path']) {
    await move(page, selector);
    await expect(page.locator('.wand-spark')).toHaveCount(1);
    await expect(page.locator('.wand-spark')).toHaveAttribute('aria-hidden', 'true');
    await finishSparks(page);
  }
  for (const selector of ['#wand-text', '#wand-heading', '#wand-field-label', '#wand-summary', '#wand-plain-icon', '#wand-no-href', '#wand-disabled', '#wand-aria-disabled', '#wand-fieldset', '#wand-inert', '#wand-editable', '#wand-input', '#wand-textarea', '#wand-select', '#wand-image', '#wand-video', '#wand-audio', '#wand-canvas', '#wand-model']) {
    await move(page, selector);
    await expect(page.locator('.wand-spark')).toHaveCount(0);
  }
  await page.locator('#wand-text').evaluate(element => window.getSelection()!.selectAllChildren(element));
  await move(page, '#wand-button');
  await expect(page.locator('.wand-spark')).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('Ordinary selectable text');
  await page.evaluate(() => window.getSelection()!.removeAllRanges());
  for (const properties of [{ buttons: 1, pointerType: 'mouse' }, { buttons: 0, pointerType: 'touch' }]) {
    await page.locator('#wand-button').dispatchEvent('pointermove', properties);
    await expect(page.locator('.wand-spark')).toHaveCount(0);
  }
  const button = page.locator('#wand-button');
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-color', 'rgb(89, 98, 240)');
  await button.press('Enter');
  await expect(page.locator('#wand-controls')).toHaveAttribute('data-clicks', '1');
  await button.click();
  await expect(page.locator('#wand-controls')).toHaveAttribute('data-clicks', '2');
  await expect(button).toHaveCSS('cursor', 'pointer');
});

test('sparks stay small, dim, rate-limited and bounded', async ({ page }) => {
  await controls(page);
  await move(page, '#wand-label');
  const spark = page.locator('.wand-spark').first();
  await expect(spark).toHaveCSS('width', '12px');
  await expect(spark).toHaveCSS('height', '12px');
  await expect(spark).toHaveCSS('filter', 'none');
  await expect(spark).toHaveCSS('pointer-events', 'none');
  const animation = await spark.evaluate(element => {
    const animation = element.getAnimations()[0]!; animation.pause();
    const effect = animation.effect as KeyframeEffect;
    return { duration: effect.getTiming().duration, frames: effect.getKeyframes().map(frame => ({ opacity: Number(frame.opacity), transform: String(frame.transform) })) };
  });
  expect(animation.duration).toBe(450);
  expect(Math.max(...animation.frames.map(frame => frame.opacity))).toBe(.45);
  expect(animation.frames.every(frame => !frame.transform.includes('scale'))).toBe(true);
  await page.clock.runFor(159);
  await page.locator('#wand-label').dispatchEvent('pointermove', { pointerType: 'mouse' });
  await expect(page.locator('.wand-spark')).toHaveCount(1);
  await page.clock.runFor(1);
  await page.locator('#wand-label').dispatchEvent('pointermove', { pointerType: 'mouse' });
  await expect(page.locator('.wand-spark')).toHaveCount(2);
  await page.locator('.wand-spark').evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => animation.pause())));
  await move(page, '#wand-label');
  await expect(page.locator('.wand-spark')).toHaveCount(3);
  await page.locator('.wand-spark').evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => animation.pause())));
  await move(page, '#wand-label');
  await expect(page.locator('.wand-spark')).toHaveCount(3);
  await finishSparks(page);
  await move(page, '#wand-label');
  await expect(page.locator('.wand-spark')).toHaveCount(1);
});

test('system motion and color preferences remove active particles and prevent new ones', async ({ page }) => {
  await controls(page);
  for (const preference of [{ reducedMotion: 'reduce' as const }, { forcedColors: 'active' as const }]) {
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
    await move(page, '#wand-button');
    await expect(page.locator('.wand-spark')).toHaveCount(1);
    await page.emulateMedia(preference);
    await expect(page.locator('.wand-spark')).toHaveCount(0);
    await move(page, '#wand-button');
    await expect(page.locator('.wand-spark')).toHaveCount(0);
  }
});

test('client navigation cancels particles and keeps exactly one download listener', async ({ page }) => {
  await page.goto('/wallpapers/contours-of-silence-1/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => { (window as Window & { wandDocument?: boolean }).wandDocument = true; });
  for (const action of ['next', 'next', 'back', 'forward']) {
    await page.locator('#download-link svg').dispatchEvent('pointermove', { pointerType: 'mouse', clientX: 300, clientY: 200 });
    await expect(page.locator('.wand-spark')).toHaveCount(1);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('want:download'));
      const state = window as Window & { wandParticles?: Element[]; wandAnimations?: Animation[] };
      state.wandParticles = [...document.querySelectorAll('.wand-spark, .download-confetti')];
      state.wandAnimations = state.wandParticles.flatMap(element => element.getAnimations());
      state.wandAnimations.forEach(animation => animation.pause());
    });
    await expect(page.locator('.download-confetti')).toHaveCount(18);
    const before = page.url();
    if (action === 'back') await page.goBack();
    else if (action === 'forward') await page.goForward();
    else await page.locator('[data-wallpaper-next]').click();
    await expect.poll(() => page.url()).not.toBe(before);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      const state = window as Window & { wandDocument?: boolean; wandParticles?: Element[]; wandAnimations?: Animation[] };
      return state.wandDocument && state.wandParticles!.every(element => !element.isConnected) && state.wandAnimations!.every(animation => animation.playState === 'idle');
    })).toBe(true);
    await expect(page.locator('.download-confetti')).toHaveCount(0);
  }
});

for (const width of [320, 1440]) test(`restrained appearance and native downloads at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ['/collections/contours-of-silence/', '/wallpapers/contours-of-silence-1/']) {
    await page.goto(route);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const target = page.locator(route.startsWith('/collections/') ? '.media-card-title' : '#download-link').first();
    await target.hover();
    await expect(page.locator('.wand-spark').first()).toBeVisible();
    await page.locator('.wand-spark').evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 80; })));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${route.startsWith('/collections/') ? 'collection' : 'wallpaper'}-${width}.png`) });
  }
  const url = page.url();
  const download = page.waitForEvent('download');
  await page.locator('#download-link').click();
  expect((await download).suggestedFilename()).toBe('contours-of-silence-1-desktop.png');
  expect(page.url()).toBe(url);
  await expect(page.locator('.download-confetti')).toHaveCount(18);
  await expect(page.locator('.download-confetti')).toHaveCount(0);
});

test.describe('unsuitable pointer', () => {
  test.use({ isMobile: true, hasTouch: true });
  test('coarse pointers do not emit sparks or confetti', async ({ page }) => {
    await page.goto('/wallpapers/contours-of-silence-1/');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
    await page.locator('#download-link').dispatchEvent('pointermove', { pointerType: 'touch' });
    await page.evaluate(() => window.dispatchEvent(new Event('want:download')));
    await expect(page.locator('.wand-spark, .download-confetti')).toHaveCount(0);
  });
});

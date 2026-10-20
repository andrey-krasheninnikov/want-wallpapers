import type { MountAdvertisement } from './advertising';

export const adsterraUnits = {
  leaderboard: { key: '3fa635949793b78eaef43a9cb55faa56', width: 728, height: 90 },
  banner: { key: '075afc57e2cd17e979192cd90af2e079', width: 468, height: 60 },
  mobile: { key: '03475f80ec74fec0aed3dd477c5462b1', width: 320, height: 50 },
  rectangle: { key: '508d469c2a8d534af75b19da3b8346d6', width: 300, height: 250 },
  left: { key: '339b7a5469601900204fd9b13dfc12e0', width: 160, height: 300 },
  right: { key: '382a4701b0e7f3beb6b211723ea1b3e7', width: 160, height: 600 },
} as const;

export function inlineAdvertisement(width: number) {
  return [adsterraUnits.leaderboard, adsterraUnits.banner, adsterraUnits.mobile, adsterraUnits.rectangle].find(unit => width >= unit.width);
}

export function advertisingPath(path: string): boolean {
  const route = path.replace(/\/index\.html$/, '/').replace(/^\/(ru|zh-cn|pt-br|ja)(?=\/|$)/, '').replace(/\/$/, '');
  return /^\/(collections(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|wallpapers\/[a-z0-9]+(?:-[a-z0-9]+)*|search|feedback|privacy|terms|cookies|license|contact)$/.test(route);
}

let requested = false;
let yandexRequested = false;
export const advertisingRequested = () => requested;
export const yandexAdvertisingRequested = () => yandexRequested;

function loadScript(src: string, container: HTMLElement, signal: AbortSignal, attributes: Record<string, string> = {}) {
  return new Promise<HTMLScriptElement>((resolve, reject) => {
    signal.throwIfAborted();
    const script = document.createElement('script');
    script.src = src; script.async = true;
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    const finish = (error?: unknown) => {
      script.onload = script.onerror = null;
      signal.removeEventListener('abort', abort);
      if (error) { script.remove(); reject(error); } else resolve(script);
    };
    // An inserted legacy script can still execute after removal; retain its options until load/error.
    const abort = () => { if (!src.startsWith('https://bauval.org/')) finish(signal.reason); };
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Advertising script unavailable'));
    signal.addEventListener('abort', abort, { once: true });
    if (src.startsWith('https://bauval.org/')) writers.set(script, { container, signal });
    requested = true;
    container.append(script);
  });
}

// Legacy tags write their iframe synchronously; keep those writes inside their placement.
const writers = new WeakMap<Element, { container: HTMLElement; signal: AbortSignal }>();
let writesInstalled = false;
function installAdvertisingWrites() {
  if (writesInstalled) return;
  writesInstalled = true;
  for (const name of ['write', 'writeln'] as const) {
    const original: (...text: string[]) => void = document[name].bind(document);
    document[name] = (...text: string[]) => {
      const owner = document.currentScript && writers.get(document.currentScript);
      if (!owner) { original(...text); return; }
      if (owner.signal.aborted || !owner.container.isConnected) return;
      const fragment = document.createRange().createContextualFragment(text.join('') + (name === 'writeln' ? '\n' : ''));
      for (const script of fragment.querySelectorAll('script')) writers.set(script, owner);
      owner.container.append(fragment);
    };
  }
}

function waitForFrame(container: HTMLElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    if (container.querySelector('iframe')) { resolve(); return; }
    const finish = (error?: unknown) => {
      observer.disconnect(); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(signal.reason);
    const observer = new MutationObserver(() => { if (container.querySelector('iframe')) finish(); });
    observer.observe(container, { childList: true, subtree: true });
    signal.addEventListener('abort', abort, { once: true });
  });
}

type Options = { key: string; format: 'iframe'; width: number; height: number; params: Record<string, never> };
declare global { interface Window { atOptions?: Options } }
let adsterraQueue = Promise.resolve();
export async function mountAdsterra({ provider, side, container, signal }: Parameters<MountAdvertisement>[0], unit: (typeof adsterraUnits)[keyof typeof adsterraUnits] | undefined = side === 'inline' ? undefined : adsterraUnits[side]) {
  if (provider !== 'adsterra') return null;
  if (!unit) return null;
  const pending = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const job = adsterraQueue.then(async () => {
    pending.throwIfAborted();
    installAdvertisingWrites();
    const previous = window.atOptions;
    const options: Options = { ...unit, format: 'iframe', params: {} };
    window.atOptions = options;
    try { await loadScript(`https://bauval.org/22/${unit.key}`, container, pending); }
    finally { if (window.atOptions === options) { if (previous) window.atOptions = previous; else delete window.atOptions; } }
  });
  adsterraQueue = job.catch(() => {});
  await job;
  await waitForFrame(container, pending);
  signal.throwIfAborted();
  return () => container.replaceChildren();
}

export async function startYandexAdvertising(signal: AbortSignal) {
  if (yandexRequested) return;
  signal.throwIfAborted();
  yandexRequested = true;
  const pending = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const container = document.createElement('div');
  container.dataset.yandexLoader = '';
  document.body.append(container);
  const remove = () => container.remove();
  signal.addEventListener('abort', remove, { once: true });
  try {
    await loadScript('https://yandex.ru/ads/system/context.js', container, pending);
    await loadScript('https://yandex.ru/ads/system/ap-loader.js', container, pending, { 'data-page-id': '20177169' });
  } catch { remove(); }
}

import { getCountry, initializePrivacy, readCookiePreferences } from './privacy';
import { advertisingPath, advertisingRequested, inlineAdvertisement, mountAdsterra, startYandexAdvertising } from './advertising-providers';
import { effectiveCookiePreferences, type CookiePreferences } from './privacy-policy';

export type AdvertisingProvider = 'yandex' | 'adsterra';
export type AdvertisingSide = 'left' | 'right' | 'inline';
export type MountAdvertisement = (context: {
  provider: AdvertisingProvider; side: AdvertisingSide; container: HTMLElement; signal: AbortSignal;
}) => Promise<(() => void) | null>;

export function selectAdvertisingProvider(country: string | null, preferences: CookiePreferences | null): AdvertisingProvider | null {
  if (!effectiveCookiePreferences(preferences, country).advertising) return null;
  return country === 'RU' || country === 'KZ' || country === 'BY' ? 'yandex' : 'adsterra';
}

export function startAdvertisement(container: HTMLElement, provider: AdvertisingProvider, side: AdvertisingSide, mount: MountAdvertisement): () => void {
  const controller = new AbortController();
  const placement = container.ownerDocument.createElement('div');
  let cleanup: (() => void) | undefined;
  container.hidden = true;
  container.appendChild(placement);
  function release(dispose?: (() => void) | null) {
    try { dispose?.(); } catch { /* Optional provider cleanup must not interrupt the page. */ }
  }
  function remove() {
    if (placement.parentElement === container) {
      container.hidden = true;
      placement.remove();
    }
  }
  void Promise.resolve().then(async () => {
    if (controller.signal.aborted) return;
    const dispose = await mount({ provider, side, container: placement, signal: controller.signal });
    if (controller.signal.aborted) { release(dispose); return; }
    if (!dispose) { remove(); controller.abort(); return; }
    cleanup = dispose;
    container.hidden = false;
  }).catch(() => { remove(); controller.abort(); });
  return () => {
    if (controller.signal.aborted) return;
    remove();
    controller.abort();
    release(cleanup);
  };
}

export function initAdvertisements(): () => void {
  if (!advertisingPath(window.location.pathname)) return () => {};
  const root = document.querySelector<HTMLElement>('.public-advertisements');
  if (!root) return () => {};
  const label = root.dataset.advertisementLabel ?? '';
  const inline = document.createElement('aside');
  inline.hidden = true; inline.className = 'inline-advertisement';
  inline.setAttribute('aria-label', label); root.append(inline);
  const stage = document.querySelector<HTMLElement>('.wallpaper-advertising-layout');
  const sideHosts = stage ? (['left', 'right'] as const).map(side => {
    const host = document.createElement('aside');
    host.hidden = true; host.className = 'wallpaper-advertisement'; host.dataset.side = side;
    host.setAttribute('aria-label', label); stage.prepend(host); return host;
  }) : [];
  const [left, right] = sideHosts;
  for (const host of [inline, ...sideHosts]) {
    const caption = document.createElement('p');
    caption.className = 'mb-2 text-sm text-muted-foreground'; caption.textContent = label; host.append(caption);
  }
  const media = matchMedia('(min-width: 1712px)');
  const controller = new AbortController();
  let ready = false, active = true, current: string | undefined;
  let stops: (() => void)[] = [];
  function stop() { for (const dispose of stops) dispose(); stops = []; }
  function update() {
    if (!ready || !active) return;
    const provider = selectAdvertisingProvider(getCountry(), readCookiePreferences());
    if (!provider && advertisingRequested()) { window.location.reload(); return; }
    const sides = provider === 'adsterra' && media.matches && left && right;
    const width = root!.clientWidth;
    const unit = provider === 'adsterra' && !sides ? inlineAdvertisement(width) : undefined;
    const next = provider === 'yandex' ? 'yandex' : sides ? 'sides' : unit?.key;
    if (next === current) return;
    stop(); current = next;
    if (provider === 'yandex') void startYandexAdvertising(controller.signal);
    else if (sides) stops = [startAdvertisement(left!, 'adsterra', 'left', mountAdsterra), startAdvertisement(right!, 'adsterra', 'right', mountAdsterra)];
    else if (unit) {
      inline.style.width = `${unit.width}px`;
      stops = [startAdvertisement(inline, 'adsterra', 'inline', context => mountAdsterra(context, unit))];
    }
  }
  const restore = (event: PageTransitionEvent) => { if (event.persisted && advertisingRequested()) window.location.reload(); };
  const observer = new ResizeObserver(update);
  observer.observe(root);
  window.addEventListener('want:privacy', update);
  window.addEventListener('pageshow', restore);
  media.addEventListener('change', update);
  void initializePrivacy().then(() => { if (active) { ready = true; update(); } });
  return () => {
    active = false; stop(); controller.abort(); observer.disconnect();
    inline.remove(); for (const host of sideHosts) host.remove();
    window.removeEventListener('want:privacy', update);
    window.removeEventListener('pageshow', restore);
    media.removeEventListener('change', update);
  };
}

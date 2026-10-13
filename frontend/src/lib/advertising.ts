import { effectiveCookiePreferences, type CookiePreferences } from './privacy-policy';

export type AdvertisingProvider = 'yandex' | 'adsterra';
export type AdvertisingSide = 'left' | 'right';
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

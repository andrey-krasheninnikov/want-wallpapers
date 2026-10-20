import { getCountry, initializePrivacy, readCookiePreferences } from './privacy';
import { advertisingPath, advertisingRequested, hilltopAdvertisement, mountHilltop } from './advertising-providers';
import { effectiveCookiePreferences, type CookiePreferences } from './privacy-policy';

export type MountAdvertisement = (context: {
  container: HTMLElement; signal: AbortSignal;
}) => Promise<(() => void) | null>;

export function advertisingAllowed(country: string | null, preferences: CookiePreferences | null): boolean {
  return effectiveCookiePreferences(preferences, country).advertising;
}

export function startAdvertisement(container: HTMLElement, mount: MountAdvertisement): () => void {
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
    const dispose = await mount({ container: placement, signal: controller.signal });
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
  inline.setAttribute('aria-label', label);
  const caption = document.createElement('p');
  caption.className = 'mb-2 text-sm text-muted-foreground'; caption.textContent = label;
  inline.append(caption); root.append(inline);
  let ready = false, active = true;
  let stop: (() => void) | undefined;
  function update() {
    if (!ready || !active) return;
    if (!advertisingAllowed(getCountry(), readCookiePreferences())) {
      if (advertisingRequested()) window.location.reload();
      return;
    }
    if (!stop && root!.clientWidth >= hilltopAdvertisement.width) stop = startAdvertisement(inline, mountHilltop);
  }
  const restore = (event: PageTransitionEvent) => { if (event.persisted && advertisingRequested()) window.location.reload(); };
  const observer = new ResizeObserver(update);
  observer.observe(root);
  window.addEventListener('want:privacy', update);
  window.addEventListener('pageshow', restore);
  void initializePrivacy().then(() => { if (active) { ready = true; update(); } });
  return () => {
    active = false; stop?.(); observer.disconnect(); inline.remove();
    window.removeEventListener('want:privacy', update);
    window.removeEventListener('pageshow', restore);
  };
}

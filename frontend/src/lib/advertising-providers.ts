import type { MountAdvertisement } from './advertising';

export const hilltopAdvertisement = {
  src: 'https://massivesalad.com/bwX/Vgswd.G/lR0/YnWWcM/te/mU9AuYZ/UxlMkxPWTpcJ1oMDz/cVyyNYDbk/tPNczxU/z_NMzHIZ1DM/wL',
  width: 300, height: 250,
} as const;

export function advertisingPath(path: string): boolean {
  const route = path.replace(/\/index\.html$/, '/').replace(/^\/(ru|zh-cn|pt-br|ja|ar)(?=\/|$)/, '').replace(/\/$/, '');
  return /^\/(collections(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|wallpapers\/[a-z0-9]+(?:-[a-z0-9]+)*|search|feedback|privacy|terms|cookies|license|contact)$/.test(route);
}

let requested = false;
export const advertisingRequested = () => requested;

export const mountHilltop: MountAdvertisement = async ({ container, signal }) => {
  signal.throwIfAborted();
  if (requested) return null;
  const pending = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const script = document.createElement('script') as HTMLScriptElement & { settings: Record<string, never> };
  script.settings = {};
  script.src = hilltopAdvertisement.src; script.async = true;
  script.referrerPolicy = 'no-referrer-when-downgrade';
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      observer.disconnect(); script.onload = script.onerror = null;
      pending.removeEventListener('abort', abort);
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const abort = () => finish(pending.reason);
    const ready = () => { if (container.querySelector('iframe')) finish(); };
    const observer = new MutationObserver(ready);
    observer.observe(container, { childList: true, subtree: true });
    script.onload = ready;
    script.onerror = () => finish(new Error('Advertising script unavailable'));
    pending.addEventListener('abort', abort, { once: true });
    // The SDK owns document state, so the tag starts at most once per document.
    requested = true;
    container.append(script);
  });
  signal.throwIfAborted();
  return () => container.replaceChildren();
};

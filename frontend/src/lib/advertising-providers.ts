import type { MountAdvertisement } from './advertising';

export const hilltopAdvertisements = {
  top: 'https://massivesalad.com/b.XbVws/dAGOlE0mYNW/cl/feZmU9muPZLUql/k/PGTvcx1-NpDCYNwXNLjDUut/NLz_UN0cNxjlAU2CO/Qt',
  content: 'https://massivesalad.com/bhXeVas.dcGYlt0/YBWRcP/zeJmg9fuxZ/U-lJkuPwThcn1pNxDdYVwCOODaExtCN/zhUd0DNnj/AD4wN/QJ',
  footer: 'https://massivesalad.com/bwX/Vgswd.G/lR0/YnWWcM/te/mU9AuYZ/UxlMkxPWTpcJ1oMDz/cVyyNYDbk/tPNczxU/z_NMzHIZ1DM/wL',
} as const;
export type AdvertisementPlacement = keyof typeof hilltopAdvertisements;

export const hilltopVideoAdvertisement = {
  zone: 'wf-wallpapers-vast-on-download',
  src: 'https://loyal-product.com/domLFjzZd.GUNWvUZRGKUT/Xe/m-9cuPZsUilIkNPMTKcg1ANYD/U/5sNojpUWtPNxzNUG0VNvTqku2bOXQe',
  mediaOrigin: 'https://www.silent-basis.pro',
  enabled: (import.meta.env.PUBLIC_HILLTOP_VAST_ENABLED ?? 'true') === 'true',
} as const;

export function advertisingPath(path: string): boolean {
  const route = path.replace(/\/index\.html$/, '/').replace(/^\/(ru|zh-cn|pt-br|ja|ar)(?=\/|$)/, '').replace(/\/$/, '');
  return route === '' || /^\/(collections(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|wallpapers\/[a-z0-9]+(?:-[a-z0-9]+)*|search|feedback|privacy|terms|cookies|license|contact)$/.test(route);
}

const requested = new Set<string>();
export const advertisingRequested = () => requested.size > 0;

export const mountHilltop = (src: string): MountAdvertisement => async ({ container, signal }) => {
  signal.throwIfAborted();
  if (requested.has(src)) return null;
  const pending = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const script = document.createElement('script') as HTMLScriptElement & { settings: Record<string, never> };
  script.settings = {};
  script.src = src; script.async = true;
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
    // The SDK owns document state, so each zone starts at most once per document.
    requested.add(src);
    container.append(script);
  });
  signal.throwIfAborted();
  return () => container.replaceChildren();
};

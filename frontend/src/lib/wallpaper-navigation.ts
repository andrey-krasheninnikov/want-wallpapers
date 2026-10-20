import type { Wallpaper } from '@/data/catalog';
import { advertisingPath, advertisingRequested, yandexAdvertisingRequested } from './advertising-providers';

export function wallpaperNeighbors(items: readonly Wallpaper[], id: string) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Unknown wallpaper: ${id}`);
  return {
    position: index + 1, total: items.length,
    previous: items.length > 1 ? items[(index - 1 + items.length) % items.length] : null,
    next: items.length > 1 ? items[(index + 1) % items.length] : null,
  };
}

export function selectedWallpaperVariant(search: string): 'desktop' | 'mobile' {
  return new URLSearchParams(search).get('variant') === 'mobile' ? 'mobile' : 'desktop';
}

export function wallpaperSlideHref(href: string, variant: 'desktop' | 'mobile') {
  return `${href}?variant=${variant}#wallpaper-view`;
}


export function initWallpaperNavigation() {
  let viewportTop: number | undefined;
  let focus: 'previous' | 'next' | undefined;
  document.addEventListener('astro:before-preparation', (event) => {
    if (yandexAdvertisingRequested() || (advertisingRequested() && !advertisingPath(event.to.pathname))) {
      event.preventDefault(); window.location.assign(event.to.href); return;
    }
    viewportTop = event.info?.wallpaperSlide ? document.getElementById('wallpaper-view')?.getBoundingClientRect().top : undefined;
    focus = document.activeElement?.hasAttribute('data-wallpaper-next') ? 'next' : document.activeElement?.hasAttribute('data-wallpaper-previous') ? 'previous' : undefined;
    if (!event.info?.wallpaperSlide) return;
    const load = event.loader;
    event.loader = async () => {
      await load();
      if (event.signal.aborted || event.defaultPrevented) return;
      const variant = selectedWallpaperVariant(event.to.search);
      const src = event.newDocument.querySelector<HTMLImageElement>(`[data-wallpaper-image="${variant}"]`)?.getAttribute('src');
      if (src) { const image = new Image(); image.src = src; await image.decode().catch(() => {}); }
    };
  });
  document.addEventListener('astro:before-swap', (event) => {
    event.newDocument.documentElement.dataset.wallpaperVariant = selectedWallpaperVariant(event.to.search);
    event.newDocument.documentElement.dataset.backgroundMotion = document.documentElement.dataset.backgroundMotion;
    for (const key of ['country', 'countryGroup'] as const) {
      const value = document.documentElement.dataset[key];
      if (value) event.newDocument.documentElement.dataset[key] = value;
    }
  });
  document.addEventListener('astro:after-swap', () => {
    const viewer = document.getElementById('wallpaper-view');
    if (viewportTop !== undefined && viewer) {
      scrollTo({ top: scrollY + viewer.getBoundingClientRect().top - viewportTop, left: scrollX, behavior: 'instant' });
      (focus ? document.querySelector<HTMLElement>(`[data-wallpaper-${focus}]`) : viewer)?.focus({ preventScroll: true });
    }
    viewportTop = undefined;
  });
}

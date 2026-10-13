import type { Wallpaper } from '@/data/catalog';

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

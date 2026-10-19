import type { Wallpaper } from '@/data/catalog';

export function newestWallpapers(items: readonly Wallpaper[], dates: Readonly<Record<string, string>>) {
  return [...items].sort((a, b) => {
    const left = Date.parse(dates[a.id] ?? ''), right = Date.parse(dates[b.id] ?? '');
    const byDate = (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
    return (Number.isNaN(byDate) ? 0 : byDate) || b.collectionId.localeCompare(a.collectionId) || b.number - a.number || a.id.localeCompare(b.id);
  });
}

import type { Collection, Wallpaper } from '@/data/catalog';

export function newestWallpapers(items: readonly Wallpaper[], dates: Readonly<Record<string, string>>) {
  return [...items].sort((a, b) => {
    const left = Date.parse(dates[a.id] ?? ''), right = Date.parse(dates[b.id] ?? '');
    const byDate = (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
    return (Number.isNaN(byDate) ? 0 : byDate) || b.collectionId.localeCompare(a.collectionId) || b.number - a.number || a.id.localeCompare(b.id);
  });
}

export function newestCollections(items: readonly Collection[], dates: Readonly<Record<string, string>>) {
  const timestamp = (id: string) => (dates[id] ?? '').replace(/(\.\d+)?Z$/, (_, fraction: string = '.') => `${fraction.padEnd(7, '0')}Z`);
  return [...items].sort((a, b) => {
    const left = timestamp(a.id), right = timestamp(b.id);
    if (left !== right) return left < right ? 1 : -1;
    return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
  });
}

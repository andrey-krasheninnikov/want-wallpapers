export function randomWallpaperIndex(count: number, current: number, sample = Math.random()) {
  if (count < 2) return current;
  return (current + 1 + Math.floor(sample * (count - 1))) % count;
}

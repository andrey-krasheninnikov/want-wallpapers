// shortcut: the model query is versioned manually; bump it when the GLB changes.
export const deviceModelSrc = '/models/devices.glb?cover=neon-tide-5';

export function randomWallpaperIndex(count: number, current: number, sample = Math.random()) {
  if (count < 2) return current;
  return (current + 1 + Math.floor(sample * (count - 1))) % count;
}

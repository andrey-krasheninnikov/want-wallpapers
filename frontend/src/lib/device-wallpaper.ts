// shortcut: the model query is versioned manually; bump it when the GLB changes.
export const deviceModelSrc = '/models/devices.glb?cover=neon-tide-5';

export function randomWallpaperIndex(count: number, current: number, sample = Math.random()) {
  if (count < 2) return current;
  return (current + 1 + Math.floor(sample * (count - 1))) % count;
}

export function createWallpaperCycle(initialId: string, random = Math.random) {
  const visited = new Set([initialId]);
  const failed = new Set<string>();
  return {
    next(ids: string[], current: string) {
      const alternatives = ids.filter(id => id !== current);
      if (!alternatives.length) return;
      let remaining = alternatives.filter(id => !visited.has(id) && !failed.has(id));
      if (!remaining.length) {
        visited.clear(); failed.clear();
        remaining = alternatives;
      }
      return remaining[Math.floor(random() * remaining.length)];
    },
    commit(id: string) { visited.add(id); failed.delete(id); },
    reject(id: string) { failed.add(id); },
  };
}

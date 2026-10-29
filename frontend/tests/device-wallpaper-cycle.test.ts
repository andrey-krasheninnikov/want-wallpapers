import { expect, test } from 'bun:test';
import { createWallpaperCycle } from '../src/lib/device-wallpaper';

test('automatic and manual selections share complete cycles without boundary repeats', () => {
  const cycle = createWallpaperCycle('a', () => 0);
  const ids = ['a', 'b', 'c', 'd'];
  let current = 'a';
  for (let round = 0; round < 3; round++) {
    const shown = [current];
    for (let count = 1; count < ids.length; count++) {
      const next = cycle.next(ids, current)!;
      expect(shown).not.toContain(next);
      cycle.commit(next); current = next; shown.push(next);
    }
    expect([...shown].sort()).toEqual(ids);
    const next = cycle.next(ids, current)!;
    expect(next).not.toBe(current);
    cycle.commit(next); current = next;
  }
});

test('late catalogue works join the current cycle and failed textures do not become shown', () => {
  const cycle = createWallpaperCycle('a', () => 0);
  expect(cycle.next(['a'], 'a')).toBeUndefined();
  expect(cycle.next(['a', 'b', 'c'], 'a')).toBe('b');
  cycle.reject('b');
  expect(cycle.next(['a', 'b', 'c', 'd'], 'a')).toBe('c');
  cycle.commit('c');
  expect(cycle.next(['a', 'b', 'c', 'd'], 'c')).toBe('d');
  cycle.commit('d');
  expect(cycle.next(['a', 'b', 'c', 'd'], 'd')).toBe('a');
  cycle.commit('a');
  expect(cycle.next(['a', 'b', 'c', 'd'], 'a')).toBe('b');
});

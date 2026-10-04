import { expect, test } from 'bun:test';
import { filterWallpapers } from '../src/lib/search-client';

test('filters intersect, normalize accents, and reset to the complete catalogue', () => {
  const items = [
    { id: 'a', searchText: 'Céu azul', category: 'landscape', collection: 'quiet' },
    { id: 'b', searchText: 'Azul vidro', category: 'abstract', collection: 'quiet' },
    { id: 'c', searchText: 'Céu noturno', category: 'landscape', collection: 'light' },
  ];
  expect(filterWallpapers(items, 'pt-br', { q: 'ceu', category: 'landscape', collection: 'quiet' }).map((item) => item.id)).toEqual(['a']);
  expect(filterWallpapers(items, 'pt-br', { q: 'unknown', category: '', collection: '' })).toEqual([]);
  expect(filterWallpapers(items, 'pt-br', { q: '', category: '', collection: '' })).toEqual(items);
});

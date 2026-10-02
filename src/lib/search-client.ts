import { searchIds, type createSearchIndex } from './catalog-search';
import type { Locale } from '../data/catalog';

type SearchItem = { id: string; searchText: string; category: string; collection: string };
export function filterWallpapers<T extends SearchItem>(items: T[], locale: Locale, filters: { q: string; category: string; collection: string }, index?: ReturnType<typeof createSearchIndex>): T[] {
  const normalize = (value: string) => value.toLocaleLowerCase(locale).normalize('NFKD').replace(/\p{M}/gu, '').trim();
  const phrase = filters.q.trim();
  const matches = searchIds(index, locale, phrase);
  return items.filter((item) =>
    (!phrase || matches.has(item.id) || normalize(item.searchText).includes(normalize(phrase)))
    && (!filters.category || item.category === filters.category)
    && (!filters.collection || item.collection === filters.collection));
}

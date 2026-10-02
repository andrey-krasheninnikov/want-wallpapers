import { createSearchIndex, searchIds } from './catalog-search';
import { copy } from '../data/copy';
import type { Locale } from '../data/catalog';

const page = document.querySelector<HTMLElement>('#search-page');
if (page) {
  const locale = page.dataset.locale as Locale;
  const ui = copy[locale];
  const queryInput = document.querySelector<HTMLInputElement>('#search-query')!;
  const category = document.querySelector<HTMLSelectElement>('#search-category')!;
  const collection = document.querySelector<HTMLSelectElement>('#search-collection')!;
  const count = document.querySelector<HTMLElement>('#search-count')!;
  const empty = document.querySelector<HTMLElement>('#search-empty')!;
  const items = [...document.querySelectorAll<HTMLElement>('[data-search-item]')];
  const documents = items.map((item) => ({ id: item.dataset.id!, text: item.dataset.text ?? '' }));
  let index: ReturnType<typeof createSearchIndex> | undefined;
  try { index = createSearchIndex(locale, documents); } catch { /* Substring search remains available. */ }
  const normalize = (value: string) => value.toLocaleLowerCase(locale).normalize('NFKD').replace(/\p{M}/gu, '').trim();

  function update() {
    const phrase = queryInput.value.trim();
    const matches = searchIds(index, locale, phrase);
    let visible = 0;
    for (const item of items) {
      const text = normalize(item.dataset.text ?? '');
      const wordMatch = !phrase || matches?.has(item.dataset.id!) || text.includes(normalize(phrase));
      const show = wordMatch && (!category.value || item.dataset.category === category.value) && (!collection.value || item.dataset.collection === collection.value);
      item.hidden = !show;
      if (show) visible++;
    }
    count.textContent = `${visible} ${ui.results}`;
    empty.hidden = visible !== 0;
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', phrase], ['category', category.value], ['collection', collection.value]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }

  const params = new URLSearchParams(window.location.search);
  queryInput.value = params.get('q') ?? '';
  category.value = params.get('category') ?? '';
  collection.value = params.get('collection') ?? '';
  queryInput.addEventListener('input', update);
  category.addEventListener('change', update);
  collection.addEventListener('change', update);
  update();
}

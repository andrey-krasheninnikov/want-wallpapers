import lunr from 'lunr';
import stemmerSupport from 'lunr-languages/lunr.stemmer.support.js';
import russian from 'lunr-languages/lunr.ru.js';
import portuguese from 'lunr-languages/lunr.pt.js';
import chinese from 'lunr-languages/lunr.zh.js';
import type { Locale } from '../data/catalog';

type SearchDocument = { id: string; text: string };
type LocalizedLunr = typeof lunr & {
  ru: lunr.Builder.Plugin;
  pt: lunr.Builder.Plugin;
  zh: lunr.Builder.Plugin & { tokenizer: (text: string) => lunr.Token[] };
};

stemmerSupport(lunr);
russian(lunr);
portuguese(lunr);
chinese(lunr);
const localizedLunr = lunr as LocalizedLunr;

export function createSearchIndex(locale: Locale, documents: SearchDocument[]) {
  return lunr(function () {
    this.ref('id');
    this.field('text');
    if (locale === 'ru') this.use(localizedLunr.ru);
    if (locale === 'pt-br') this.use(localizedLunr.pt);
    if (locale === 'zh-cn') this.use(localizedLunr.zh);
    documents.forEach((item) => this.add(item));
  });
}

export function searchIds(index: lunr.Index | undefined, locale: Locale, phrase: string): Set<string> {
  if (!index) return new Set();
  const words = phrase.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!words) return new Set();
  try {
    const query = locale === 'zh-cn'
      ? localizedLunr.zh.tokenizer(words).map((token) => token.toString()).join(' ')
      : words;
    return new Set(index.search(query).map((item) => item.ref));
  } catch { return new Set(); }
}

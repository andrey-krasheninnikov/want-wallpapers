import lunr from 'lunr';
import stemmerSupport from 'lunr-languages/lunr.stemmer.support.js';
import arabic from 'lunr-languages/lunr.ar.js';
import russian from 'lunr-languages/lunr.ru.js';
import portuguese from 'lunr-languages/lunr.pt.js';
import chinese from 'lunr-languages/lunr.zh.js';
import tinySegmenter from 'lunr-languages/tinyseg.js';
import japanese from 'lunr-languages/lunr.ja.js';
import type { Locale } from '../data/catalog';

type SearchDocument = { id: string; text: string };
type LocalizedLunr = typeof lunr & {
  ar: lunr.Builder.Plugin;
  ru: lunr.Builder.Plugin;
  ja: lunr.Builder.Plugin & { tokenizer: (text: string) => lunr.Token[] };
  pt: lunr.Builder.Plugin;
  zh: lunr.Builder.Plugin & { tokenizer: (text: string) => lunr.Token[] };
};

stemmerSupport(lunr);
arabic(lunr);
russian(lunr);
portuguese(lunr);
chinese(lunr);
tinySegmenter(lunr);
japanese(lunr);
const localizedLunr = lunr as LocalizedLunr;

export function createSearchIndex(locale: Locale, documents: SearchDocument[]) {
  return lunr(function () {
    this.ref('id');
    this.field('text');
    if (locale === 'ar') this.use(localizedLunr.ar);
    if (locale === 'ru') this.use(localizedLunr.ru);
    if (locale === 'pt-br') this.use(localizedLunr.pt);
    if (locale === 'zh-cn') this.use(localizedLunr.zh);
    if (locale === 'ja') this.use(localizedLunr.ja);
    documents.forEach((item) => this.add(locale === 'ja' || locale === 'ar' ? { ...item, text: normalizeSearchText(item.text, locale) } : item));
  });
}

export function searchIds(index: lunr.Index | undefined, locale: Locale, phrase: string): Set<string> {
  if (!index) return new Set();
  const words = (locale === 'ja' || locale === 'ar' ? normalizeSearchText(phrase, locale) : phrase).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!words) return new Set();
  try {
    const query = locale === 'zh-cn'
      ? localizedLunr.zh.tokenizer(words).map((token) => token.toString()).join(' ')
      : locale === 'ja' ? localizedLunr.ja.tokenizer(words).map((token) => token.toString()).join(' ') : words;
    return new Set(index.search(query).map((item) => item.ref));
  } catch { return new Set(); }
}

export function normalizeSearchText(value: string, locale: Locale) {
  const text = value.toLocaleLowerCase(locale);
  if (locale === 'ja') return text.normalize('NFKC').trim();
  if (locale === 'ar') return text.normalize('NFKC').replace(/[\p{M}ـ]/gu, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
  return text.normalize('NFKD').replace(/\p{M}/gu, '').trim();
}

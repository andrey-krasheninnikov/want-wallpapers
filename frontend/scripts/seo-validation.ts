import sax from 'sax';
import { decodeHTMLAttribute, decodeHTML } from 'entities';

function attributeValue(element: { getAttribute(name: string): string | null }, name: string): string | null {
  const value = element.getAttribute(name);
  return value === null ? null : decodeHTMLAttribute(value);
}

export const origin = 'https://wallpapers.want.foundation';
export function require(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export type Page = { path: string; lang: string; canonical: string[]; alternates: { lang: string; href: string }[]; robots: string[]; og: string[]; ids: Set<string>; references: { url: string; tag: string }[]; scripts: { source: string | null; type: string | null; text: string }[]; text: string; bytes: number };

export async function parsePage(html: string, path: string): Promise<Page> {
  const page: Page = { path, lang: '', canonical: [], alternates: [], robots: [], og: [], ids: new Set(), references: [], scripts: [], text: '', bytes: Buffer.byteLength(html) };
  const parser = new HTMLRewriter()
    .on('html', { element(element) { page.lang = attributeValue(element, 'lang') ?? ''; } })
    .on('[id], a[name]', { element(element) { const id = attributeValue(element, 'id') ?? attributeValue(element, 'name'); if (id) page.ids.add(id); } })
    .on('meta', { element(element) {
      if (attributeValue(element, 'name') === 'robots') page.robots.push(attributeValue(element, 'content') ?? '');
      if (attributeValue(element, 'property') === 'og:url') page.og.push(attributeValue(element, 'content') ?? '');
    } })
    .on('link', { element(element) {
      const href = attributeValue(element, 'href') ?? '';
      if (attributeValue(element, 'rel') === 'canonical') page.canonical.push(href);
      if (attributeValue(element, 'rel') === 'alternate' && element.hasAttribute('hreflang')) page.alternates.push({ lang: attributeValue(element, 'hreflang')!, href });
    } })
    .on('a[href], img[src], script[src], link[href], form[action]', { element(element) {
      const attribute = element.tagName === 'form' ? 'action' : ['img', 'script'].includes(element.tagName) ? 'src' : 'href';
      page.references.push({ url: attributeValue(element, attribute) ?? '', tag: element.tagName });
    } })
    .on('script', { element(element) {
      const script = { source: attributeValue(element, 'src'), type: attributeValue(element, 'type'), text: '' };
      page.scripts.push(script);
    }, text(chunk) { page.scripts.at(-1)!.text += chunk.text; } });
  await parser.transform(new Response(html)).text();
  const readable = await new HTMLRewriter().on('head, script, style, template, [hidden], [aria-hidden="true"]', { element(element) { element.remove(); } }).transform(new Response(html)).text();
  await new HTMLRewriter().on('body', { text(chunk) { page.text += chunk.text; } }).transform(new Response(readable)).text();
  page.text = decodeHTML(page.text).replace(/\s+/g, ' ').trim();
  return page;
}

export function parseSitemap(xml: string): { kind: string; locations: string[] } {
  const parser = sax.parser(true, { xmlns: true, trim: true });
  const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const locations: string[] = [];
  const elements: string[] = [];
  let kind = '';
  let entryHasLocation = false;
  let location: string | undefined;
  parser.ondoctype = () => { throw new Error('Sitemap must not contain a doctype'); };
  parser.onopentag = (node) => {
    require('local' in node && 'uri' in node, 'Sitemap namespaces required');
    require(location === undefined, 'Sitemap location must contain text only');
    if (elements.length === 0) {
      kind = node.local;
      require(['urlset', 'sitemapindex'].includes(kind) && node.uri === namespace, 'Invalid sitemap root or namespace');
    } else if (elements.length === 1) {
      require(node.local === (kind === 'urlset' ? 'url' : 'sitemap') && node.uri === namespace, 'Invalid sitemap entry');
      entryHasLocation = false;
    }
    if (node.local === 'loc') {
      require(elements.length === 2 && node.uri === namespace && !entryHasLocation, 'Invalid or repeated sitemap loc element');
      location = '';
    }
    elements.push(node.local);
  };
  parser.ontext = (text) => { if (location !== undefined) location += text; };
  parser.oncdata = parser.ontext;
  parser.onclosetag = () => {
    const name = elements.pop();
    if (name === 'loc') {
      require(location, 'Empty sitemap location');
      locations.push(location);
      location = undefined;
      entryHasLocation = true;
    } else if (elements.length === 1) require(entryHasLocation, 'Sitemap entry has no location');
  };
  parser.write(xml).close();
  require(kind && locations.length && elements.length === 0, 'Empty or incomplete sitemap');
  require(new Set(locations).size === locations.length, 'Duplicate sitemap location');
  return { kind, locations };
}

export function pagePath(name: string): string {
  return name === '404.html' ? '/404/' : name === 'index.html' ? '/' : `/${name.replace(/index\.html$/, '')}`;
}

function internal(url: string, path: string): URL | undefined {
  const target = new URL(url, origin + path);
  return target.origin === origin ? target : undefined;
}

export function validatePages(pages: Map<string, Page>, files: Set<string>): Map<string, Set<string>> {
  const incoming = new Map<string, Set<string>>();
  for (const page of pages.values()) {
    const privatePage = page.path.startsWith('/admin/');
    const excluded = privatePage || /\/(404|search)\/$/.test(page.path);
    const noindex = page.robots.some((value) => value.split(/[,\s]+/).includes('noindex'));
    require(noindex === excluded, `${page.path}: incorrect indexing policy`);
    if (privatePage) continue;
    const self = origin + page.path;
    require(page.canonical.length === 1 && page.canonical[0] === self, `${page.path}: canonical must identify this page exactly once`);
    require(page.og.length === 1 && page.og[0] === self, `${page.path}: incorrect Open Graph URL`);
    const locale = page.path.split('/')[1];
    const lang = locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale === 'ru' ? 'ru' : 'en';
    require(page.lang === lang, `${page.path}: incorrect document language`);
    if (excluded) {
      require(page.alternates.length === 0, `${page.path}: excluded page has hreflang`);
      if (page.path.endsWith('/search/')) require(page.robots.length === 1 && page.robots[0] === 'noindex, follow', `${page.path}: search must follow links`);
    } else {
      const languages = ['en', 'ru', 'zh-CN', 'pt-BR', 'x-default'];
      require(page.alternates.length === languages.length && languages.every((language) => page.alternates.filter((alternate) => alternate.lang === language).length === 1), `${page.path}: conflicting or missing alternates`);
      const suffix = ['ru', 'zh-cn', 'pt-br'].includes(locale!) ? page.path.slice(locale!.length + 1) : page.path;
      for (const alternate of page.alternates) {
        const prefix = ['en', 'x-default'].includes(alternate.lang) ? '' : '/' + alternate.lang.toLowerCase();
        require(alternate.href === origin + prefix + suffix, `${page.path}: incorrect alternate ${alternate.lang}`);
        const target = pages.get(new URL(alternate.href).pathname);
        require(target && target.canonical.length === 1 && target.canonical[0] === alternate.href, `${page.path}: missing or noncanonical alternate target`);
        require(target.alternates.some((back) => back.lang === lang && back.href === self), `${page.path}: nonreciprocal alternate`);
      }
    }
    for (const reference of page.references) {
      require(!(reference.tag === 'a' && new URL(reference.url, origin + page.path).pathname.toLowerCase().endsWith('.png')), `${page.path}: PNG formatted as a page link`);
      const target = internal(reference.url, page.path);
      if (!target) continue;
      const targetPage = pages.get(target.pathname);
      const filename = decodeURIComponent(target.pathname).slice(1);
      require(targetPage || files.has(filename), `${page.path}: broken ${reference.tag} target ${reference.url}`);
      if (target.hash) require(targetPage?.ids.has(decodeURIComponent(target.hash.slice(1))), `${page.path}: broken fragment ${reference.url}`);
      if (reference.tag === 'a') {
        const key = target.pathname + target.search;
        if (!incoming.has(key)) incoming.set(key, new Set());
        incoming.get(key)!.add(page.path);
      }
    }
  }
  return incoming;
}

export function wordCount(text: string, locale: string): number {
  return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].filter((part) => part.isWordLike).length;
}

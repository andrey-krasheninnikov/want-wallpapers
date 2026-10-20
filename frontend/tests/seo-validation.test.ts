import { test, expect } from 'bun:test';
import type { APIContext } from 'astro';
import { GET } from '../src/pages/llms.txt';
import { collections, locales } from '../src/data/catalog';
import { collectionStories, editorialCopy } from '../src/data/editorial';
import { origin, parsePage, parseSitemap, validatePages, validateRobots, validateLlms, wordCount, pageMetrics, validateContentMetrics, validateLocalizedContent, validateCityLinks } from '../scripts/seo-validation';

const languages = ['en', 'ru', 'zh-CN', 'pt-BR', 'ja', 'ar'];
async function localizedPages(fallback = '') {
  const paths = ['/', '/ru/', '/zh-cn/', '/pt-br/', '/ja/', '/ar/'];
  const pages = await Promise.all(paths.map((path, index) => parsePage(`<!doctype html><html lang="${languages[index]}" dir="${languages[index] === 'ar' ? 'rtl' : 'ltr'}"><head><link rel="canonical" href="${origin}${path}"><meta property="og:url" content="${origin}${path}">${paths.map((target, index) => `<link rel="alternate" hreflang="${languages[index]}" dir="${languages[index] === 'ar' ? 'rtl' : 'ltr'}" href="${origin}${target}">`).join('')}<link rel="alternate" hreflang="x-default" href="${origin}/"></head><body><main id="main">Visible text</main><noscript>${index === 0 ? fallback : ''}</noscript><script>hidden content</script><a href="#main">Skip</a></body></html>`, path)));
  return new Map(pages.map((page) => [page.path, page]));
}

test('HTML parsing preserves attributes, fragments, scripts and locale reciprocity', async () => {
  const pages = await localizedPages();
  expect(() => validatePages(pages, new Set())).not.toThrow();
  expect(pages.get('/')!.text).not.toContain('hidden content');
  expect(pages.get('/')!.scripts[0]!.text).toBe('hidden content');
  expect(pages.get('/')!.ids.has('main')).toBe(true);
});

test('no-script fallback markup contributes text and checked references', async () => {
  const pages = await localizedPages('<a href="/missing/">Fallback</a><form action="/downloads/picture.png"><button>Save</button></form>');
  const page = pages.get('/')!;
  expect(page.text).toContain('Fallback');
  expect(page.text).not.toContain('href=');
  expect(page.references).toContainEqual({ tag: 'form', url: '/downloads/picture.png' });
  expect(() => validatePages(pages, new Set(['downloads/picture.png']))).toThrow(/broken.*missing/);
  page.references = page.references.filter((reference) => reference.url !== '/missing/');
  expect(() => validatePages(pages, new Set(['downloads/picture.png']))).not.toThrow();
});

test('broken addresses and fragments fail the graph check', async () => {
  for (const url of ['/missing/', '/ru/#missing']) {
    const pages = await localizedPages();
    pages.get('/')!.references.push({ tag: 'a', url });
    expect(() => validatePages(pages, new Set())).toThrow(/broken/);
  }
});

test('conflicting and noncanonical alternates fail', async () => {
  const pages = await localizedPages();
  pages.get('/')!.alternates.push({ lang: 'ru', href: origin + '/ru/' });
  expect(() => validatePages(pages, new Set())).toThrow(/conflicting/);
  pages.get('/')!.alternates.pop();
  pages.get('/ru/')!.canonical = [origin + '/'];
  expect(() => validatePages(pages, new Set())).toThrow(/noncanonical/);
});

async function localizedErrorPages() {
  const paths = ['/404/', '/ru/404/', '/zh-cn/404/', '/pt-br/404/', '/ja/404/', '/ar/404/'];
  const pages = await Promise.all(paths.map((path, index) => parsePage(`<html lang="${languages[index]}" dir="${languages[index] === 'ar' ? 'rtl' : 'ltr'}"><head><meta name="robots" content="noindex"><link rel="canonical" href="${origin}${path}"><meta property="og:url" content="${origin}${path}"></head><body><main id="main">Page not found</main></body></html>`, path)));
  return new Map(pages.map((page) => [page.path, page]));
}

test('public navigation rejects localized error routes even when their HTML exists', async () => {
  for (const path of ['/404/', '/ru/404/', '/zh-cn/404/', '/pt-br/404/', '/ja/404/', '/ar/404/']) {
    const pages = await localizedPages(`<a href="${path}?from=home#main">Missing page</a>`);
    for (const [path, page] of await localizedErrorPages()) pages.set(path, page);
    expect(() => validatePages(pages, new Set())).toThrow(/error page target/);
  }
});

test('error pages retain navigation to home and their localized error documents', async () => {
  const pages = await localizedPages();
  const errors = await localizedErrorPages();
  for (const [path, page] of errors) {
    page.references.push({ tag: 'a', url: '/' });
    for (const target of errors.keys()) page.references.push({ tag: 'a', url: target });
    pages.set(path, page);
  }
  expect(() => validatePages(pages, new Set())).not.toThrow();
});

test('missing and nonreciprocal alternate targets fail', async () => {
  const missing = await localizedPages();
  missing.delete('/pt-br/');
  expect(() => validatePages(missing, new Set())).toThrow(/missing or noncanonical/);
  const nonreciprocal = await localizedPages();
  nonreciprocal.get('/ru/')!.alternates = nonreciprocal.get('/ru/')!.alternates.filter((alternate) => alternate.lang !== 'en');
  expect(() => validatePages(nonreciprocal, new Set())).toThrow(/nonreciprocal/);
});

test('indexable pages require one normalized self-canonical and English x-default', async () => {
  for (const canonical of [[origin + '/', origin + '/'], [origin + '/?q=city'], ['http://wallpapers.want.foundation/']]) {
    const pages = await localizedPages();
    pages.get('/')!.canonical = canonical;
    expect(() => validatePages(pages, new Set())).toThrow(/canonical/);
  }
  const pages = await localizedPages();
  pages.get('/')!.alternates.find((alternate) => alternate.lang === 'x-default')!.href = origin + '/ru/';
  expect(() => validatePages(pages, new Set())).toThrow(/incorrect alternate x-default/);
});

test('search, error and private pages never advertise localized alternates', async () => {
  for (const path of ['/search/', '/404/', '/admin/login/']) {
    const robots = path === '/search/' ? 'noindex, follow' : 'noindex';
    const page = await parsePage(`<html lang="en"><head><meta name="robots" content="${robots}"><link rel="canonical" href="${origin}${path}"><meta property="og:url" content="${origin}${path}"><link rel="alternate" hreflang="en" href="${origin}${path}"></head><body></body></html>`, path);
    expect(() => validatePages(new Map([[path, page]]), new Set())).toThrow(/excluded page has hreflang/);
  }
});

test('noindex search follows parameter links and does not emit alternates', async () => {
  const html = `<html lang="en"><head><link rel="canonical" href="${origin}/search/"><meta property="og:url" content="${origin}/search/"><meta name="robots" content="noindex, follow"></head><body><a href="/search/?q=city&amp;category=fantasy">City</a></body></html>`;
  const page = await parsePage(html, '/search/');
  const incoming = validatePages(new Map([[page.path, page]]), new Set());
  expect(incoming.get('/search/?q=city&category=fantasy')?.size).toBe(1);
});

test('ordinary PNG navigation is rejected while a native GET action is allowed', async () => {
  const pages = await localizedPages();
  const files = new Set(['downloads/picture.png']);
  pages.get('/')!.references.push({ tag: 'form', url: '/downloads/picture.png' });
  expect(() => validatePages(pages, files)).not.toThrow();
  pages.get('/')!.references.push({ tag: 'a', url: '/downloads/picture.png' });
  expect(() => validatePages(pages, files)).toThrow(/PNG/);
});

test('PNG page links are rejected after URL and HTML decoding, including no-script markup', async () => {
  for (const url of ['/downloads/picture.png', '/downloads/picture.PNG?view=1&amp;size=2#original', '/downloads/picture.%70%6e%67', '/downloads/picture%2Epng', 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/1-desktop.png?view=1#original']) {
    const pages = await localizedPages(`<a href="${url}">View original</a>`);
    expect(() => validatePages(pages, new Set(['downloads/picture.png']))).toThrow(/PNG formatted as a page link/);
  }
});

test('PNG images and native GET downloads retain resource semantics', async () => {
  for (const method of ['', 'method="get"', 'method="GET"', 'method=""', 'method="unknown"']) {
    const pages = await localizedPages(`<img src="https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/1-desktop.png" alt="Dark dunes"><form ${method} action="/downloads/picture.%70%6e%67?source=gallery"><button type="submit">Download PNG</button></form>`);
    expect(() => validatePages(pages, new Set(['downloads/picture.png']))).not.toThrow();
  }
});

test('PNG downloads reject POST and dialog forms, including encoded targets', async () => {
  for (const method of ['post', 'POST', 'dialog', 'DIALOG']) {
    for (const url of ['/downloads/picture.png', '/downloads/picture.%70%6e%67']) {
      const pages = await localizedPages(`<form method="${method}" action="${url}"><button type="submit">Download PNG</button></form>`);
      expect(() => validatePages(pages, new Set(['downloads/picture.png']))).toThrow(/PNG download must use GET/);
    }
  }
});

test('non-PNG page links and forms retain existing behavior', async () => {
  const pages = await localizedPages('<a href="/?image=picture.png#main">Gallery</a><form method="post" action="/"><button>Search</button></form>');
  expect(() => validatePages(pages, new Set())).not.toThrow();
});

test('strict sitemap XML decodes URLs and rejects malformed structure', () => {
  const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`;
  expect(parseSitemap(xml)).toEqual({ kind: 'urlset', locations: [origin + '/'] });
  const prefixed = xml.replace(/<(\/?)(urlset|url|loc)(?=[ >])/g, '<$1s:$2').replace('xmlns=', 'xmlns:s=');
  expect(parseSitemap(prefixed)).toEqual(parseSitemap(xml));
  const invalidEntries = [xml.replaceAll('<url>', '<wrong>').replaceAll('</url>', '</wrong>'), xml.replace('</loc>', '</loc><loc>' + origin + '/ru/</loc>'), xml.replace('<loc>' + origin + '/</loc>', ''), xml.replace(origin + '/', '<nested>' + origin + '/</nested>')];
  for (const invalid of invalidEntries) expect(() => parseSitemap(invalid)).toThrow();
  for (const invalid of [xml.replace('</url>', '</missing>'), xml.replace('http://www.sitemaps.org/schemas/sitemap/0.9', 'wrong'), '<urlset>', '<!DOCTYPE urlset>' + xml, xml.replace('<url>', '<url><loc></loc>')]) expect(() => parseSitemap(invalid)).toThrow();
});

test('Chinese content is segmented into words without inserting spaces', () => {
  expect(wordCount('选择适合手机屏幕的壁纸，并在下载前查看原始图片尺寸。', 'zh-CN')).toBeGreaterThan(10);
});

const publicRobots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: ${origin}/sitemap-index.xml
`;

test('robots accepts the public sitemap and rejects managed directives', () => {
  expect(() => validateRobots(publicRobots)).not.toThrow();
  expect(() => validateRobots(publicRobots + 'Content-Signal: search=yes\n')).toThrow(/directive/);
});

test('private exclusions must belong to the wildcard crawler group', () => {
  const misplaced = publicRobots.replace('Disallow: /admin/\nDisallow: /api/\n', '') + 'User-agent: ExampleCrawler\nDisallow: /admin/\nDisallow: /api/\n';
  expect(() => validateRobots(misplaced)).toThrow(/wildcard/);
});

test('crawler block groups cannot contain a more permissive path rule', () => {
  expect(() => validateRobots(publicRobots + 'User-agent: ExampleCrawler\nDisallow: /\n')).not.toThrow();
  expect(() => validateRobots(publicRobots + 'User-agent: ExampleCrawler\nDisallow: /\nAllow: /collections/\n')).toThrow(/block/);
});

test('published robots preserves every crawler block from the public edge baseline', async () => {
  const before = await Bun.file(new URL('../../docs/seo/2026-10-13-robots-before.txt', import.meta.url)).text();
  const robots = await Bun.file(new URL('../public/robots.txt', import.meta.url)).text();
  const agents = (text: string) => [...text.matchAll(/^User-agent:\s*(\S+)\s*$/gim)].map((match) => match[1]!.toLowerCase()).filter((name) => name !== '*').sort();
  expect(agents(before)).toHaveLength(47);
  expect(agents(robots)).toEqual(agents(before));
  expect(() => validateRobots(robots)).not.toThrow();
});

test('robots rejects missing, repeated and foreign sitemap locations', () => {
  for (const robots of [publicRobots.replace(`Sitemap: ${origin}/sitemap-index.xml\n`, ''), publicRobots + `Sitemap: ${origin}/sitemap-index.xml\n`, publicRobots.replace(origin, 'https://example.org')]) expect(() => validateRobots(robots)).toThrow(/sitemap/);
});

test('robots accepts comments and CRLF but rejects ungrouped rules and mixed wildcard agents', () => {
  expect(() => validateRobots('# Public policy\r\n' + publicRobots.replaceAll('\n', '\r\n'))).not.toThrow();
  expect(() => validateRobots('Disallow: /\n' + publicRobots)).toThrow(/group/);
  expect(() => validateRobots(publicRobots.replace('User-agent: *', 'User-agent: *\nUser-agent: ExampleCrawler'))).toThrow(/wildcard/);
});

test('llms response preserves license restrictions before localized file lists', async () => {
  const response = await GET({ site: new URL(origin) } as APIContext);
  const text = await response.text();
  expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  expect(text).toStartWith('# Want Wallpapers\n\n> ');
  expect(text).toContain('You may:\n\nDownload and use');
  expect(text).toContain('Please do not:\n\nSell, redistribute or upload');
  expect(text).toContain('Ownership:\n\nThe images remain');
  expect(text.indexOf('Please do not:')).toBeLessThan(text.indexOf('## en\n'));
  expect(text).not.toContain('## Usage license');
  for (const prefix of ['', '/ru', '/zh-cn', '/pt-br', '/ja', '/ar']) {
    expect(text).toContain(`](${origin}${prefix}/terms/)`);
    expect(text).toContain(`](${origin}${prefix}/license/)`);
    expect(text).toContain(`](${origin}${prefix}/collections/a-night-beneath-the-ice/)`);
  }
});

test('llms renders catalog Markdown and newlines as literal inline text', async () => {
  const collection = collections.find(({ id }) => id === '0001-contours-of-silence')!;
  const title = collection.title.en;
  const description = collection.description.en;
  let response: Response;
  try {
    collection.title.en = 'Line [one] \\ two\n第二行';
    collection.description.en = 'A [label](https://example.org/)\n## Injected heading';
    response = await GET({ site: new URL(origin) } as APIContext);
  } finally {
    collection.title.en = title;
    collection.description.en = description;
  }
  const line = (await response.text()).split('\n').find((line) => line.includes('/collections/contours-of-silence/'));
  expect(line).toBe('- [Line \\[one\\] \\\\ two 第二行](https://wallpapers.want.foundation/collections/contours-of-silence/): A \\[label\\](https://example.org/) ## Injected heading');
});

test('llms build validation rejects missing license labels and malformed file lists', async () => {
  const text = await (await GET({ site: new URL(origin) } as APIContext)).text();
  const indexed = new Set([...text.matchAll(/\]\((https:[^)]+)\)/g)].map((link) => link[1]!));
  expect(() => validateLlms(text, indexed)).not.toThrow();
  for (const invalid of [text.replace('Please do not:', ''), text.replace('## ru\n', '### ru\n'), text.replace('## en\n', '## Usage license\n\nProse\n\n## en\n'), text + 'Extra prose\n']) {
    expect(() => validateLlms(invalid, indexed)).toThrow();
  }
});

test('llms build validation requires current public catalog links in their locale', async () => {
  const text = await (await GET({ site: new URL(origin) } as APIContext)).text();
  const indexed = new Set([...text.matchAll(/\]\((https:[^)]+)\)/g)].map((link) => link[1]!));
  indexed.add(origin + '/api/v1/catalog');
  const invalidFiles = [
    text.replace(origin + '/collections/contours-of-silence/', 'https://example.org/collections/contours-of-silence/'),
    text.replace(/^.*\]\(https:\/\/wallpapers\.want\.foundation\/collections\/contours-of-silence\/\).*\n/m, ''),
    text.replace(origin + '/ru/license/', origin + '/license/'),
    text.replace(/## pt-br\n[\s\S]+$/, '## pt-br\n'),
    text + `- [Private](${origin}/api/v1/catalog)\n`,
  ];
  for (const invalid of invalidFiles) expect(() => validateLlms(invalid, indexed)).toThrow();
});


test('content metrics use UTF-8 bytes and compare ratios before rounding', async () => {
  const page = await parsePage('<html lang="zh-CN"><body><main>蓝色光线壁纸图</main></body></html>', '/zh-cn/');
  page.bytes = 209;
  const metrics = pageMetrics(page);
  expect(metrics.textBytes).toBe(21);
  expect(metrics.ratio).toBeCloseTo(21 / 209 * 100, 10);
  expect(metrics.ratio).toBeGreaterThan(10);
  expect(Math.round(metrics.ratio * 10) / 10).toBe(10);
  expect(() => validateContentMetrics({ ...metrics, words: 200 })).not.toThrow();
  expect(() => validateContentMetrics({ ...metrics, words: 200, ratio: 10 })).toThrow(/text\/HTML/);
});

test('content validation keeps the 200-word boundary and reports noindex pages', async () => {
  const page = await parsePage('<html lang="en"><body><main>' + 'word '.repeat(200) + '</main></body></html>', '/');
  const metrics = pageMetrics(page);
  expect(metrics.words).toBe(200);
  expect(() => validateContentMetrics(metrics)).not.toThrow();
  expect(() => validateContentMetrics({ ...metrics, words: 199 })).toThrow(/200/);
  page.path = '/search/';
  page.robots = ['noindex, follow'];
  page.text = 'Search';
  const search = pageMetrics(page);
  expect(search.indexable).toBe(false);
  expect(search.words).toBe(1);
  expect(search.ratio).toBeLessThan(10);
  expect(() => validateContentMetrics(search)).not.toThrow();
});

test('localized story cards must be in main content, not metadata or hidden markup', async () => {
  for (const locale of locales) {
    const path = (locale === 'en' ? '' : '/' + locale) + '/collections/';
    const title = editorialCopy[locale].title;
    const paragraphs = collections.map(collection => collectionStories[collection.slug]![locale][0]!);
    const content = [title, editorialCopy[locale].licenseText, ...collections.map(collection => collection.title[locale]), ...paragraphs].join(' ');
    const lang = locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale;
    const page = await parsePage(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><body><main>${content}</main></body></html>`, path);
    expect(() => validateLocalizedContent(page)).not.toThrow();
    const missing = await parsePage(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta name="description" content="${content}"></head><body><nav>${content}</nav><main>English fallback<p hidden>${content}</p><script>${content}</script></main></body></html>`, path);
    expect(missing.mainText).toBe('English fallback');
    expect(() => validateLocalizedContent(missing)).toThrow(/localized main content/);
  }
});

test('city search needs distinct contextual source pages, excluding navigation and self-links', async () => {
  const first = await parsePage('<html lang="en"><body><main><a href="/search/?q=city">City</a><a href="/search/?q=city">City again</a></main></body></html>', '/collections/path-to-the-light/');
  const navigation = await parsePage('<html lang="en"><body><nav><a href="/search/?q=city">City</a></nav><main>Gallery</main><footer><a href="/search/?q=city">City</a></footer></body></html>', '/collections/');
  const search = await parsePage('<html lang="en"><head><meta name="robots" content="noindex, follow"></head><body><main><a href="#main">City</a></main></body></html>', '/search/?q=city');
  const pages = new Map([first, navigation, search].map(page => [page.path, page]));
  expect(() => validateCityLinks(pages)).toThrow(/two contextual/);
  search.robots = [];
  expect(() => validateCityLinks(pages)).toThrow(/two contextual/);
  const hidden = await parsePage('<html lang="en"><body><main><p hidden><a href="/search/?q=city">City</a></p><p aria-hidden="true"><a href="/search/?q=city">City</a></p></main></body></html>', '/wallpapers/path-to-the-light-1/');
  pages.set(hidden.path, hidden);
  expect(() => validateCityLinks(pages)).toThrow(/two contextual/);
  const second = await parsePage('<html lang="en"><body><main><a href="/search/?q=city">City</a></main></body></html>', '/wallpapers/path-to-the-light-1/');
  pages.set(second.path, second);
  expect(() => validateCityLinks(pages)).not.toThrow();
});


test('same-origin PNG download anchors retain download semantics', async () => {
  const files = new Set(['downloads/picture.png']);
  const pages = await localizedPages('<a href="/downloads/picture.png" download="picture.png">Download PNG</a>');
  expect(pages.get('/')!.references).toContainEqual({ tag: 'a', url: '/downloads/picture.png', download: true });
  expect(() => validatePages(pages, files)).not.toThrow();
  const external = await localizedPages('<a href="https://example.com/picture.png" download>Download PNG</a>');
  expect(() => validatePages(external, files)).toThrow(/PNG formatted as a page link/);
});


test('Arabic SEO requires RTL document direction', async () => {
  const pages = await localizedPages(); pages.get('/ar/')!.dir = 'ltr';
  expect(() => validatePages(pages, new Set())).toThrow('incorrect document direction');
});

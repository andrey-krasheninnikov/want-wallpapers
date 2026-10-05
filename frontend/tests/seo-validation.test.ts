import { test, expect } from 'bun:test';
import { origin, parsePage, parseSitemap, validatePages, wordCount } from '../scripts/seo-validation';

const languages = ['en', 'ru', 'zh-CN', 'pt-BR'];
async function localizedPages() {
  const paths = ['/', '/ru/', '/zh-cn/', '/pt-br/'];
  const pages = await Promise.all(paths.map((path, index) => parsePage(`<!doctype html><html lang="${languages[index]}"><head><link rel="canonical" href="${origin}${path}"><meta property="og:url" content="${origin}${path}">${paths.map((target, index) => `<link rel="alternate" hreflang="${languages[index]}" href="${origin}${target}">`).join('')}<link rel="alternate" hreflang="x-default" href="${origin}/"></head><body><main id="main">Visible text</main><script>hidden content</script><a href="#main">Skip</a></body></html>`, path)));
  return new Map(pages.map((page) => [page.path, page]));
}

test('HTML parsing preserves attributes, fragments, scripts and locale reciprocity', async () => {
  const pages = await localizedPages();
  expect(() => validatePages(pages, new Set())).not.toThrow();
  expect(pages.get('/')!.text).not.toContain('hidden content');
  expect(pages.get('/')!.scripts[0]!.text).toBe('hidden content');
  expect(pages.get('/')!.ids.has('main')).toBe(true);
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

test('strict sitemap XML decodes URLs and rejects malformed structure', () => {
  const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`;
  expect(parseSitemap(xml)).toEqual({ kind: 'urlset', locations: [origin + '/'] });
  for (const invalid of [xml.replace('</url>', '</missing>'), xml.replace('http://www.sitemaps.org/schemas/sitemap/0.9', 'wrong'), '<urlset>', '<!DOCTYPE urlset>' + xml, xml.replace('<url>', '<url><loc></loc>')]) expect(() => parseSitemap(invalid)).toThrow();
});

test('Chinese content is segmented into words without inserting spaces', () => {
  expect(wordCount('选择适合手机屏幕的壁纸，并在下载前查看原始图片尺寸。', 'zh-CN')).toBeGreaterThan(10);
});

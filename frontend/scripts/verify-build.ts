import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { origin, parsePage, parseSitemap, pagePath, validatePages, validateRobots, validateLlms, pageMetrics, validateContentMetrics, validateLocalizedContent, validateCityLinks, require, type Page } from './seo-validation';

const root = resolve(import.meta.dir, '../dist');
const hashes = JSON.parse(await readFile(join(root, 'csp-hashes.json'), 'utf8')) as Record<string, string[]>;
const files = new Set<string>();
const pages = new Map<string, Page>();
async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await scan(path); continue; }
    const name = relative(root, path).replaceAll('\\', '/');
    files.add(name);
    if (!name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    const page = await parsePage(html, pagePath(name));
    pages.set(page.path, page);
    for (const script of page.scripts) {
      if (script.source) continue;
      const hash = `sha256-${createHash('sha256').update(script.text).digest('base64')}`;
      require(hashes[`/${name}`]?.includes(hash), `${name}: inline script missing CSP hash`);
      if (script.type === 'application/ld+json') JSON.parse(script.text);
    }
    if (name.startsWith('admin/')) require(!/ipwho\.is|googletagmanager\.com|google-analytics\.com/.test(html), `${name}: private page includes tracking`);
    if (!name.startsWith('admin/')) {
      const comments: string[] = [];
      const descriptions: { href: string | null; type: string | null }[] = [];
      await new HTMLRewriter().on('link[rel="describedby"]', { element(element) { descriptions.push({ href: element.getAttribute('href'), type: element.getAttribute('type') }); } })
        .onDocument({ comments(comment) { comments.push(comment.text); } }).transform(new Response(html)).text();
      require(descriptions.length === 1 && descriptions[0]!.href === origin + '/llms.txt' && descriptions[0]!.type === 'text/plain', `${name}: missing llms.txt discovery`);
      require(comments.includes('email_off') && comments.includes('/email_off'), `${name}: missing email protection opt-out comments`);
      const protectedHtml = html.replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, '');
      require(!protectedHtml.includes('wallpapers@want.foundation'), `${name}: unprotected email fragment`);
    }
  }
}
await scan(root);
validatePages(pages, files);
validateCityLinks(pages);
const indexed = new Set([...pages.values()].filter((page) => !page.robots.some((value) => value.includes('noindex'))).map((page) => origin + page.path));
const sitemapPages = new Set<string>();
const index = parseSitemap(await readFile(join(root, 'sitemap-index.xml'), 'utf8'));
require(index.kind === 'sitemapindex', 'Expected sitemap index');
for (const location of index.locations) {
  const url = new URL(location);
  require(url.origin === origin && files.has(url.pathname.slice(1)), 'Invalid sitemap index target');
  const sitemap = parseSitemap(await readFile(join(root, url.pathname.slice(1)), 'utf8'));
  require(sitemap.kind === 'urlset', 'Expected sitemap URL set');
  for (const location of sitemap.locations) {
    require(indexed.has(location) && !sitemapPages.has(location), `Nonindexable, missing or duplicate sitemap page: ${location}`);
    sitemapPages.add(location);
  }
}
require(sitemapPages.size === indexed.size, 'Sitemap omits indexable pages');
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
validateRobots(robots);
const llms = await readFile(join(root, 'llms.txt'), 'utf8');
validateLlms(llms, indexed);
const content = [...pages.values()].filter((page) => !page.path.startsWith('/admin/'));
const metrics = content.map((page) => {
  validateLocalizedContent(page);
  const metrics = pageMetrics(page);
  validateContentMetrics(metrics);
  return metrics;
});
const indexable = metrics.filter((page) => page.indexable);
console.log(`Verified links, fragments, canonical, reciprocal hreflang, sitemap, robots, llms and CSP for ${pages.size} HTML pages.`);
console.log(`Local text metrics: ${indexable.length} indexable pages pass 200 segmented words and more than 10% text/HTML; ${metrics.length - indexable.length} noindex public pages remain in the report. These estimates are not a production audit.`);
await Bun.write(join(tmpdir(), `${basename(resolve(root, '../..'))}-seo-metrics.json`), JSON.stringify(metrics, null, 2) + '\n');

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { origin, parsePage, parseSitemap, pagePath, validatePages, wordCount, require, type Page } from './seo-validation';

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
      await new HTMLRewriter().onDocument({ comments(comment) { comments.push(comment.text); } }).transform(new Response(html)).text();
      require(comments.includes('email_off') && comments.includes('/email_off'), `${name}: missing email protection opt-out comments`);
      const protectedHtml = html.replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, '');
      require(!protectedHtml.includes('wallpapers@want.foundation'), `${name}: unprotected email fragment`);
    }
  }
}
await scan(root);
const incoming = validatePages(pages, files);
require((incoming.get('/search/?q=city')?.size ?? 0) >= 2, 'City search needs two contextual source pages');
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
for (const line of robots.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))) require(/^(User-agent|Allow|Disallow|Sitemap):\s*\S+/i.test(line), `Invalid origin robots directive: ${line}`);
require(robots.includes(`${origin}/sitemap-index.xml`) && robots.includes('Disallow: /admin/') && robots.includes('Disallow: /api/'), 'Invalid robots.txt');
const llms = await readFile(join(root, 'llms.txt'), 'utf8');
require(llms.startsWith('# Want Wallpapers\n\n> ') && llms.includes('## Usage license'), 'Invalid llms.txt structure');
for (const locale of ['en', 'ru', 'zh-cn', 'pt-br']) require(llms.includes(`## ${locale}\n`), `llms.txt missing ${locale}`);
for (const link of llms.matchAll(/\]\(([^)]+)\)/g)) require(indexed.has(link[1]!), `Invalid llms.txt public link: ${link[1]}`);
require(!/\/(admin|api)\//.test(llms), 'Private link in llms.txt');
const content = [...pages.values()].filter((page) => !page.robots.some((value) => value.includes('noindex')));
const metrics = content.map((page) => ({ path: page.path, words: wordCount(page.text, page.lang), ratio: Math.round(Buffer.byteLength(page.text) / page.bytes * 1000) / 10, htmlBytes: page.bytes }));
console.log(`Verified links, fragments, canonical, reciprocal hreflang, sitemap, robots, llms and CSP for ${pages.size} HTML pages.`);
console.log(`Local text metrics: ${metrics.filter((page) => page.words < 200).length} pages below 200 segmented words; ${metrics.filter((page) => page.ratio <= 10).length} at or below 10% text/HTML. These estimates are not a production audit.`);
await Bun.write(join(tmpdir(), `${basename(resolve(root, '../..'))}-seo-metrics.json`), JSON.stringify(metrics, null, 2) + '\n');

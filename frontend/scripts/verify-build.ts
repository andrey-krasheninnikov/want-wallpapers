import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
const root = resolve(import.meta.dir, '../dist');
const origin = 'https://wallpapers.want.foundation';
const hashes = JSON.parse(await readFile(join(root, 'csp-hashes.json'), 'utf8')) as Record<string, string[]>;
let pages = 0;
function require(condition: boolean, message: string) { if (!condition) throw new Error(message); }
async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await scan(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const name = relative(root, path).replaceAll('\\', '/');
    const html = await readFile(path, 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts) {
      if (/\bsrc\s*=/i.test(script[1]!)) continue;
      const hash = `sha256-${createHash('sha256').update(script[2]!).digest('base64')}`;
      require(hashes[`/${name}`]?.includes(hash) ?? false, `${name}: inline script missing CSP hash`);
      if (script[1]!.includes('application/ld+json')) JSON.parse(script[2]!);
    }
    if (name.startsWith('admin/')) {
      require(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `${name}: missing noindex`);
      require(!/ipwho\.is|googletagmanager\.com|google-analytics\.com/.test(html), `${name}: private page includes tracking`);
    } else {
      require(html.includes(`rel="canonical" href="${origin}/`), `${name}: incorrect canonical domain`);
      for (const language of ['en', 'ru', 'zh-CN', 'pt-BR', 'x-default']) {
        require(html.includes(`hreflang="${language}" href="${origin}/`), `${name}: missing localized alternate ${language}`);
      }
      require(html.includes(`property="og:url" content="${origin}/`), `${name}: incorrect Open Graph domain`);
    }
    pages++;
  }
}
await scan(root);
for (const name of ['404.html', 'ru/404/index.html', 'zh-cn/404/index.html', 'pt-br/404/index.html']) {
  const html = await readFile(join(root, name), 'utf8');
  require(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `${name}: missing noindex`);
}
for (const name of await readdir(root)) {
  if (!name.startsWith('sitemap') || !name.endsWith('.xml')) continue;
  const xml = await readFile(join(root, name), 'utf8');
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1]!);
    require(url.origin === origin && !/^\/(admin|api)(\/|$)/.test(url.pathname) && !url.pathname.endsWith('/404/'), `${name}: private, error or incorrect-domain URL`);
  }
}
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
require(robots.includes(`${origin}/sitemap-index.xml`) && robots.includes('Disallow: /admin/') && robots.includes('Disallow: /api/'), 'Invalid robots.txt');
console.log(`Verified SEO and CSP for ${pages} HTML pages.`);

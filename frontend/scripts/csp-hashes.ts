import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
const root = resolve(import.meta.dir, '../dist');
const hashes: Record<string, string[]> = {};
const cached = new Set<string>();
async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith('.html')) {
      let html = await readFile(path, 'utf8');
      // shortcut: matches the current Astro bootstrap; review when upgrading Astro.
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const source = match[2]!;
        if (match[1]!.trim() || !source.includes('customElements.define("astro-island",')) continue;
        assert(!/currentScript|import\.meta/.test(source), 'Hydration bootstrap requires its inline context');
        const asset = `island.${createHash('sha256').update(source).digest('hex')}.js`;
        if (!cached.has(asset)) { await writeFile(join(root, '_astro', asset), source); cached.add(asset); }
        html = html.replace(match[0], `<script defer src="/_astro/${asset}"></script>`);
      }
      await writeFile(path, html);
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((match) => !/\bsrc\s*=/i.test(match[1]!))
        .map((match) => `sha256-${createHash('sha256').update(match[2]!).digest('base64')}`);
      const name = relative(root, path).replaceAll('\\', '/');
      const route = name === 'index.html' ? '/' : name.endsWith('/index.html') ? `/${name.slice(0, -10)}` : `/${name.slice(0, -5)}/`;
      hashes[route] = [...new Set(scripts)];
      hashes[`/${name}`] = hashes[route]!;
      if (route !== '/') hashes[route.slice(0, -1)] = hashes[route]!;
    }
  }
}
await scan(root);
await writeFile(join(root, 'csp-hashes.json'), JSON.stringify(hashes));

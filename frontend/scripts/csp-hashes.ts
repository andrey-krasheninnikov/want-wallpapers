import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
const root = resolve(import.meta.dir, '../dist');
const hashes: Record<string, string[]> = {};
async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
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

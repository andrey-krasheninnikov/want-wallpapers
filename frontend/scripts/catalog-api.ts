import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
export function apiOrigin() {
  const value = process.env.BACKEND_API_URL ?? 'https://wallpapers.want.foundation';
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('BACKEND_API_URL must be an HTTPS origin or local HTTP origin.');
  return url.origin;
}
export async function catalogRequest<T>(path: string, input?: unknown): Promise<T> {
  const file = process.env.CATALOG_API_TOKEN_FILE;
  if (!file) throw new Error('Set CATALOG_API_TOKEN_FILE to a token file outside the repository.');
  const root = await realpath(resolve(import.meta.dir, '../..'));
  const tokenPath = relative(root, await realpath(file));
  if (!tokenPath.startsWith('../')) throw new Error('The catalog token must be outside the repository.');
  const token = (await readFile(file, 'utf8')).trim();
  if (token.length < 32) throw new Error('Catalog token must contain at least 32 characters.');
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api/v1/admin/catalog${path}`, {
      method: input === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Catalog request failed. Reconcile server state before retrying.'); }
  if (!response.ok) throw new Error(`Catalog request failed (HTTP ${response.status}). Reconcile server state before retrying.`);
  return response.json() as Promise<T>;
}

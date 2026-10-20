import { createHash, randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, unlinkSync, chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { locales, type Locale } from '../src/data/catalog';
import { parseCollectionManifest, type CollectionManifest } from './catalog-add';

sharp.concurrency(1);
sharp.cache(false);
export const destinations = ['telegram', 'pinterest', 'tumblr', 'deviantart', 'flickr'] as const;
export type Destination = typeof destinations[number];
export type Asset = {
  path: string; role: 'native' | 'composition' | 'final' | 'preview' | 'social' | 'emoji' | 'emoji-source';
  design: number; variant?: 'desktop' | 'mobile'; sha256: string; width: number; height: number;
  source?: string; name?: string; emoji?: string;
};
export type CollectionPackage = {
  schemaVersion: 1; revision: number; theme: string; manifest: CollectionManifest;
  stories: Record<Locale, string[]>;
  copy: Record<Destination, { title: string; description: string }[]>;
  assets: Asset[];
};
export const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function requirePackage(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  requirePackage(value === null || ['string', 'boolean', 'number'].includes(typeof value), 'invalid-package-value');
  return JSON.stringify(value);
}
export function privateRoot(input: string, create = false): string {
  const root = resolve(input);
  let parent = root;
  while (!existsSync(parent)) parent = dirname(parent);
  requirePackage(realpathSync(parent) === parent, 'symlink-package-root');
  const git = spawnSync('git', ['-C', parent, 'rev-parse', '--is-inside-work-tree', '--is-inside-git-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  requirePackage(!git.stdout?.trim().split('\n').includes('true'), 'package-must-be-outside-git');
  if (create) mkdirSync(root, { recursive: true, mode: 0o700 });
  const details = lstatSync(root);
  requirePackage(details.isDirectory() && !details.isSymbolicLink() && details.uid === process.getuid?.() && !(details.mode & 0o077), 'private-package-directory-required');
  return root;
}
export function packagePath(root: string, name: string): string {
  requirePackage(typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9/._-]{0,240}$/.test(name)
    && !isAbsolute(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'invalid-package-path');
  const path = resolve(root, name);
  requirePackage(!relative(root, path).startsWith('..'), 'invalid-package-path');
  let current = root;
  for (const part of name.split('/')) {
    current = join(current, part);
    const details = lstatSync(current, { throwIfNoEntry: false });
    if (details) requirePackage(!details.isSymbolicLink(), 'symlink-package-file');
  }
  return path;
}
export function writePrivate(path: string, value: string | Uint8Array): void {
  const temporary = path + '.' + randomUUID();
  try {
    writeFileSync(temporary, value, { flag: 'wx', mode: 0o600 });
    const file = openSync(temporary, 'r');
    try { fsyncSync(file); } finally { closeSync(file); }
    renameSync(temporary, path);
    const directory = openSync(dirname(path), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
export function readPackageJson(path: string): any {
  const details = lstatSync(path);
  requirePackage(details.isFile() && !details.isSymbolicLink() && details.size <= 2 * 1024 * 1024 && !(details.mode & 0o077), 'private-package-file-required');
  return JSON.parse(readFileSync(path, 'utf8'));
}
function text(value: unknown, max = 2000): asserts value is string {
  requirePackage(typeof value === 'string' && value.trim() && value.length <= max && !value.includes('\0'), 'invalid-package-text');
}
export async function validatePackage(input: string): Promise<{ root: string; value: CollectionPackage; packageHash: string }> {
  const root = privateRoot(input), value = readPackageJson(packagePath(root, 'package.json')) as CollectionPackage;
  requirePackage(Object.keys(value).sort().join(',') === 'assets,copy,manifest,revision,schemaVersion,stories,theme', 'invalid-package-fields');
  requirePackage(value.schemaVersion === 1 && Number.isSafeInteger(value.revision) && value.revision > 0, 'unsupported-package-version');
  text(value.theme);
  parseCollectionManifest(value.manifest);
  requirePackage(value.manifest.collection.count === 5 && value.manifest.wallpapers.every((item, index) => item.number === index + 1), 'five-ordered-designs-required');
  requirePackage(value.stories && Object.keys(value.stories).length === locales.length, 'six-stories-required');
  for (const locale of locales) {
    requirePackage(Array.isArray(value.stories[locale]) && value.stories[locale].length >= 1 && value.stories[locale].length <= 12, 'six-stories-required');
    value.stories[locale].forEach(paragraph => text(paragraph, 8000));
  }
  requirePackage(value.copy && Object.keys(value.copy).length === destinations.length, 'destination-copy-required');
  for (const destination of destinations) {
    const posts = value.copy[destination];
    requirePackage(Array.isArray(posts) && posts.length === (['telegram', 'tumblr'].includes(destination) ? 1 : 5), 'destination-copy-required');
    posts.forEach(post => { text(post.title, 100); text(post.description, destination === 'telegram' ? 700 : 2000); });
  }
  requirePackage(Array.isArray(value.assets) && value.assets.length <= 70, 'invalid-package-assets');
  const paths = new Set<string>(), slots = new Set<string>();
  for (const asset of value.assets) {
    requirePackage(asset && Number.isInteger(asset.design) && asset.design >= 1 && asset.design <= 5
      && ['native', 'composition', 'final', 'preview', 'social', 'emoji', 'emoji-source'].includes(asset.role)
      && /^[a-f0-9]{64}$/.test(asset.sha256), 'invalid-package-asset');
    if (asset.name !== undefined || asset.emoji !== undefined) {
      requirePackage(['emoji', 'emoji-source'].includes(asset.role), 'emoji-metadata-role-required');
      text(asset.name, 80);
      requirePackage(typeof asset.emoji === 'string' && asset.emoji.length <= 32
        && new RegExp('^\\p{RGI_Emoji}$', 'v').test(asset.emoji), 'one-unicode-emoji-required');
    }
    const variantRole = ['native', 'composition', 'final', 'preview'].includes(asset.role);
    requirePackage(variantRole ? ['desktop', 'mobile'].includes(asset.variant ?? '') : asset.variant === undefined, 'invalid-asset-variant');
    const slot = `${asset.role}:${asset.design}:${asset.variant ?? ''}`;
    requirePackage(!paths.has(asset.path) && !slots.has(slot), 'duplicate-package-asset');
    paths.add(asset.path); slots.add(slot);
    const path = packagePath(root, asset.path), details = lstatSync(path);
    requirePackage(details.isFile() && details.size > 0 && details.size <= 64 * 1024 * 1024 && !(details.mode & 0o077), 'invalid-asset-file');
    const bytes = readFileSync(path);
    requirePackage(digest(bytes) === asset.sha256, 'asset-hash-mismatch');
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 }), metadata = await image.metadata();
    requirePackage(metadata.width === asset.width && metadata.height === asset.height && (metadata.pages ?? 1) === 1, 'asset-dimensions-mismatch');
    requirePackage(metadata.format === (asset.role === 'preview' ? 'webp' : asset.role === 'social' ? 'jpeg' : 'png'), 'invalid-asset-format');
    await image.clone().raw().toBuffer();
    if (asset.role === 'emoji') {
      requirePackage(asset.width === 100 && asset.height === 100 && metadata.hasAlpha && (await image.stats()).isOpaque === false, 'transparent-emoji-required');
      const source = value.assets.find(item => item.path === asset.source && item.role === 'emoji-source' && item.design === asset.design);
      requirePackage(source && source.name === asset.name && source.emoji === asset.emoji, 'emoji-metadata-mismatch');
    }
    if (asset.role === 'final') {
      requirePackage(asset.width === (asset.variant === 'desktop' ? 3840 : 2160) && asset.height === (asset.variant === 'desktop' ? 2160 : 3840), 'final-4k-required');
      const source = value.assets.find(item => item.path === asset.source);
      requirePackage(source && ['native', 'composition'].includes(source.role) && source.design === asset.design && source.variant === asset.variant
        && source.width * asset.height === source.height * asset.width, 'extend-composition-before-resizing');
    }
    if (asset.role === 'composition') requirePackage(value.assets.some(item => item.path === asset.source && item.role === 'native' && item.design === asset.design && item.variant === asset.variant), 'native-source-required');
    if (asset.role === 'preview') requirePackage(asset.width === (asset.variant === 'desktop' ? 960 : 540) && asset.height === (asset.variant === 'desktop' ? 540 : 960), 'preview-size-required');
    if (asset.role === 'social') requirePackage(asset.width === 1080 && asset.height === 1920 && details.size <= 5 * 1024 * 1024, 'social-preview-size-required');
  }
  for (let design = 1; design <= 5; design++) {
    for (const role of ['native', 'final', 'preview']) for (const variant of ['desktop', 'mobile']) requirePackage(slots.has(`${role}:${design}:${variant}`), 'missing-wallpaper-variant');
    for (const role of ['social', 'emoji', 'emoji-source']) requirePackage(slots.has(`${role}:${design}:`), 'missing-emoji-or-social-preview');
  }
  for (const role of ['emoji', 'social']) requirePackage(new Set(value.assets.filter(asset => asset.role === role).map(asset => asset.sha256)).size === 5, 'five-distinct-designs-required');
  return { root, value, packageHash: digest(canonical(value)) };
}
export async function approvePackage(root: string, expected: string, decision: 'approved' | 'rejected') {
  const checked = await validatePackage(root);
  requirePackage(checked.packageHash === expected, 'package-changed');
  const approval = { schemaVersion: 1, packageHash: expected, revision: checked.value.revision, decision, decidedAt: new Date().toISOString() };
  writePrivate(packagePath(checked.root, 'approval.json'), JSON.stringify(approval, null, 2) + '\n');
  return approval;
}
export async function approvedPackage(root: string) {
  const checked = await validatePackage(root), approval = readPackageJson(packagePath(checked.root, 'approval.json'));
  requirePackage(approval.schemaVersion === 1 && approval.decision === 'approved' && approval.packageHash === checked.packageHash && approval.revision === checked.value.revision, 'package-not-approved');
  return checked;
}
export async function packageStatus(root: string) {
    const checked = await validatePackage(root);
    let approved = false;
    if (existsSync(packagePath(checked.root, 'approval.json'))) {
      const approval = readPackageJson(packagePath(checked.root, 'approval.json'));
      approved = approval.decision === 'approved' && approval.packageHash === checked.packageHash && approval.revision === checked.value.revision;
    }
    return { schemaVersion: 1, collectionId: checked.value.manifest.collection.id, revision: checked.value.revision, packageHash: checked.packageHash, approved };
}
export function initializePackage(root: string, collectionId: string, theme: string) {
  requirePackage(/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collectionId), 'invalid-collection-id'); text(theme);
  const directory = privateRoot(root, true), path = packagePath(directory, 'package.json');
  requirePackage(!existsSync(path), 'package-already-exists');
  writePrivate(path, JSON.stringify({ schemaVersion: 1, revision: 1, theme, manifest: { collection: { id: collectionId }, wallpapers: [] }, stories: {}, copy: {}, assets: [] }, null, 2) + '\n');
  chmodSync(path, 0o600);
}

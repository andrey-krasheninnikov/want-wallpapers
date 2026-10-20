import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { approvePackage, approvedPackage, canonical, digest, initializePackage, packagePath, privateRoot, validatePackage, writePrivate, type CollectionPackage } from '../scripts/collection-package';
import { prepareMedia } from '../scripts/collection-media';
import { reviewPackage } from '../scripts/collection-review';

const root = mkdtempSync(join(realpathSync(tmpdir()), 'wallpapers-package-'));
let original: string;
beforeAll(async () => {
  chmodSync(root, 0o700);
  initializePackage(root, '0999-test-light', 'Quiet light');
  const title = { en: 'Quiet light', ru: 'Тихий свет', 'zh-cn': '静光', 'pt-br': 'Luz', ja: '光', ar: 'ضوء' };
  const collection = { id: '0999-test-light', slug: 'test-light', count: 5, title, description: title };
  const value: CollectionPackage = { schemaVersion: 1, revision: 1, theme: 'Quiet light',
    manifest: { collection, wallpapers: Array.from({ length: 5 }, (_, index) => ({ id: `test-light-${index + 1}`, slug: `test-light-${index + 1}`, number: index + 1, collection: 'test-light', collectionId: collection.id, s3Folder: collection.id, fileStem: collection.slug, category: 'abstract', tags: ['light'], title, description: title })) },
    stories: Object.fromEntries(Object.keys(title).map(locale => [locale, ['A scene.']])) as CollectionPackage['stories'],
    copy: Object.fromEntries(['telegram', 'tumblr', 'pinterest', 'deviantart', 'flickr'].map(destination => [destination, Array.from({ length: ['telegram', 'tumblr'].includes(destination) ? 1 : 5 }, () => ({ title: 'Light', description: 'Quiet light.' }))])) as CollectionPackage['copy'], assets: [] };
  for (let design = 1; design <= 5; design++) for (const variant of ['desktop', 'mobile', 'emoji'] as const) {
    const path = `${design}-${variant}.png`;
    const bytes = await sharp({ create: { width: variant === 'desktop' ? 160 : variant === 'mobile' ? 90 : 50, height: variant === 'desktop' ? 90 : variant === 'mobile' ? 160 : 50, channels: 4, background: { r: design * 35, g: 80, b: 180, alpha: variant === 'emoji' ? .5 : 1 } } }).png().toBuffer();
    writePrivate(join(root, path), bytes);
    value.assets.push({ path, role: variant === 'emoji' ? 'emoji-source' : 'native', design, ...(variant === 'emoji' ? {} : { variant }), sha256: digest(bytes), width: 1, height: 1 });
  }
  writePrivate(join(root, 'package.json'), JSON.stringify(value));
  await prepareMedia(root); original = readFileSync(join(root, 'package.json'), 'utf8');
}, 30000);
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('complete package, approval, restart and rejection bind every field', async () => {
  const checked = await validatePackage(root);
  expect(checked.value.assets).toHaveLength(45);
  expect(canonical({ b: 1, a: [2, 3] })).toBe('{"a":[2,3],"b":1}');
  await expect(approvePackage(root, '0'.repeat(64), 'approved')).rejects.toThrow('package-changed');
  await approvePackage(root, checked.packageHash, 'approved');
  expect((await approvedPackage(root)).packageHash).toBe(checked.packageHash);
  const value = JSON.parse(original); value.copy.telegram[0].description = 'Changed';
  writePrivate(join(root, 'package.json'), JSON.stringify(value));
  await expect(approvedPackage(root)).rejects.toThrow('package-not-approved');
  writePrivate(join(root, 'package.json'), original);
  await approvePackage(root, checked.packageHash, 'rejected');
  await expect(approvedPackage(root)).rejects.toThrow('package-not-approved');
}, 30000);

test('missing locales, stories, copy, variants and emoji cannot validate', async () => {
  const changes = [
    (v: any) => { delete v.manifest.collection.title.ar; },
    (v: any) => { delete v.stories.ja; },
    (v: any) => { delete v.copy.flickr; },
    (v: any) => { v.assets = v.assets.filter((a: any) => a.role !== 'emoji'); },
    (v: any) => { v.assets = v.assets.filter((a: any) => a.role !== 'final' || a.variant !== 'mobile'); },
    (v: any) => { v.assets[0].width = 100; },
    (v: any) => { v.assets[0].sha256 = '0'.repeat(64); },
  ];
  try { for (const change of changes) { const value = JSON.parse(original); change(value); writePrivate(join(root, 'package.json'), JSON.stringify(value)); await expect(validatePackage(root)).rejects.toThrow(); } }
  finally { writePrivate(join(root, 'package.json'), original); }
}, 30000);

test('private boundaries reject traversal, symlinks, git and public file modes', async () => {
  for (const path of ['../x', '/tmp/x', 'x/../../x', 'x//y']) expect(() => packagePath(root, path)).toThrow();
  symlinkSync('/tmp', join(root, 'link')); expect(() => packagePath(root, 'link/x')).toThrow();
  expect(() => privateRoot(process.cwd())).toThrow('package-must-be-outside-git');
  chmodSync(join(root, 'package.json'), 0o644);
  try { await expect(validatePackage(root)).rejects.toThrow('private-package-file-required'); }
  finally { chmodSync(join(root, 'package.json'), 0o600); }
});

test('corrupt media, wrong final dimensions and opaque emoji fail closed', async () => {
  const value = JSON.parse(original), path = join(root, value.assets[0].path), bytes = readFileSync(path);
  try { writePrivate(path, Buffer.from('broken')); value.assets[0].sha256 = digest('broken'); writePrivate(join(root, 'package.json'), JSON.stringify(value)); await expect(validatePackage(root)).rejects.toThrow(); }
  finally { writePrivate(path, bytes); writePrivate(join(root, 'package.json'), original); }
  const wrong = JSON.parse(original); const final = wrong.assets.find((asset: any) => asset.role === 'final'); final.width = 3841;
  writePrivate(join(root, 'package.json'), JSON.stringify(wrong));
  try { await expect(validatePackage(root)).rejects.toThrow(); }
  finally { writePrivate(join(root, 'package.json'), original); }
});

test('review is local, escaped, RTL aware and distinguishes enlarged output', async () => {
  const value = JSON.parse(original); value.copy.telegram[0].title = '<script>bad</script>';
  writePrivate(join(root, 'package.json'), JSON.stringify(value));
  try {
    const path = await reviewPackage(root), html = readFileSync(path, 'utf8');
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;'); expect(html).not.toContain('<script>');
    expect(html).toContain('dir="rtl"'); expect(html).toContain('Увеличенный PNG'); expect(html).toContain('form-action');
    expect(html).not.toContain('https://');
  } finally { writePrivate(join(root, 'package.json'), original); }
}, 30000);

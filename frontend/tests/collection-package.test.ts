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


test('preparation refuses source/output aliases before changing native bytes', async () => {
  for (const directory of ['public', 'PUBLIC']) {
    const value = JSON.parse(original), source = value.assets.find((asset: any) => asset.role === 'native' && asset.variant === 'desktop');
    const path = `${directory}/test-light-desktop-${source.design}.png`, canonical = join(root, `public/test-light-desktop-${source.design}.png`), previous = readFileSync(canonical);
    const native = readFileSync(join(root, source.path));
    // Both spellings address one file on the supported MacBook filesystem.
    if (directory === 'PUBLIC' && !Bun.file(join(root, 'PUBLIC/test-light-desktop-1.png')).size) continue;
    writePrivate(canonical, native); source.path = path;
    writePrivate(join(root, 'package.json'), JSON.stringify(value));
    try { await expect(prepareMedia(root)).rejects.toThrow('source-output-path-conflict'); expect(readFileSync(canonical).equals(native)).toBe(true); }
    finally { writePrivate(canonical, previous); writePrivate(join(root, 'package.json'), original); }
  }
});

test('review and command lock reject symlinks without touching outside data', async () => {
  const outside = mkdtempSync(join(realpathSync(tmpdir()), 'wallpapers-outside-'));
  const review = join(root, 'review'); rmSync(review, { recursive: true, force: true }); symlinkSync(outside, review);
  const sentinel = join(outside, 'sentinel'); writePrivate(sentinel, 'keep');
  try {
    await expect(reviewPackage(root)).rejects.toThrow('symlink-package-file');
    symlinkSync(sentinel, join(root, 'command-lock.sqlite'));
    const child = Bun.spawn([process.execPath, new URL('../scripts/collection.ts', import.meta.url).pathname, 'status', root], { stdout: 'pipe', stderr: 'pipe' });
    expect(await child.exited).not.toBe(0); expect(readFileSync(sentinel, 'utf8')).toBe('keep');
  } finally { rmSync(review, { force: true }); rmSync(join(root, 'command-lock.sqlite'), { force: true }); rmSync(outside, { recursive: true, force: true }); }
});


test('pixel quantization extends edges while retaining the exact native file', async () => {
  const value = JSON.parse(original), source = value.assets.find((asset: any) => asset.role === 'native' && asset.variant === 'desktop');
  const path = join(root, source.path), previous = readFileSync(path);
  const outputs = value.assets.filter((asset: any) => asset.design === 1 && asset.variant === 'desktop' && ['final', 'preview'].includes(asset.role)).map((asset: any) => [join(root, asset.path), readFileSync(join(root, asset.path))] as const);
  const bytes = await sharp({ create: { width: 1672, height: 941, channels: 3, background: '#346756' } }).png().toBuffer();
  writePrivate(path, bytes);
  const composition = join(root, 'compositions/test-light-desktop-1.png');
  try {
    const checked = await prepareMedia(root); expect(readFileSync(path).equals(bytes)).toBe(true);
    const extended = checked.value.assets.find(asset => asset.role === 'composition' && asset.design === 1)!;
    expect([extended.width, extended.height]).toEqual([1680, 945]);
  } finally { for (const [output, bytes] of outputs) writePrivate(output, bytes); writePrivate(path, previous); writePrivate(join(root, 'package.json'), original); rmSync(composition, { force: true }); }
}, 30000);


test('emoji names and Unicode bind approval and remain consistent with their source', async () => {
  const value = JSON.parse(original);
  for (const asset of value.assets.filter((asset: any) => asset.design === 1 && ['emoji', 'emoji-source'].includes(asset.role))) Object.assign(asset, { name: 'Chrome fern', emoji: '\u{1F33F}' });
  writePrivate(join(root, 'package.json'), JSON.stringify(value));
  try {
    const checked = await prepareMedia(root);
    expect(checked.value.assets.find(asset => asset.role === 'emoji' && asset.design === 1)?.emoji).toBe('\u{1F33F}');
    expect(checked.packageHash).not.toBe(digest(canonical(JSON.parse(original))));
    const html = readFileSync(await reviewPackage(root), 'utf8');
    expect(html).toContain('Chrome fern'); expect(html).toContain('emoji-light'); expect(html).toContain('width="32"');
    for (const emoji of ['\u{1F1EF}\u{1F1F5}', '1\uFE0F\u20E3']) {
      const changed = structuredClone(value);
      for (const asset of changed.assets.filter((asset: any) => asset.design === 1 && ['emoji', 'emoji-source'].includes(asset.role))) asset.emoji = emoji;
      writePrivate(join(root, 'package.json'), JSON.stringify(changed));
      expect((await validatePackage(root)).value.assets.find(asset => asset.role === 'emoji')?.emoji).toBe(emoji);
    }
    for (const invalid of ['fern', '\u{1F33F}\u{1F30A}', '\u{1F33F}\u0301', '']) {
      const changed = structuredClone(value); changed.assets.find((asset: any) => asset.role === 'emoji').emoji = invalid;
      writePrivate(join(root, 'package.json'), JSON.stringify(changed));
      await expect(validatePackage(root)).rejects.toThrow('one-unicode-emoji-required');
    }
    value.assets.find((asset: any) => asset.role === 'emoji').name = 'Different name';
    writePrivate(join(root, 'package.json'), JSON.stringify(value));
    await expect(validatePackage(root)).rejects.toThrow('emoji-metadata-mismatch');
  } finally { writePrivate(join(root, 'package.json'), original); }
}, 30000);

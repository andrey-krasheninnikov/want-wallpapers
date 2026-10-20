import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { approvePackage, digest, validatePackage, writePrivate } from '../scripts/collection-package';
import { TimewebCollectionStore, uploadApprovedCollection, type CollectionStore, type UploadObject } from '../scripts/collection-storage';
import { createTestPackage } from './fixtures/collection-package';

const root = mkdtempSync(join(realpathSync(tmpdir()), 'wallpapers-upload-'));
let original: string, hash: string;
beforeAll(async () => {
  chmodSync(root, 0o700); const checked = await createTestPackage(root); hash = checked.packageHash;
  original = readFileSync(join(root, 'package.json'), 'utf8'); await approvePackage(root, hash, 'approved');
}, 30000);
afterAll(() => rmSync(root, { recursive: true, force: true }));
function memoryStore() {
  const objects = new Map<string, Uint8Array>(); let created = 0;
  const store: CollectionStore = {
    async read(key) { return objects.get(key); },
    async create(object) {
      if (objects.has(object.key)) return false;
      objects.set(object.key, readFileSync(object.path)); created++; return true;
    },
  };
  const verify = async (object: UploadObject) => { expect(digest(objects.get(object.key)!)).toBe(object.sha256); };
  return { objects, store, verify, created: () => created };
}
function reset() { rmSync(join(root, 'publication'), { recursive: true, force: true }); }

test('immutable upload exports only public files and exact repeat reuses objects', async () => {
  reset(); const memory = memoryStore();
  const result = await uploadApprovedCollection(root, memory.store, memory.verify);
  expect(memory.created()).toBe(41); expect(result.assets).toHaveLength(30);
  expect(result.packageHash).toBe(hash);
  for (let design = 1; design <= 5; design++) for (const variant of ['desktop', 'mobile']) {
    const prefix = 'wallpapers/assets/collections/0999-test-light/';
    expect(digest(memory.objects.get(prefix + `${design}-${variant}.png`)!)).toBe(digest(memory.objects.get(prefix + `test-light-${variant}-${design}.png`)!));
  }
  expect(JSON.stringify(result)).not.toContain('native/'); expect(JSON.stringify(result)).not.toContain('approval.json');
  expect(Object.keys(result.assets[0]!)).not.toContain('path'); expect(Object.keys(result.assets[0]!)).not.toContain('source');
  await uploadApprovedCollection(root, memory.store, memory.verify); expect(memory.created()).toBe(41);
  expect(JSON.parse(readFileSync(join(root, 'publication/upload.json'), 'utf8')).complete).toBe(true);
}, 30000);

test('partial upload and lost write responses resume without duplicate creations', async () => {
  for (const mode of ['before', 'after']) {
    reset(); const memory = memoryStore(), create = memory.store.create; let fail = true;
    memory.store.create = async object => {
      if (fail && memory.created() === 3) {
        fail = false;
        if (mode === 'after') await create(object);
        throw Error('connection-lost');
      }
      return create(object);
    };
    if (mode === 'before') await expect(uploadApprovedCollection(root, memory.store, memory.verify)).rejects.toThrow('upload-outcome-unknown');
    await uploadApprovedCollection(root, memory.store, memory.verify);
    expect(memory.created()).toBe(41);
  }
}, 30000);

test('conflicting objects and ignored conditional creation stop without replacing different bytes', async () => {
  reset(); const memory = memoryStore(), key = 'wallpapers/assets/collections/0999-test-light/test-light-desktop-1.png';
  memory.objects.set(key, Buffer.from('other artwork'));
  await expect(uploadApprovedCollection(root, memory.store, memory.verify)).rejects.toThrow('existing-object-conflict');
  expect(Buffer.from(memory.objects.get(key)!).toString()).toBe('other artwork'); expect(memory.created()).toBe(0);
  reset(); memory.objects.clear();
  memory.store.create = async object => { memory.objects.set(object.key, readFileSync(object.path)); return true; };
  await expect(uploadApprovedCollection(root, memory.store, memory.verify)).rejects.toThrow('conditional-create-not-enforced');
  expect(memory.objects.size).toBe(1);
}, 30000);

test('CDN failure cannot publish the completion marker and resumes safely', async () => {
  reset(); const memory = memoryStore(); let count = 0;
  await expect(uploadApprovedCollection(root, memory.store, async () => { if (++count === 5) throw Error('cdn-unavailable'); })).rejects.toThrow('cdn-unavailable');
  expect(memory.objects.size).toBe(40);
  expect([...memory.objects.keys()].some(key => key.endsWith('/collection-package.json'))).toBe(false);
  await uploadApprovedCollection(root, memory.store, memory.verify); expect(memory.objects.size).toBe(41);
}, 30000);

test('changed approval and a newly approved revision cannot reuse the old upload intent', async () => {
  reset(); const memory = memoryStore(); await uploadApprovedCollection(root, memory.store, memory.verify);
  const value = JSON.parse(original); value.theme = 'Changed theme';
  writePrivate(join(root, 'package.json'), JSON.stringify(value));
  try {
    await expect(uploadApprovedCollection(root, memory.store, memory.verify)).rejects.toThrow('package-not-approved');
    const changed = await validatePackage(root); await approvePackage(root, changed.packageHash, 'approved');
    await expect(uploadApprovedCollection(root, memory.store, memory.verify)).rejects.toThrow('upload-intent-mismatch');
    expect(memory.created()).toBe(41);
  } finally { writePrivate(join(root, 'package.json'), original); await approvePackage(root, hash, 'approved'); }
}, 30000);

test('Timeweb adapter rejects backup profiles and foreign prefixes before any request', async () => {
  expect(() => new TimewebCollectionStore(root, 'timeweb-wallpapers-backup', 'wallpapers/assets/collections/0999-test-light/')).toThrow('upload-profile-required');
  expect(() => new TimewebCollectionStore(root, 'timeweb-admin', 'backups/')).toThrow('collection-prefix-required');
  const store = new TimewebCollectionStore(root, 'timeweb-admin', 'wallpapers/assets/collections/0999-test-light/');
  await expect(store.read('another-prefix/file.png', 1)).rejects.toThrow('collection-prefix-required');
});

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { approvedPackage, canonical, digest, packagePath, privateRoot, readPackageJson, requirePackage, writePrivate, type Asset, type CollectionPackage } from './collection-package';

const origin = 'https://want-foundation.s3.twcstorage.ru';
const publicRoles = ['final', 'preview', 'social', 'emoji'];
export type PublicAsset = Pick<Asset, 'role' | 'design' | 'variant' | 'sha256' | 'width' | 'height' | 'name' | 'emoji'> & { file: string; url: string };
export type PublicCollectionPackage = Pick<CollectionPackage, 'schemaVersion' | 'revision' | 'manifest' | 'stories' | 'copy'> & { packageHash: string; assets: PublicAsset[] };
export type UploadObject = { key: string; file: string; path: string; sha256: string; size: number; contentType: string };
export interface CollectionStore {
  read(key: string, size: number): Promise<Uint8Array | undefined>;
  create(object: UploadObject): Promise<boolean>;
}
export function publicCollection(value: CollectionPackage, packageHash: string): PublicCollectionPackage {
  const prefix = `wallpapers/assets/collections/${value.manifest.collection.id}/`;
  return { schemaVersion: 1, revision: value.revision, packageHash, manifest: value.manifest, stories: value.stories, copy: value.copy,
    assets: value.assets.filter(asset => publicRoles.includes(asset.role)).map(asset => {
      const file = asset.role === 'social' ? `social-${asset.design}.jpg` : asset.role === 'emoji' ? `emoji-${asset.design}.png`
        : `${value.manifest.collection.slug}-${asset.variant}-${asset.design}.${asset.role === 'preview' ? 'webp' : 'png'}`;
      return { file, url: `${origin}/${prefix}${file}`, role: asset.role, design: asset.design, ...(asset.variant ? { variant: asset.variant } : {}),
        sha256: asset.sha256, width: asset.width, height: asset.height, ...(asset.name === undefined ? {} : { name: asset.name, emoji: asset.emoji }) };
    }) };
}
function privateDirectory(root: string, name: string) {
  const path = packagePath(root, name); mkdirSync(path, { recursive: true, mode: 0o700 });
  return privateRoot(path);
}
export async function verifyPublicObject(object: UploadObject) {
  const response = await fetch(`${origin}/${object.key}`, { redirect: 'error', signal: AbortSignal.timeout(30000), credentials: 'omit' });
  requirePackage(response.ok && response.headers.get('content-type')?.split(';')[0] === object.contentType, 'cdn-object-unavailable');
  const reader = response.body?.getReader(); requirePackage(reader, 'cdn-object-unavailable');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length; requirePackage(size <= object.size, 'cdn-object-size-mismatch'); chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  requirePackage(size === object.size && digest(Buffer.concat(chunks)) === object.sha256, 'cdn-object-hash-mismatch');
}

export async function uploadApprovedCollection(input: string, store: CollectionStore, verify = verifyPublicObject) {
  const checked = await approvedPackage(input), { root, value, packageHash } = checked;
  const prefix = `wallpapers/assets/collections/${value.manifest.collection.id}/`;
  privateDirectory(root, 'publication'); const frozen = privateDirectory(root, `publication/${packageHash}`);
  const metadata = publicCollection(value, packageHash), objects: UploadObject[] = [];
  for (const asset of value.assets.filter(asset => publicRoles.includes(asset.role))) {
    const publicAsset = metadata.assets.find(item => item.role === asset.role && item.design === asset.design && item.variant === asset.variant)!;
    const bytes = readFileSync(packagePath(root, asset.path)); requirePackage(digest(bytes) === asset.sha256, 'asset-hash-mismatch');
    const path = packagePath(frozen, publicAsset.file);
    if (existsSync(path)) requirePackage(!(lstatSync(path).mode & 0o077) && digest(readFileSync(path)) === asset.sha256, 'frozen-object-conflict');
    else writePrivate(path, bytes);
    objects.push({ file: publicAsset.file, key: prefix + publicAsset.file, path, sha256: asset.sha256, size: bytes.length,
      contentType: asset.role === 'preview' ? 'image/webp' : asset.role === 'social' ? 'image/jpeg' : 'image/png' });
    // Existing catalogue URLs use numeric names; retain the approved package filenames as well.
    if (asset.role === 'final') {
      const file = `${asset.design}-${asset.variant}.png`;
      objects.push({ ...objects.at(-1)!, file, key: prefix + file });
    }
  }
  const bytes = Buffer.from(canonical(metadata) + '\n'), file = 'collection-package.json', path = packagePath(frozen, file);
  if (existsSync(path)) requirePackage(!(lstatSync(path).mode & 0o077) && digest(readFileSync(path)) === digest(bytes), 'frozen-metadata-conflict');
  else writePrivate(path, bytes);
  const marker = { file, key: prefix + file, path, sha256: digest(bytes), size: bytes.length, contentType: 'application/json' };
  const statePath = packagePath(root, 'publication/upload.json');
  const state = existsSync(statePath) ? readPackageJson(statePath) : { schemaVersion: 1, packageHash, collectionId: value.manifest.collection.id, objects: {}, complete: false };
  requirePackage(state.schemaVersion === 1 && state.packageHash === packageHash && state.collectionId === value.manifest.collection.id
    && state.objects && typeof state.objects === 'object' && !Array.isArray(state.objects), 'upload-intent-mismatch');
  const save = () => writePrivate(statePath, JSON.stringify(state, null, 2) + '\n'); save();
  async function immutable(object: UploadObject) {
    requirePackage(object.key.startsWith(prefix) && !object.file.includes('/') && digest(readFileSync(object.path)) === object.sha256, 'invalid-upload-object');
    const existing = await store.read(object.key, object.size);
    if (existing === undefined) {
      state.objects[object.file] = { sha256: object.sha256, state: 'intent' }; save();
      try { await store.create(object); }
      catch {
        const reconciled = await store.read(object.key, object.size);
        requirePackage(reconciled !== undefined && digest(reconciled) === object.sha256, 'upload-outcome-unknown');
      }
    } else requirePackage(digest(existing) === object.sha256, 'existing-object-conflict');
    const saved = await store.read(object.key, object.size);
    requirePackage(saved !== undefined && digest(saved) === object.sha256, 'stored-object-hash-mismatch');
    state.objects[object.file] = { sha256: object.sha256, state: 'confirmed' }; save();
  }
  // Probe with identical approved bytes: an endpoint ignoring the condition cannot corrupt the artwork.
  await immutable(objects[0]!);
  requirePackage(await store.create(objects[0]!) === false, 'conditional-create-not-enforced');
  for (const object of objects.slice(1)) await immutable(object);
  await approvedPackage(root);
  for (const object of objects) await verify(object);
  await approvedPackage(root);
  await immutable(marker); await verify(marker);
  state.complete = true; state.metadataHash = marker.sha256; save();
  return metadata;
}

export class TimewebCollectionStore implements CollectionStore {
  constructor(private root: string, private profile: string, private prefix: string) {
    privateRoot(root);
    requirePackage(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(profile) && !/backup/i.test(profile), 'upload-profile-required');
    requirePackage(/^wallpapers\/assets\/collections\/\d+-[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(prefix), 'collection-prefix-required');
  }
  private request(input: Record<string, unknown>): { status: number } {
    const command = Bun.which('aws'); requirePackage(command, 'aws-cli-required');
    const executable = realpathSync(command);
    const python = readFileSync(executable, 'utf8').split('\n')[0]!.slice(2).trim();
    // shortcut: the uploader uses Homebrew AWS CLI's SDK; support other installers when another workstation needs them.
    requirePackage(/^\/(?:opt\/homebrew|usr\/local)\/Cellar\/awscli\/[^/]+\/libexec\/bin\/python(?:3(?:\.\d+)?)?$/.test(python), 'homebrew-aws-cli-required');
    const result = spawnSync(python, ['-B', fileURLToPath(new URL('./collection-storage.py', import.meta.url))],
      { input: JSON.stringify({ ...input, profile: this.profile, prefix: this.prefix }), encoding: 'utf8', maxBuffer: 32768, timeout: 60000 });
    requirePackage(result.status === 0, 'storage-request-failed');
    const output = JSON.parse(result.stdout); requirePackage(Number.isInteger(output.status), 'invalid-storage-response'); return output;
  }
  async read(key: string, size: number) {
    requirePackage(key.startsWith(this.prefix) && !key.slice(this.prefix.length).includes('/'), 'collection-prefix-required');
    const path = packagePath(this.root, `publication/download-${randomUUID()}`); writePrivate(path, new Uint8Array());
    try {
      const result = this.request({ action: 'read', key, path, size });
      if (result.status === 404) return undefined;
      requirePackage(result.status !== 409, 'existing-object-conflict');
      requirePackage(result.status === 200 && lstatSync(path).size === size, 'storage-read-failed'); return readFileSync(path);
    } finally { unlinkSync(path); }
  }
  async create(object: UploadObject) {
    requirePackage(object.key.startsWith(this.prefix) && object.key.slice(this.prefix.length) === object.file
      && !object.file.includes('/') && digest(readFileSync(object.path)) === object.sha256, 'invalid-upload-object');
    const result = this.request({ action: 'create', key: object.key, path: object.path, size: object.size, sha256: object.sha256, contentType: object.contentType });
    if (result.status === 412) return false;
    requirePackage(result.status === 200, 'storage-write-outcome-unknown'); return true;
  }
}

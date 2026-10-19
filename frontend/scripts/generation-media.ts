import sharp from 'sharp';
sharp.concurrency(1);
sharp.cache(false);
import { mkdirSync, writeFileSync, readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { DraftError, hash, requireDraft, type Task, type Prepared } from './generation-store';
import { parseCollectionManifest } from './catalog-add';

export function saveAsset(root: string, bytes: Buffer, extension: 'png' | 'webp') {
  const digest = hash(bytes), directory = join(root, 'assets'), path = join(directory, `${digest}.${extension}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' }); }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    requireDraft(lstatSync(path).isFile() && hash(readFileSync(path)) === digest, 'asset-storage-conflict');
  }
  return digest;
}
export async function prepareResult(root: string, task: Task, body: any): Promise<Prepared> {
  if (task.kind === 'plan' || task.kind === 'text') {
    requireDraft(body?.choices?.length === 1 && typeof body.choices[0]?.message?.content === 'string', 'invalid-text-response');
    requireDraft(Number.isSafeInteger(body.usage?.prompt_tokens) && body.usage.prompt_tokens >= 0 && body.usage.prompt_tokens <= 16000
      && Number.isSafeInteger(body.usage?.completion_tokens) && body.usage.completion_tokens >= 0 && body.usage.completion_tokens <= 8192, 'text-usage-limit');
    let result: any;
    try { result = JSON.parse(body.choices[0].message.content); } catch { throw new DraftError('invalid-text-json'); }
    let manifest;
    try { manifest = parseCollectionManifest(result.manifest); } catch { throw new DraftError('invalid-draft-manifest'); }
    requireDraft(manifest.collection.count === 5 && manifest.wallpapers.every((item, index) => item.number === index + 1)
      && Array.isArray(result.scenes) && result.scenes.length === 5 && result.scenes.every((scene: any, index: number) => scene?.number === index + 1
        && ['scene', 'desktopPrompt', 'mobilePrompt'].every(key => typeof scene[key] === 'string' && scene[key].trim() && scene[key].length <= 2000 && !scene[key].includes('\0')))
      && new Set(result.scenes.map((scene: any) => scene.scene.trim().toLowerCase())).size === 5, 'invalid-scenes');
    return { manifest, scenes: result.scenes.map(({ number, scene, desktopPrompt, mobilePrompt }: any) => ({ number, scene, desktopPrompt, mobilePrompt })) };
  }
  requireDraft(body?.data?.length === 1 && typeof body.data[0]?.b64_json === 'string' && body.data[0].b64_json.length <= 90 * 1024 * 1024
    && /^[A-Za-z0-9+/]+={0,2}$/.test(body.data[0].b64_json), 'invalid-png');
  const bytes = Buffer.from(body.data[0].b64_json, 'base64');
  requireDraft(bytes.length <= 64 * 1024 * 1024 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'invalid-png');
  const width = task.kind === 'desktop' ? 3840 : 2160, height = task.kind === 'desktop' ? 2160 : 3840;
  let preview: Buffer;
  try {
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: 8294400 });
    const metadata = await image.metadata();
    requireDraft(metadata.format === 'png' && metadata.width === width && metadata.height === height && (metadata.pages ?? 1) === 1, 'invalid-png-dimensions');
    await image.clone().raw().toBuffer();
    preview = await image.resize({ width: task.kind === 'desktop' ? 960 : 540, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch (error) { if (error instanceof DraftError) throw error; throw new DraftError('invalid-png'); }
  return { asset: { hash: saveAsset(root, bytes, 'png'), previewHash: saveAsset(root, preview, 'webp'), width, height } };
}

export async function packageArchive(root: string, run: import('./generation-store').Run) {
  requireDraft(run.status === 'approved' && run.approval?.version === run.version && run.approval.packageHash === run.packageHash, 'package-not-approved', 409);
  const directory = join(root, 'packages', run.runId, String(run.version));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const files = ['manifest.json', 'approval.json', 'checksums.json'];
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(run.manifest, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(join(directory, 'approval.json'), JSON.stringify({ runId: run.runId, collectionId: run.collectionId, ...run.approval, publicationAllowed: false }, null, 2) + '\n', { mode: 0o600 });
  const checksums: Record<string, string> = {};
  for (const [name, asset] of Object.entries(run.assets).sort()) {
    requireDraft(/^[1-5]-(desktop|mobile)$/.test(name), 'invalid-package-asset');
    const bytes = readFileSync(join(root, 'assets', `${asset.hash}.png`));
    requireDraft(hash(bytes) === asset.hash, 'asset-storage-conflict');
    writeFileSync(join(directory, `${name}.png`), bytes, { mode: 0o600 });
    checksums[`${name}.png`] = asset.hash; files.push(`${name}.png`);
  }
  writeFileSync(join(directory, 'checksums.json'), JSON.stringify(checksums, null, 2) + '\n', { mode: 0o600 });
  const process = Bun.spawn(['tar', '-cf', '-', '-C', directory, ...files], { stdout: 'pipe', stderr: 'ignore' });
  const reader = process.stdout.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await reader.read();
      if (!next.done) { controller.enqueue(next.value); return; }
      if (await process.exited !== 0) controller.error(new DraftError('package-export-failed'));
      else controller.close();
    },
    async cancel() { process.kill(); await reader.cancel(); },
  });
}

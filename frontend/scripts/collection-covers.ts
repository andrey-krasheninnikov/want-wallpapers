import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import type { Collection } from '../src/data/catalog';
import { parseCollection } from './catalog-add';

const execute = promisify(execFile);
const limit = 8 * 1024 * 1024;
async function download(url: string, contentType: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim() !== contentType || !response.body) throw new Error('Cover asset is unavailable or has the wrong content type.');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) { await response.body.cancel(); throw new Error('Cover asset exceeds 8 MiB.'); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Cover asset exceeds 8 MiB.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (!size) throw new Error('Cover asset is empty.');
  return Buffer.concat(chunks);
}
export async function prepareCollectionCover(collection: Collection) {
  parseCollection(collection);
  if (!collection.videoCover) return undefined;
  const video = await download(collection.videoCover.src, 'video/mp4');
  const directory = await mkdtemp(join(tmpdir(), 'want-wallpapers-cover-'));
  try {
    const path = join(directory, 'cover.mp4');
    await writeFile(path, video);
    const { stdout } = await execute('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-f', 'mov', '-show_format', '-show_streams', '-of', 'json', path], { timeout: 30000, maxBuffer: 1024 * 1024 });
    const metadata = JSON.parse(stdout);
    const streams = metadata.streams;
    const duration = Number(metadata.format?.duration);
    const brand = metadata.format?.tags?.major_brand;
    if (!Array.isArray(streams) || streams.length !== 1 || streams[0].codec_type !== 'video' || streams[0].codec_name !== 'h264'
      || !Number.isFinite(duration) || duration <= 0 || duration > 10
      || !Number.isFinite(Number(streams[0].duration)) || Number(streams[0].duration) <= 0 || Number(streams[0].duration) > 10
      || typeof brand !== 'string' || !/^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(brand)) {
      throw new Error('Cover must be an MP4/H.264 video without audio, at most 10 seconds.');
    }
    await execute('ffmpeg', ['-v', 'error', '-xerror', '-protocol_whitelist', 'file', '-f', 'mov', '-i', path, '-f', 'null', '-'], { timeout: 30000, maxBuffer: 1024 * 1024 });
    const poster = await download(collection.videoCover.poster, 'image/png');
    const image = sharp(poster), size = await image.metadata();
    if (size.format !== 'png' || !size.width || !size.height || size.width < 500 || size.height < 500) throw new Error('Cover poster must be a PNG with both sides at least 500 px.');
    const bytes = await image.resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer();
    const preview = await sharp(bytes).metadata();
    return { bytes, width: preview.width!, height: preview.height! };
  } catch (error) {
    if (error instanceof Error && 'code' in error) throw new Error('Cover video cannot be verified. Install FFmpeg and check that the MP4 decodes correctly.');
    throw error;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

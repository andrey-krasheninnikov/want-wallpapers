import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { wallpapers, s3Url } from '../src/data/catalog';

const output = new URL('../public/previews/', import.meta.url);
const downloads = new URL('../public/downloads/', import.meta.url);
await Promise.all([mkdir(output, { recursive: true }), mkdir(downloads, { recursive: true })]);

const jobs = wallpapers.flatMap((wallpaper) => (['desktop', 'mobile'] as const).map((variant) => ({ wallpaper, variant })));
const dimensions: Record<string, { width: number; height: number }> = {};
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    if (!job) break;
    const url = s3Url(job.wallpaper, job.variant);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) {
      throw new Error(`Missing PNG: ${url} (${response.status})`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(new URL(`${job.wallpaper.slug}-${job.variant}.png`, downloads), bytes);
    const image = sharp(bytes);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 500 || metadata.height < 500) {
      throw new Error(`Invalid image dimensions: ${url}`);
    }
    const preview = await image.resize({ width: job.variant === 'desktop' ? 1280 : 640, withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 }).toBuffer();
    await writeFile(new URL(`${job.wallpaper.slug}-${job.variant}.webp`, output), preview);
    const size = await sharp(preview).metadata();
    dimensions[`${job.wallpaper.slug}-${job.variant}`] = { width: size.width!, height: size.height! };
    console.log(`${job.wallpaper.slug} ${job.variant}: ${metadata.width}×${metadata.height}`);
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
await writeFile(new URL('dimensions.json', output), JSON.stringify(dimensions, null, 2) + '\n');
console.log(`Prepared ${jobs.length} previews.`);

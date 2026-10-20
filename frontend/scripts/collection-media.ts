import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { digest, packagePath, privateRoot, readPackageJson, requirePackage, validatePackage, writePrivate, type Asset, type CollectionPackage } from './collection-package';

export async function prepareMedia(input: string) {
  const root = privateRoot(input), value = readPackageJson(packagePath(root, 'package.json')) as CollectionPackage;
  requirePackage(value.schemaVersion === 1 && Number.isSafeInteger(value.revision) && value.revision > 0 && Array.isArray(value.assets), 'invalid-package');
  const sources = value.assets.filter(asset => ['native', 'composition', 'emoji-source'].includes(asset.role));
  const assets: Asset[] = [];
  for (const source of sources) {
    const path = packagePath(root, source.path), details = lstatSync(path);
    requirePackage(details.isFile() && details.size <= 64 * 1024 * 1024 && !(details.mode & 0o077), 'private-source-required');
    const bytes = readFileSync(path);
    requirePackage(bytes.length <= 64 * 1024 * 1024, 'source-too-large');
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    requirePackage(metadata.format === 'png' && metadata.width && metadata.height && (metadata.pages ?? 1) === 1, 'native-png-required');
    await image.clone().raw().toBuffer();
    assets.push({ ...source, sha256: digest(bytes), width: metadata.width, height: metadata.height });
  }
  async function save(path: string, bytes: Buffer, asset: Omit<Asset, 'path' | 'sha256' | 'width' | 'height'>) {
    const target = packagePath(root, path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writePrivate(target, bytes); const metadata = await sharp(bytes).metadata();
    const saved = { ...asset, path, sha256: digest(bytes), width: metadata.width!, height: metadata.height! };
    assets.push(saved); return saved;
  }
  const slug = value.manifest?.collection?.slug;
  requirePackage(typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), 'manifest-slug-required');
  for (let design = 1; design <= 5; design++) {
    for (const variant of ['desktop', 'mobile'] as const) {
      const source = assets.find(asset => asset.role === 'composition' && asset.design === design && asset.variant === variant)
        ?? assets.find(asset => asset.role === 'native' && asset.design === design && asset.variant === variant);
      requirePackage(source, 'native-source-required');
      const width = variant === 'desktop' ? 3840 : 2160, height = variant === 'desktop' ? 2160 : 3840;
      requirePackage(source.width * height === source.height * width, 'extend-composition-before-resizing');
      const bytes = readFileSync(packagePath(root, source.path));
      const final = source.width === width && source.height === height ? bytes : await sharp(bytes).resize(width, height, { fit: 'fill' }).png().toBuffer();
      const saved = await save(`public/${slug}-${variant}-${design}.png`, final, { role: 'final', design, variant, source: source.path });
      await save(`public/${slug}-${variant}-${design}.webp`, await sharp(final).resize(variant === 'desktop' ? 960 : 540, variant === 'desktop' ? 540 : 960).webp({ quality: 85 }).toBuffer(), { role: 'preview', design, variant, source: saved.path });
      if (variant === 'mobile') await save(`public/social-${design}.jpg`, await sharp(final).resize(1080, 1920).flatten({ background: '#141414' }).jpeg({ quality: 90 }).toBuffer(), { role: 'social', design, source: saved.path });
    }
    const source = assets.find(asset => asset.role === 'emoji-source' && asset.design === design);
    requirePackage(source, 'emoji-source-required');
    await save(`public/emoji-${design}.png`, await sharp(readFileSync(packagePath(root, source.path))).resize(100, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), { role: 'emoji', design, source: source.path });
  }
  value.assets = assets; value.revision++;
  writePrivate(packagePath(root, 'package.json'), JSON.stringify(value, null, 2) + '\n');
  return validatePackage(root);
}

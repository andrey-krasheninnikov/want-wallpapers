import { join } from 'node:path';
import sharp from 'sharp';
import { digest, initializePackage, writePrivate, type CollectionPackage } from '../../scripts/collection-package';
import { prepareMedia } from '../../scripts/collection-media';

export async function createTestPackage(root: string) {
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
  return prepareMedia(root);
}

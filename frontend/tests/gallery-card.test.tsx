import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WallpaperCard } from '../src/components/Gallery';
import type { WallpaperVariant } from '../src/data/previews';

test('wallpaper cards render preview attributes without product download metadata', () => {
  const image: WallpaperVariant = { src: '/previews/sample-desktop.webp', width: 1280, height: 720, originalWidth: 2560, originalHeight: 1440,
    download: '/downloads/sample-desktop.png', original: 'https://example.org/sample.png' };
  const html = renderToStaticMarkup(<WallpaperCard item={{
    id: 'sample', href: '/wallpapers/sample/', title: 'Sample', description: 'A quiet landscape.',
    collectionTitle: 'Landscapes', number: 1, category: 'landscape', collection: 'landscapes', searchText: '',
    image,
  }} />);
  expect(html).toContain('src="/previews/sample-desktop.webp"');
  expect(html).toContain('alt="A quiet landscape."');
  expect(html).not.toMatch(/originalWidth|originalHeight|download=|original=/);
});

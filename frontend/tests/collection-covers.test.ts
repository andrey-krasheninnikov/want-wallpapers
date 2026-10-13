import { afterEach, expect, spyOn, test } from 'bun:test';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { prepareCollectionCover } from '../scripts/collection-covers';
import { initialCatalog } from '../src/data/catalog';

const collection = { ...initialCatalog.collections[0]!, videoCover: { src: 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/cover.mp4', poster: 'https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/0001-contours-of-silence/cover.png' } };
const poster = await sharp({ create: { width: 640, height: 512, channels: 3, background: '#5b4fff' } }).png().toBuffer();
const boundary: { fetch: (input: RequestInfo | URL, options?: RequestInit) => Promise<Response> } = globalThis;
let mocked: ReturnType<typeof spyOn> | undefined;
afterEach(() => { mocked?.mockRestore(); });
async function cdn(name = 'valid.mp4', image: Uint8Array = poster) {
  const video = await readFile(new URL(`fixtures/covers/${name}`, import.meta.url));
  mocked = spyOn(boundary, 'fetch').mockImplementation(async (input, options) => {
    expect(options?.redirect).toBe('error');
    if (String(input) === collection.videoCover.src) return new Response(video, { headers: { 'Content-Type': 'video/mp4' } });
    if (String(input) === collection.videoCover.poster) return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } });
    throw new Error('Unexpected fetch target.');
  });
}
test('old collections require no video tools or network', async () => {
  mocked = spyOn(boundary, 'fetch').mockImplementation(() => { throw new Error('Unexpected fetch'); });
  expect(await prepareCollectionCover(initialCatalog.collections[0]!)).toBeUndefined();
});
test('a real silent H.264 MP4 and PNG poster produce a decoded static preview', async () => {
  await cdn();
  const prepared = await prepareCollectionCover(collection);
  expect(prepared?.width).toBe(640); expect(prepared?.height).toBe(512);
  expect((await sharp(prepared!.bytes).metadata()).format).toBe('webp');
});
for (const fixture of ['audio.mp4', 'long.mp4', 'codec.mp4']) {
  test(`build rejects ${fixture}`, async () => {
    await cdn(fixture);
    await expect(prepareCollectionCover(collection)).rejects.toThrow('MP4/H.264');
  });
}
test('build rejects broken media and an invalid or undersized required poster', async () => {
  await cdn('valid.mp4', new Uint8Array([1, 2, 3]));
  await expect(prepareCollectionCover(collection)).rejects.toThrow(); mocked!.mockRestore();
  await cdn('valid.mp4', await sharp({ create: { width: 499, height: 500, channels: 3, background: '#5b4fff' } }).png().toBuffer());
  await expect(prepareCollectionCover(collection)).rejects.toThrow('at least 500'); mocked!.mockRestore();
  mocked = spyOn(boundary, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'video/mp4' } }));
  await expect(prepareCollectionCover(collection)).rejects.toThrow();
});
test('build rejects unavailable assets, redirects and oversize bodies before release', async () => {
  for (const response of [new Response(null, { status: 404 }), new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }), new Response('x', { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(8 * 1024 * 1024 + 1) } }), new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'video/mp4' } })]) {
    mocked?.mockRestore(); mocked = spyOn(boundary, 'fetch').mockResolvedValue(response);
    await expect(prepareCollectionCover(collection)).rejects.toThrow();
  }
});
test('build rejects unsafe snapshot URLs before any fetch', async () => {
  mocked = spyOn(boundary, 'fetch').mockImplementation(() => { throw new Error('Unexpected fetch target.'); });
  await expect(prepareCollectionCover({ ...collection, videoCover: { ...collection.videoCover, src: 'http://127.0.0.1/cover.mp4' } })).rejects.toThrow('approved CDN');
});


test('validated cover data reaches the static view model and SSR without an eager video URL', async () => {
  await cdn();
  const prepared = (await prepareCollectionCover(collection))!;
  const directory = new URL('../public/previews/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const path = new URL('dimensions.json', directory);
  let original: Buffer | undefined;
  try { original = await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const dimensions = original ? JSON.parse(original.toString()) : {};
  dimensions['collection-0001-contours-of-silence'] = { width: prepared.width, height: prepared.height };
  try {
    await writeFile(path, JSON.stringify(dimensions));
    const process = Bun.spawn(['bun', '-e', `import { collectionCard } from './src/lib/view-models'; import { CollectionCard } from './src/components/Gallery'; import { renderToStaticMarkup } from 'react-dom/server'; import { createElement } from 'react'; const card = await collectionCard(JSON.parse(process.argv.at(-1)), 'ru'); console.log(JSON.stringify({ card, html: renderToStaticMarkup(createElement(CollectionCard, { item: card })) }));`, JSON.stringify(collection)], { cwd: new URL('../', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe' });
    const output = await new Response(process.stdout).text();
    expect(await process.exited).toBe(0);
    const { card, html } = JSON.parse(output);
    expect(card.image).toEqual({ src: '/previews/collection-0001-contours-of-silence.webp', width: 640, height: 512 });
    expect(card.video).toBe(collection.videoCover.src);
    expect(html).toContain(`data-src="${collection.videoCover.src}"`);
    expect(html).toContain('Остановить анимацию');
    expect(html).not.toMatch(/<video[^>]*\ssrc=/);
  } finally { if (original) await writeFile(path, original); else await unlink(path); }
});

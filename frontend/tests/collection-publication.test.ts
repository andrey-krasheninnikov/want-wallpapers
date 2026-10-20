import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PublicationJournal, catalogueBaseline, deploymentReceipt, reconcileCreation, requireRefs, verifyLiveCollection } from '../scripts/collection-publication';
import { digest } from '../scripts/collection-package';
import type { PublicCollectionPackage } from '../scripts/collection-storage';
import { locales } from '../src/data/catalog';
const root = mkdtempSync(join(realpathSync(tmpdir()), 'wallpapers-publication-')); chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true, force: true }));
const sha = 'a'.repeat(40), hash = 'b'.repeat(64), image = 'sha256:' + 'c'.repeat(64), tag = 'v1.10.0';

test('confirmed phases are reused, changed inputs and identities stop', async () => {
  const path = join(root, 'confirmed.json'); let calls = 0;
  const first = new PublicationJournal(path, { packageHash: hash });
  expect(await first.step('upload', { packageHash: hash }, async () => ++calls)).toBe(1);
  const resumed = new PublicationJournal(path, { packageHash: hash });
  expect(await resumed.step('upload', { packageHash: hash }, async () => ++calls)).toBe(1); expect(calls).toBe(1);
  await expect(resumed.step('upload', { packageHash: 'changed' }, async () => ++calls)).rejects.toThrow('publication-phase-changed');
  expect(() => new PublicationJournal(path, { packageHash: 'changed' })).toThrow('publication-intent-mismatch');
});

test('lost creation response is read back once; unknown creation never writes blindly on resume', async () => {
  let writes = 0, saved: number | undefined;
  expect(await reconcileCreation(false, async () => saved, async () => { writes++; saved = 17; throw Error('response-lost'); })).toBe(17);
  expect(await reconcileCreation(true, async () => saved, async () => { writes++; })).toBe(17); expect(writes).toBe(1);
  await expect(reconcileCreation(true, async () => undefined, async () => { writes++; })).rejects.toThrow('publication-outcome-unconfirmed');
  expect(writes).toBe(1);
});

test('interrupted journal resumes through remote readback without repeating a confirmed write', async () => {
  const path = join(root, 'interrupted.json'); let saved: number | undefined, writes = 0;
  const first = new PublicationJournal(path, { packageHash: hash });
  await expect(first.step('pr', { head: sha }, async () => { saved = 12; writes++; throw Error('process-interrupted'); })).rejects.toThrow('process-interrupted');
  const resumed = new PublicationJournal(path, { packageHash: hash });
  expect(await resumed.step('pr', { head: sha }, resuming => reconcileCreation(resuming, async () => saved, async () => { writes++; }))).toBe(12);
  expect(writes).toBe(1);
});

test('stale development or main refuses the publication boundary', () => {
  requireRefs({ development: sha, main: sha }, { development: sha, main: sha });
  for (const name of ['main', 'development']) expect(() => requireRefs({ development: sha, main: sha, [name]: 'd'.repeat(40) }, { development: sha, main: sha })).toThrow('publication-refs-changed');
});
const collection = { packageHash: hash, manifest: { collection: { id: '0007-test', slug: 'test', title: Object.fromEntries(locales.map(locale => [locale, 'Water & <Stone>'])) },
  wallpapers: Array.from({ length: 5 }, (_, index) => ({ id: `test-${index + 1}`, slug: `test-${index + 1}`, collectionId: '0007-test', number: index + 1 })) },
  stories: Object.fromEntries(locales.map(locale => [locale, ['Story text']])),
  assets: Array.from({ length: 5 }, (_, index) => ['desktop', 'mobile'].map(variant => ({ role: 'final', design: index + 1, variant, sha256: digest('PNG') }))).flat(),
} as unknown as PublicCollectionPackage;
function release() {
  return { tag, sourceSha: sha, verificationProfile: 'full', published: true, indexDigest: image,
    deployment: { tag, sourceSha: sha, indexDigest: image, requestId: 'd'.repeat(32), state: 'succeeded', backupVerified: true, revision: sha, architecture: 'amd64' }, secret: 'private-value' };
}
test('receipt requires successful backup and the same immutable deployment; failures stay resumable', async () => {
  const value = release(), receipt = deploymentReceipt(value, collection, tag, sha);
  expect(receipt.imageDigest).toBe(image); expect(JSON.stringify(receipt)).not.toContain('private-value');
  for (const state of ['failed', 'recovery-required', 'rolled-back', 'running']) {
    const failed = release(); failed.deployment.state = state;
    expect(() => deploymentReceipt(failed, collection, tag, sha)).toThrow('collection-deployment-not-verified');
  }
  for (const key of ['revision', 'indexDigest', 'sourceSha', 'tag', 'architecture', 'requestId']) {
    const failed = release(); (failed.deployment as Record<string, unknown>)[key] = 'wrong';
    expect(() => deploymentReceipt(failed, collection, tag, sha)).toThrow('collection-deployment-not-verified');
  }
  const failed = release(); failed.deployment.backupVerified = false;
  const journal = new PublicationJournal(join(root, 'failed-deploy.json'), { packageHash: hash });
  await expect(journal.step('deployment', { sha }, async () => deploymentReceipt(failed, collection, tag, sha))).rejects.toThrow('collection-deployment-not-verified');
  expect(journal.value.phases.deployment!.state).toBe('intent');
});
test('live proof checks the running revision, 36 localized pages and all ten exact PNGs', async () => {
  const original = globalThis.fetch, paths: string[] = [];
  globalThis.fetch = (async (input: string) => {
    const path = new URL(input).pathname; paths.push(path);
    if (path === '/health/ready') return Response.json({ status: 'ok', revision: sha }, { headers: { 'Cache-Control': 'no-store' } });
    if (path === '/api/v1/catalog/snapshot') return Response.json({ collections: [collection.manifest.collection], wallpapers: collection.manifest.wallpapers });
    if (path.startsWith('/downloads/')) return new Response('PNG', { headers: { 'Content-Type': 'image/png' } });
    const locale = locales.find(locale => locale !== 'en' && path.startsWith('/' + locale + '/')) ?? 'en';
    const languageTag = locale === 'zh-cn' ? 'zh-CN' : locale === 'pt-br' ? 'pt-BR' : locale;
    const route = path.replace(/^\/(ru|zh-cn|pt-br|ja|ar)(?=\/)/, '');
    const alternates = locales.map(language => `<link rel="alternate" hreflang="${language}" href="https://wallpapers.want.foundation${language === 'en' ? '' : '/' + language}${route}">`).join('');
    return new Response(`<html lang="${languageTag}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><link rel="canonical" href="https://wallpapers.want.foundation${path}">${alternates}</head><body><main>Water &amp; &lt;Stone&gt; Story text</main></body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }) as typeof fetch;
  try {
    expect(await verifyLiveCollection(collection, sha)).toMatchObject({ pages: 36, downloads: 10, revision: sha }); expect(paths).toHaveLength(48);
    await expect(verifyLiveCollection(collection, 'e'.repeat(40))).rejects.toThrow('collection-live-revision-mismatch');
  } finally { globalThis.fetch = original; }
});


test('catalogue baseline rejects unrelated changes between import and feature export', () => {
  const original = { collections: [{ id: 'old', title: 'Existing collection' }], wallpapers: [{ id: 'old-1', collectionId: 'old' }],
    listing: { collections: { old: true }, wallpapers: { 'old-1': true } }, publicationDates: { 'old-1': '2026-10-01T00:00:00Z' }, collectionPublicationDates: { old: '2026-10-01T00:00:00Z' } };
  const baseline = catalogueBaseline(original, collection), exported = structuredClone(original) as any;
  exported.collections.push(collection.manifest.collection); exported.wallpapers.push(...collection.manifest.wallpapers);
  exported.listing.collections[collection.manifest.collection.id] = true;
  for (const item of collection.manifest.wallpapers) exported.listing.wallpapers[item.id] = true;
  expect(catalogueBaseline(exported, collection)).toBe(baseline);
  for (const mutate of [(value: any) => value.collections[0].title = 'Unapproved change', (value: any) => value.listing.wallpapers['old-1'] = false, (value: any) => value.publicationDates['old-1'] = '2026-10-02T00:00:00Z']) {
    const changed = structuredClone(exported); mutate(changed); expect(catalogueBaseline(changed, collection)).not.toBe(baseline);
  }
});

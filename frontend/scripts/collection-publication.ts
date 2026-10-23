import { parsePage } from './seo-validation';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { approvedPackage, canonical, digest, packagePath, privateRoot, readPackageJson, requirePackage, writePrivate } from './collection-package';
import { TimewebCollectionStore, publicCollection, uploadApprovedCollection, type PublicCollectionPackage } from './collection-storage';
import { addCollection } from './catalog-add';
import { catalogRequest } from './catalog-api';
import { locales, downloadUrl, type Collection, type Wallpaper } from '../src/data/catalog';
import { localPath } from '../src/data/copy';

const repository = 'andrey-krasheninnikov/want-wallpapers';
const production = 'https://wallpapers.want.foundation';
const source = resolve(import.meta.dir, '../..');
const shaPattern = /^[a-f0-9]{40}$/;
type Config = { version: string; awsProfile: string; catalogTokenFile: string; expectedDevelopment: string; expectedMain: string };
type Phase = { inputHash: string; state: 'intent' | 'confirmed'; value?: any };
export class PublicationJournal {
  readonly value: { schemaVersion: 1; identity: unknown; startedAt: string; phases: Record<string, Phase> };
  constructor(private path: string, identity: unknown) {
    this.value = existsSync(path) ? readPackageJson(path) : { schemaVersion: 1, identity, startedAt: new Date().toISOString(), phases: {} };
    requirePackage(this.value.schemaVersion === 1 && canonical(this.value.identity) === canonical(identity)
      && this.value.phases && typeof this.value.phases === 'object', 'publication-intent-mismatch');
    this.save();
  }
  private save() { writePrivate(this.path, JSON.stringify(this.value, null, 2) + '\n'); }
  async step<T>(name: string, input: unknown, execute: (resuming: boolean) => Promise<T>): Promise<T> {
    const inputHash = digest(canonical(input)), phase = this.value.phases[name];
    requirePackage(!phase || phase.inputHash === inputHash, 'publication-phase-changed');
    if (phase?.state === 'confirmed') return phase.value;
    this.value.phases[name] = { inputHash, state: 'intent' }; this.save();
    console.log(`Collection publication: ${name}`);
    const value = await execute(Boolean(phase));
    this.value.phases[name] = { inputHash, state: 'confirmed', value }; this.save(); return value;
  }
}
export function requireRefs(actual: Record<string, string>, expected: Record<string, string>) {
  for (const [name, sha] of Object.entries(expected)) requirePackage(shaPattern.test(sha) && actual[name] === sha, 'publication-refs-changed');
}
export async function reconcileCreation<T>(resuming: boolean, read: () => Promise<T | undefined>, create: () => Promise<void>): Promise<T> {
  const existing = await read(); if (existing !== undefined) return existing;
  requirePackage(!resuming, 'publication-outcome-unconfirmed');
  try { await create(); } catch { /* Read back before deciding whether the write failed. */ }
  const saved = await read(); requirePackage(saved !== undefined, 'publication-outcome-unconfirmed'); return saved;
}
function command(arguments_: string[], cwd = source, environment: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(arguments_[0]!, arguments_.slice(1), { cwd, env: environment, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 120000 });
  requirePackage(result.status === 0, 'publication-command-failed:' + arguments_[0]); return result.stdout.trim();
}
const git = (cwd: string, ...args: string[]) => command(['git', ...args], cwd);
const gh = (path: string) => JSON.parse(command(['gh', 'api', `repos/${repository}/${path}`]));
function refs() {
  return Object.fromEntries(git(source, 'ls-remote', 'origin', 'refs/heads/development', 'refs/heads/main').split('\n').map(line => {
    const [sha, name] = line.split('\t'); return [name!.split('/').at(-1)!, sha!];
  }));
}
function assertRefs(development: string, main: string) { requireRefs(refs(), { development, main }); }
function writeJson(path: string, value: unknown) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
function worktree(root: string, name: string, base: string, branch?: string) {
  const path = join(root, name);
  if (!existsSync(path)) git(source, 'worktree', 'add', ...(branch ? ['-b', branch] : ['--detach']), path, base);
  requirePackage(realpathSync(path) === path && git(path, 'rev-parse', '--show-toplevel') === path, 'publication-worktree-mismatch');
  return path;
}
function neutralIdentity(path: string) {
  for (const key of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const value = git(path, 'var', key);
    requirePackage(value && !/[\r\n]|\bAI\b|\bИИ\b|\bbot\b|\bagent\b|\bassistant\b|codex|openai|anthropic|claude|copilot|chatgpt/i.test(value), 'neutral-git-identity-required');
  }
}
function commit(path: string, base: string, files: string[], message: string) {
  neutralIdentity(path);
  const head = git(path, 'rev-parse', 'HEAD');
  const changed = git(path, 'diff', '--name-only', base).split('\n').filter(Boolean);
  requirePackage(changed.length > 0 && changed.every(file => files.includes(file))
    && git(path, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).every(file => files.includes(file)), 'unexpected-publication-diff');
  if (head !== base) {
    requirePackage(git(path, 'show', '-s', '--format=%P', head) === base && !git(path, 'status', '--porcelain')
      && git(path, 'show', '-s', '--format=%s', head) === message, 'unexpected-publication-commit'); return head;
  }
  git(path, 'diff', '--check'); git(path, 'add', '--', ...files); git(path, 'commit', '-m', message);
  return git(path, 'rev-parse', 'HEAD');
}
function publishBranch(path: string, branch: string, head: string) {
  requirePackage(git(path, 'branch', '--show-current') === branch && git(path, 'rev-parse', 'HEAD') === head, 'publication-branch-mismatch');
  const base = git(path, 'show', '-s', '--format=%P', head);
  requirePackage(shaPattern.test(base), 'linear-publication-commit-required');
  const existing = git(source, 'ls-remote', 'origin', `refs/heads/${branch}`), remote = existing.split('\t')[0];
  requirePackage(!existing || remote === head || remote === base, 'publication-branch-conflict');
  if (remote !== head) {
    const pcoat = Bun.which('pcoat');
    if (pcoat) {
      if (!existing) git(path, 'push', 'origin', `${base}:refs/heads/${branch}`);
      git(path, 'fetch', 'origin', branch); git(path, 'branch', '--set-upstream-to=origin/' + branch);
      command([pcoat], path, { ...process.env, REMOTE: 'origin', BRANCH: branch, SLEEP_SECONDS: '0' });
    } else git(path, 'push', 'origin', `${head}:refs/heads/${branch}`);
  }
  requirePackage(git(source, 'ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0] === head, 'publication-branch-not-confirmed');
  git(path, 'fetch', 'origin', branch);
  requirePackage(git(path, 'rev-parse', 'origin/' + branch) === head, 'publication-tracking-ref-mismatch');
}
async function pullRequest(base: string, head: string, sha: string, title: string, body: string, resuming: boolean) {
  const read = async () => {
    const values = gh(`pulls?state=all&head=andrey-krasheninnikov:${head}&base=${base}&per_page=100`);
    requirePackage(Array.isArray(values) && values.length <= 1, 'publication-pr-conflict');
    const value = values[0]; if (!value) return undefined;
    requirePackage(value.head.sha === sha && value.head.repo.full_name === repository && value.base.repo.full_name === repository
      && value.title === title && value.body === body && (value.state === 'open' || value.merged_at), 'publication-pr-conflict');
    return value.number as number;
  };
  return reconcileCreation(resuming, read, async () => {
    const result = spawnSync('gh', ['api', `repos/${repository}/pulls`, '--input', '-'], {
      input: JSON.stringify({ base, head, title, body }), encoding: 'utf8', timeout: 60000,
    }); requirePackage(result.status === 0, 'publication-pr-not-confirmed');
  });
}
async function mergePullRequest(number: number, base: string, previous: string, head: string, title: string, method: 'squash' | 'merge', expectedDevelopment: string, expectedMain: string) {
  let value = gh(`pulls/${number}`);
  requirePackage(value.head.sha === head && value.base.ref === base, 'publication-pr-changed');
  if (!value.merged) {
    requirePackage(value.state === 'open', 'publication-pr-closed'); assertRefs(expectedDevelopment, expectedMain);
    try { command(['gh', 'pr', 'merge', String(number), '--repo', repository, '--' + method, '--match-head-commit', head, '--subject', title, '--body', '']); }
    catch { /* A lost merge response is resolved by the PR and commit readback below. */ }
    value = gh(`pulls/${number}`);
  }
  requirePackage(value.merged, 'publication-pr-not-merged');
  const merged = gh(`git/commits/${value.merge_commit_sha}`), tree = gh(`git/commits/${head}`).tree.sha;
  requirePackage(isDeepStrictEqual(merged.parents.map((item: any) => item.sha), method === 'squash' ? [previous] : [previous, head])
    && merged.tree.sha === tree, 'publication-merge-result-changed');
  return value.merge_commit_sha as string;
}
function minorVersion(main: string, version: string) {
  const old = JSON.parse(git(source, 'show', `${main}:package.json`)).version;
  requirePackage(/^\d+\.\d+\.\d+$/.test(old) && version === `${old.split('.')[0]}.${Number(old.split('.')[1]) + 1}.0`, 'next-minor-version-required');
  const latest = git(source, 'tag', '--merged', main, '--sort=-version:refname').split('\n').find(value => /^v\d+\.\d+\.\d+$/.test(value));
  requirePackage(latest === 'v' + old, 'main-release-version-mismatch');
  const cargo = git(source, 'show', `${main}:Cargo.toml`).match(/^version = "([^"]+)"/m)?.[1];
  const lock = git(source, 'show', `${main}:Cargo.lock`).match(/name = "want-wallpapers-server"\nversion = "([^"]+)"/)?.[1];
  requirePackage(cargo === old && lock === old, 'main-release-version-mismatch');
}
async function localRelease(mode: 'check' | 'prepare' | 'deploy', path: string, tag: string) {
  const environment = { ...process.env, PATH: join(homedir(), '.local/share/want-wallpapers/tools/bin') + ':' + process.env.PATH };
  const child = Bun.spawn(['python3', '-B', join(source, 'scripts/local-release.py'), mode, '--tag', tag, '--profile', 'full', '--source-root', path, ...(mode === 'prepare' ? ['--publish'] : [])],
    { cwd: path, env: environment, stdout: 'inherit', stderr: 'inherit' });
  requirePackage(await child.exited === 0, 'collection-local-release-failed:' + mode);
  const result = readPackageJson(join(homedir(), `.local/state/want-wallpapers/releases/${tag}/release.json`));
  requirePackage(result.tag === tag && result.verificationProfile === 'full', 'collection-local-release-identity-mismatch'); return result;
}
function protectTag(tag: string) {
  const policy = JSON.parse(readFileSync(join(source, '.github/release-policy.json'), 'utf8')).tagRuleset;
  const rules = gh(`rulesets/${policy.id}`), types = rules.rules.map((item: any) => item.type);
  requirePackage(rules.target === 'tag' && rules.enforcement === 'active' && Date.parse(rules.updated_at) === Date.parse(policy.updatedAt)
    && rules.bypass_actors?.length === 0 && types.includes('update') && types.includes('deletion')
    && rules.conditions.ref_name.include.includes('refs/tags/v*') && rules.conditions.ref_name.exclude.length === 0, 'release-tag-policy-changed');
  const configuration = join(homedir(), '.config/want-wallpapers/local-release/config.json');
  command(['python3', '-B', '-c', "import importlib.util,sys; p=sys.argv[1]; s=importlib.util.spec_from_file_location('local_release',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); c=m.configuration(sys.argv[2]); k=open(c['signingPublicKey']).read().split(); m.require(' '.join(k[:2]) in m.run(['ssh-add','-L']),'release-key-not-loaded')", join(source, 'scripts/local-release.py'), configuration]);
  requirePackage(/^v\d+\.\d+\.\d+$/.test(tag), 'semantic-release-tag-required');
}
export function deploymentReceipt(value: any, collection: PublicCollectionPackage, tag: string, sha: string) {
  requirePackage(value.tag === tag && value.sourceSha === sha && value.verificationProfile === 'full' && value.published
    && /^sha256:[0-9a-f]{64}$/.test(value.indexDigest), 'collection-release-not-published');
  const deployed = value.deployment;
  requirePackage(deployed?.state === 'succeeded' && deployed.backupVerified === true && deployed.revision === sha && deployed.architecture === 'amd64'
    && deployed.sourceSha === sha && deployed.tag === tag && deployed.indexDigest === value.indexDigest && /^[0-9a-f]{32}$/.test(deployed.requestId), 'collection-deployment-not-verified');
  return { schemaVersion: 1, packageHash: collection.packageHash, collectionId: collection.manifest.collection.id,
    deploymentRequest: deployed.requestId, tag, sourceSha: sha, imageDigest: value.indexDigest, verificationProfile: 'full' as const };
}
export async function verifyLiveCollection(collection: PublicCollectionPackage, sha: string) {
  const ready = await fetch(production + '/health/ready', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  requirePackage(ready.ok && ready.headers.get('cache-control')?.includes('no-store') && (await ready.json()).revision === sha, 'collection-live-revision-mismatch');
  const snapshot = await fetch(production + '/api/v1/catalog/snapshot', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  requirePackage(snapshot.ok, 'collection-live-catalogue-unavailable');
  const catalogue = await snapshot.json();
  requirePackage(catalogue.collections.some((item: unknown) => isDeepStrictEqual(item, collection.manifest.collection))
    && collection.manifest.wallpapers.every(wallpaper => catalogue.wallpapers.some((item: unknown) => isDeepStrictEqual(item, wallpaper))), 'collection-live-catalogue-mismatch');
  for (const locale of locales) for (const path of [`/collections/${collection.manifest.collection.slug}/`, ...collection.manifest.wallpapers.map(item => `/wallpapers/${item.slug}/`)]) {
    const route = localPath(locale, path), response = await fetch(production + route, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    requirePackage(response.ok && response.headers.get('content-type')?.includes('text/html'), 'collection-page-unavailable');
    const page = await parsePage(await response.text(), route), normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    requirePackage(page.lang.toLowerCase() === locale && page.dir === (locale === 'ar' ? 'rtl' : 'ltr')
      && isDeepStrictEqual(page.canonical, [production + route]) && locales.every(language => page.alternates.filter(alternate =>
        alternate.lang.toLowerCase() === language && alternate.href === production + localPath(language, path)).length === 1)
      && page.mainText.includes(normalize(collection.manifest.collection.title[locale]))
      && collection.stories[locale].every(paragraph => page.mainText.includes(normalize(paragraph))), 'collection-page-content-mismatch');
  }
  for (const wallpaper of collection.manifest.wallpapers) for (const variant of ['desktop', 'mobile'] as const) {
    const asset = collection.assets.find(item => item.role === 'final' && item.design === wallpaper.number && item.variant === variant)!;
    const response = await fetch(production + downloadUrl(wallpaper, variant), { redirect: 'error', signal: AbortSignal.timeout(60000) });
    requirePackage(response.ok && response.headers.get('content-type')?.split(';')[0] === 'image/png', 'collection-live-download-mismatch');
    const reader = response.body?.getReader(); requirePackage(reader, 'collection-live-download-mismatch');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; requirePackage(size <= 64 * 1024 * 1024, 'collection-live-download-too-large'); chunks.push(chunk.value); }
    } finally { await reader.cancel(); reader.releaseLock(); }
    requirePackage(digest(Buffer.concat(chunks)) === asset.sha256, 'collection-live-download-mismatch');
  }
  return { pages: locales.length * 6, downloads: 10, revision: sha, verifiedAt: new Date().toISOString() };
}

export function catalogueBaseline(input: any, collection: PublicCollectionPackage) {
  const ids = new Set(collection.manifest.wallpapers.map(item => item.id)), id = collection.manifest.collection.id;
  return digest(canonical({
    collections: input.collections.filter((item: any) => item.id !== id).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    wallpapers: input.wallpapers.filter((item: any) => item.collectionId !== id).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    publicationDates: Object.fromEntries(Object.entries(input.publicationDates ?? {}).filter(([key]) => !ids.has(key))),
    collectionPublicationDates: Object.fromEntries(Object.entries(input.collectionPublicationDates ?? {}).filter(([key]) => key !== id)),
    listing: { collections: Object.fromEntries(Object.entries(input.listing.collections).filter(([key]) => key !== id)),
      wallpapers: Object.fromEntries(Object.entries(input.listing.wallpapers).filter(([key]) => !ids.has(key))) },
  }));
}

export function catalogueExportHash(input: any, collection: PublicCollectionPackage, baseline: string) {
  requirePackage(catalogueBaseline(input, collection) === baseline, 'unrelated-catalogue-changes');
  const id = collection.manifest.collection.id, items = input.wallpapers.filter((item: any) => item.collectionId === id);
  requirePackage(input.collections.filter((item: any) => item.id === id).length === 1
    && input.collections.some((item: any) => isDeepStrictEqual(item, collection.manifest.collection))
    && items.length === 5 && collection.manifest.wallpapers.every(item => items.some((candidate: unknown) => isDeepStrictEqual(item, candidate)))
    && input.listing.collections[id] === true && items.every((item: any) => input.listing.wallpapers[item.id] === true), 'approved-catalogue-export-mismatch');
  return digest(canonical({ collections: [...input.collections].sort((a, b) => a.id.localeCompare(b.id)),
    wallpapers: [...input.wallpapers].sort((a, b) => a.id.localeCompare(b.id)), listing: input.listing,
    publicationDates: input.publicationDates, collectionPublicationDates: input.collectionPublicationDates }));
}

export async function publishCollection(input: string, configPath: string) {
  const checked = await approvedPackage(input), { root, packageHash, value } = checked;
  const config = readPackageJson(configPath) as Config;
  requirePackage(Object.keys(config).sort().join(',') === 'awsProfile,catalogTokenFile,expectedDevelopment,expectedMain,version'
    && typeof config.version === 'string' && typeof config.awsProfile === 'string' && typeof config.catalogTokenFile === 'string'
    && /^\d+\.\d+\.\d+$/.test(config.version) && shaPattern.test(config.expectedDevelopment) && shaPattern.test(config.expectedMain), 'invalid-publication-config');
  const token = realpathSync(config.catalogTokenFile), details = lstatSync(config.catalogTokenFile);
  requirePackage(token === config.catalogTokenFile && details.isFile() && details.uid === process.getuid?.() && !(details.mode & 0o077), 'private-catalogue-token-required');
  privateRoot(dirname(resolve(configPath)));
  requirePackage(!git(source, 'status', '--porcelain'), 'clean-publisher-checkout-required');
  requirePackage(git(source, 'remote', 'get-url', 'origin').replace(/\.git$/, '') === 'git@github.com:' + repository
    || git(source, 'remote', 'get-url', 'origin').replace(/\.git$/, '') === 'https://github.com/' + repository, 'publication-repository-mismatch');
  process.env.BACKEND_API_URL = production; process.env.CATALOG_API_TOKEN_FILE = token;
  mkdirSync(packagePath(root, 'publication'), { recursive: true, mode: 0o700 }); privateRoot(packagePath(root, 'publication'));
  const journal = new PublicationJournal(packagePath(root, 'publication/publish.json'), { packageHash, collectionId: value.manifest.collection.id, ...config });
  async function step<T>(name: string, identity: unknown, execute: (resuming: boolean) => Promise<T>) {
    requirePackage((await approvedPackage(root)).packageHash === packageHash, 'package-changed');
    return journal.step(name, identity, execute);
  }
  const tag = 'v' + config.version, collection = publicCollection(value, packageHash);
  const stateRoot = join(homedir(), '.local/share/want-wallpapers/collection-releases', packageHash); privateRoot(stateRoot, true);
  await step('preflight', config, async () => {
    assertRefs(config.expectedDevelopment, config.expectedMain); git(source, 'fetch', '--all', '--prune');
    minorVersion(config.expectedMain, config.version);
    requirePackage(git(source, 'merge-base', config.expectedMain, config.expectedDevelopment) === config.expectedMain, 'main-backmerge-required-before-collection-release');
    requirePackage(!git(source, 'ls-remote', 'origin', `refs/heads/release/${tag}`, `refs/tags/${tag}`), 'release-version-occupied');
    protectTag(tag); return { tag };
  });
  await step('upload', { packageHash }, async () => { await uploadApprovedCollection(root, new TimewebCollectionStore(root, config.awsProfile, `wallpapers/assets/collections/${value.manifest.collection.id}/`)); return { complete: true }; });
  const catalogue = await step('catalogue', { packageHash }, async () => {
    assertRefs(config.expectedDevelopment, config.expectedMain);
    const response = await fetch(production + '/api/v1/catalog/snapshot', { redirect: 'error', signal: AbortSignal.timeout(15000) });
    requirePackage(response.ok, 'catalogue-snapshot-unavailable'); const snapshot = await response.json();
    const expected = JSON.parse(git(source, 'show', `${config.expectedDevelopment}:frontend/src/data/catalog-live.json`));
    const baseline = catalogueBaseline(snapshot, collection);
    requirePackage(baseline === catalogueBaseline(expected, collection), 'unrelated-catalogue-changes');
    const saved = await catalogRequest<{ collections: { item: Collection; archived: boolean }[]; wallpapers: { item: Wallpaper; archived: boolean }[] }>('');
    const existing = saved.collections.find(record => record.item.id === collection.manifest.collection.id);
    if (!existing) {
      try { await addCollection(value.manifest); } catch { /* Import is transactional; verify the catalogue before any retry. */ }
    }
    const verified = await catalogRequest<typeof saved>('');
    requirePackage(verified.collections.some(record => !record.archived && isDeepStrictEqual(record.item, value.manifest.collection))
      && verified.wallpapers.filter(record => record.item.collectionId === value.manifest.collection.id).length === 5
      && value.manifest.wallpapers.every(item => verified.wallpapers.some(record => !record.archived && isDeepStrictEqual(record.item, item))), 'catalogue-import-not-confirmed');
    const refreshed = await fetch(production + '/api/v1/catalog/snapshot', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    requirePackage(refreshed.ok, 'catalogue-snapshot-unavailable');
    const exportHash = catalogueExportHash(await refreshed.json(), collection, baseline);
    return { collectionId: value.manifest.collection.id, designs: 5, baseline, exportHash };
  });
  const featureBranch = `feature/add-${value.manifest.collection.id}`;
  const feature = await step('feature', { development: config.expectedDevelopment, packageHash }, async () => {
    assertRefs(config.expectedDevelopment, config.expectedMain);
    const path = worktree(stateRoot, 'feature', config.expectedDevelopment, featureBranch);
    command(['bun', 'scripts/catalog-pull.ts'], join(path, 'frontend'));
    requirePackage(catalogueExportHash(JSON.parse(readFileSync(join(path, 'frontend/src/data/catalog-live.json'), 'utf8')), collection, catalogue.baseline) === catalogue.exportHash, 'catalogue-export-changed');
    const registry = join(path, 'frontend/src/data/collection-publications.json'), publications = JSON.parse(readFileSync(registry, 'utf8'));
    requirePackage(!publications[value.manifest.collection.id] || isDeepStrictEqual(publications[value.manifest.collection.id], collection), 'publication-registry-conflict');
    publications[value.manifest.collection.id] = collection; writeJson(registry, publications);
    const sha = commit(path, config.expectedDevelopment, ['frontend/src/data/catalog-live.json', 'frontend/src/data/collection-publications.json'], `feat: add ${value.manifest.collection.id} collection`);
    publishBranch(path, featureBranch, sha); return { sha, path };
  });
  const featureBody = `Adds ${value.manifest.collection.id}: five designs, ten PNG wallpapers and stories in six languages.\n\nPackage: ${packageHash}\nSource: https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/${value.manifest.collection.id}/collection-package.json\nRelease: ${tag}\nSource commit: ${feature.sha}\n\nThe package and CDN hashes are verified. The full local release gate runs before the release PR merges into main. No Actions are dispatched.`;
  const featurePr = await step('feature-pr', { head: feature.sha }, resuming => pullRequest('development', featureBranch, feature.sha, `feat: add ${value.manifest.collection.id} collection`, featureBody, resuming));
  const development = await step('feature-merge', { head: feature.sha, base: config.expectedDevelopment }, () => mergePullRequest(featurePr, 'development', config.expectedDevelopment, feature.sha, `feat: add ${value.manifest.collection.id} collection`, 'squash', config.expectedDevelopment, config.expectedMain));
  const releaseBranch = `release/${tag}`;
  const release = await step('release-candidate', { development, main: config.expectedMain, version: config.version }, async () => {
    assertRefs(development, config.expectedMain); git(source, 'fetch', '--all', '--prune');
    requirePackage(git(source, 'merge-base', config.expectedMain, development) === config.expectedMain, 'main-backmerge-required-before-collection-release');
    const path = worktree(stateRoot, 'release', development, releaseBranch);
    const packagePath = join(path, 'package.json'), manifest = JSON.parse(readFileSync(packagePath, 'utf8')); manifest.version = config.version; writeJson(packagePath, manifest);
    for (const name of ['Cargo.toml', 'Cargo.lock']) {
      const file = join(path, name), text = readFileSync(file, 'utf8');
      const pattern = name === 'Cargo.toml' ? /^version = "[^"]+"/m : /(name = "want-wallpapers-server"\n)version = "[^"]+"/;
      requirePackage(pattern.test(text), 'workspace-release-version-missing');
      writeFileSync(file, text.replace(pattern, name === 'Cargo.toml' ? `version = "${config.version}"` : `$1version = "${config.version}"`));
    }
    const notes = `## ${config.version} (${journal.value.startedAt.slice(0, 10)})\n\n- Add ${value.manifest.collection.title.en}: five designs with desktop and mobile PNGs, six-language stories and collection search.\n- Publish the approved collection through the MacBook release flow with verified CDN files and resumable receipts.\n`;
    const changelog = join(path, 'CHANGELOG.md'), current = readFileSync(changelog, 'utf8');
    requirePackage(!current.includes(`## ${config.version} (`) || current.includes(notes), 'release-notes-conflict');
    if (!current.includes(notes)) writeFileSync(changelog, current.replace(/^(# [^\n]+\n)/, '$1\n' + notes));
    const sha = commit(path, development, ['package.json', 'Cargo.toml', 'Cargo.lock', 'CHANGELOG.md'], `chore(release): prepare ${tag}`);
    publishBranch(path, releaseBranch, sha); return { path, sha, notes };
  });
  await step('release-checks', { tree: git(release.path, 'rev-parse', 'HEAD^{tree}'), tag }, async () => { assertRefs(development, config.expectedMain); await localRelease('check', release.path, tag); return { profile: 'full' }; });
  const releaseBody = `Releases ${value.manifest.collection.id} as ${tag}.\n\nCollection PR: https://github.com/${repository}/pull/${featurePr}\nPackage: ${packageHash}\nRelease commit: ${release.sha}\n\nThe full local release gate passed. The existing MacBook publisher and restricted SSH deployment retain backup, PostgreSQL 18 restore verification, migrations and readiness checks. No Actions are dispatched.`;
  const releasePr = await step('release-pr', { head: release.sha }, resuming => pullRequest('main', releaseBranch, release.sha, `chore(release): publish ${tag}`, releaseBody, resuming));
  const main = await step('release-merge', { head: release.sha, base: config.expectedMain }, () => mergePullRequest(releasePr, 'main', config.expectedMain, release.sha, `chore(release): publish ${tag}`, 'merge', development, config.expectedMain));
  await step('tag', { tag, main }, async () => {
    assertRefs(development, main); protectTag(tag); git(source, 'fetch', 'origin', 'main', 'development');
    const existing = git(source, 'ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`);
    if (!existing) {
      neutralIdentity(release.path);
      if (!git(release.path, 'tag', '--list', tag)) git(release.path, 'tag', '-a', tag, main, '-m', 'Release ' + config.version);
      requirePackage(git(release.path, 'cat-file', '-t', tag) === 'tag' && git(release.path, 'rev-parse', tag + '^{}') === main, 'release-tag-conflict');
      git(release.path, 'push', 'origin', `refs/tags/${tag}`);
    }
    const reference = gh(`git/ref/tags/${tag}`).object;
    requirePackage(reference.type === 'tag', 'release-tag-not-annotated');
    const annotated = gh(`git/tags/${reference.sha}`);
    requirePackage(annotated.object.type === 'commit' && annotated.object.sha === main, 'release-tag-conflict');
    const saved = git(source, 'ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`).split('\n');
    requirePackage(saved.length === 2 && saved.some(line => line === main + `\trefs/tags/${tag}^{}`), 'release-tag-not-confirmed'); return { tag, sha: main };
  });
  const tagged = worktree(stateRoot, 'tag', main);
  const publication = await step('image', { tag, sha: main }, async () => { assertRefs(development, main); const state = await localRelease('prepare', tagged, tag); return { digest: state.indexDigest }; });
  const deployment = await step('deployment', { tag, sha: main, digest: publication.digest }, async () => {
    assertRefs(development, main); const state = await localRelease('deploy', tagged, tag); return deploymentReceipt(state, collection, tag, main);
  });
  const live = await step('live', deployment, () => verifyLiveCollection(collection, main));
  const backmerge = await step('backmerge', { development, main }, async () => {
    git(source, 'fetch', '--all', '--prune');
    const path = worktree(stateRoot, 'backmerge', development);
    if (git(path, 'rev-parse', 'HEAD') === development) {
      requirePackage(!git(path, 'status', '--porcelain'), 'dirty-backmerge-checkout'); neutralIdentity(path);
      git(path, 'merge', '--no-ff', '--no-commit', main); git(path, 'commit', '--no-edit');
    }
    const sha = git(path, 'rev-parse', 'HEAD');
    requirePackage(git(path, 'show', '-s', '--format=%P') === development + ' ' + main
      && git(path, 'rev-parse', 'HEAD^{tree}') === git(tagged, 'rev-parse', 'HEAD^{tree}'), 'publication-backmerge-mismatch');
    const current = refs();
    if (current.development !== sha) { requireRefs(current, { development, main }); git(path, 'push', 'origin', `${sha}:refs/heads/development`); }
    assertRefs(sha, main); return sha;
  });
  await step('github-release', { tag, notes: release.notes }, async resuming => {
    assertRefs(backmerge, main);
    return reconcileCreation(resuming, async () => {
      const values = gh('releases?per_page=100'), saved = values.find((item: any) => item.tag_name === tag); if (!saved) return undefined;
      requirePackage(saved.body === release.notes.trim() && !saved.draft && !saved.prerelease, 'github-release-conflict'); return { url: saved.html_url };
    }, async () => {
      const notes = packagePath(root, 'publication/release-notes.md'); writePrivate(notes, release.notes.trim());
      command(['gh', 'release', 'create', tag, '--repo', repository, '--verify-tag', '--latest', '--title', tag, '--notes-file', notes]);
    });
  });
  await step('cleanup', { featureBranch, releaseBranch }, async () => {
    for (const [branch, sha] of [[featureBranch, feature.sha], [releaseBranch, release.sha]]) {
      const remote = git(source, 'ls-remote', 'origin', `refs/heads/${branch}`); if (!remote) continue;
      requirePackage(remote.split('\t')[0] === sha && gh(`pulls?state=open&head=andrey-krasheninnikov:${branch}&per_page=100`).length === 0
        && gh(`pulls?state=open&base=${branch}&per_page=100`).length === 0, 'publication-branch-still-needed');
      git(source, 'push', `--force-with-lease=refs/heads/${branch}:${sha}`, 'origin', '--delete', branch);
      requirePackage(!git(source, 'ls-remote', 'origin', `refs/heads/${branch}`), 'publication-branch-cleanup-unconfirmed');
    } return { removed: [featureBranch, releaseBranch] };
  });
  const receipt = { ...deployment, verifiedAt: live.verifiedAt, live, featurePr, releasePr,
    releaseUrl: journal.value.phases['github-release']!.value.url };
  writePrivate(packagePath(root, 'publication/receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); return receipt;
}
export async function publicationStatus(input: string) {
  const checked = await approvedPackage(input), path = packagePath(checked.root, 'publication/publish.json');
  if (!existsSync(path)) return { packageHash: checked.packageHash, publicationStarted: false };
  const value = readPackageJson(path); requirePackage(value.identity.packageHash === checked.packageHash, 'publication-intent-mismatch');
  return { packageHash: checked.packageHash, collectionId: checked.value.manifest.collection.id, tag: 'v' + value.identity.version,
    phases: Object.fromEntries(Object.entries(value.phases).map(([name, phase]: [string, any]) => [name, phase.state])),
    ...(existsSync(packagePath(checked.root, 'publication/receipt.json')) ? { receipt: readPackageJson(packagePath(checked.root, 'publication/receipt.json')) } : {}) };
}

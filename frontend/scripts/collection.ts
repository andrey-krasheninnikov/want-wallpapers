import { publishCollection, publicationStatus } from './collection-publication';
import { Database } from 'bun:sqlite';
import { existsSync, lstatSync } from 'node:fs';
import { approvePackage, initializePackage, packagePath, packageStatus, privateRoot, requirePackage, validatePackage } from './collection-package';
import { prepareMedia } from './collection-media';
import { reviewPackage } from './collection-review';

async function main() {
  process.umask(0o077);
  const [command, input, ...args] = process.argv.slice(2);
  requirePackage(command && input, 'Usage: bun run collection <init|prepare|validate|review|approve|reject|status|resume|publish|publication-status> PRIVATE_DIRECTORY [arguments]');
  if (command === 'init') { requirePackage(args.length === 2, 'init requires collection ID and theme'); initializePackage(input, args[0]!, args[1]!); return; }
  const root = privateRoot(input), lock = packagePath(root, 'command-lock.sqlite');
  if (existsSync(lock)) requirePackage(!(lstatSync(lock).mode & 0o077), 'private-command-lock-required');
  const state = new Database(lock, { create: true });
  try {
    state.run('BEGIN IMMEDIATE');
    if (command === 'publish' || command === 'resume' && args.length === 1) { requirePackage(args.length === 1, 'private-publication-config-required'); console.log(JSON.stringify(await publishCollection(root, args[0]!))); }
    else if (command === 'publication-status') { requirePackage(!args.length, 'unexpected-arguments'); console.log(JSON.stringify(await publicationStatus(root))); }
    else if (command === 'prepare') { requirePackage(!args.length, 'unexpected-arguments'); const checked = await prepareMedia(root); console.log(JSON.stringify({ packageHash: checked.packageHash })); }
    else if (command === 'validate') { requirePackage(!args.length, 'unexpected-arguments'); const checked = await validatePackage(root); console.log(JSON.stringify({ collectionId: checked.value.manifest.collection.id, packageHash: checked.packageHash })); }
    else if (command === 'review') { requirePackage(!args.length, 'unexpected-arguments'); console.log(await reviewPackage(root)); }
    else if (command === 'approve' || command === 'reject') { requirePackage(args.length === 1 && /^[a-f0-9]{64}$/.test(args[0]!), 'exact-package-hash-required'); console.log(JSON.stringify(await approvePackage(root, args[0]!, command === 'approve' ? 'approved' : 'rejected'))); }
    else if (command === 'status' || command === 'resume') { requirePackage(!args.length, 'unexpected-arguments'); console.log(JSON.stringify(await packageStatus(root))); }
    else throw new Error('unknown-collection-command');
  } finally { state.close(); }
}
if (import.meta.main) main().catch(error => {
  const code = error instanceof Error && /^[a-z][a-z0-9-]*(?::(?:git|gh|bun|python3|check|prepare|deploy))?$/.test(error.message) ? error.message : 'invalid-collection-command';
  console.error(`Collection command failed: ${code}. No credential values were printed.`); process.exitCode = 1;
});

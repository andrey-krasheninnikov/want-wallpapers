import { Database } from 'bun:sqlite';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { approvePackage, initializePackage, packageStatus, privateRoot, requirePackage, validatePackage } from './collection-package';
import { prepareMedia } from './collection-media';
import { reviewPackage } from './collection-review';

async function main() {
  process.umask(0o077);
  const [command, input, ...args] = process.argv.slice(2);
  requirePackage(command && input, 'Usage: bun run collection <init|prepare|validate|review|approve|reject|status|resume> PRIVATE_DIRECTORY [arguments]');
  if (command === 'init') { requirePackage(args.length === 2, 'init requires collection ID and theme'); initializePackage(input, args[0]!, args[1]!); return; }
  const root = privateRoot(input), state = new Database(join(root, '.lock.sqlite'), { create: true });
  chmodSync(join(root, '.lock.sqlite'), 0o600);
  try {
    state.run('BEGIN IMMEDIATE');
    if (command === 'prepare') { requirePackage(!args.length, 'unexpected-arguments'); const checked = await prepareMedia(root); console.log(JSON.stringify({ packageHash: checked.packageHash })); }
    else if (command === 'validate') { requirePackage(!args.length, 'unexpected-arguments'); const checked = await validatePackage(root); console.log(JSON.stringify({ collectionId: checked.value.manifest.collection.id, packageHash: checked.packageHash })); }
    else if (command === 'review') { requirePackage(!args.length, 'unexpected-arguments'); console.log(await reviewPackage(root)); }
    else if (command === 'approve' || command === 'reject') { requirePackage(args.length === 1 && /^[a-f0-9]{64}$/.test(args[0]!), 'exact-package-hash-required'); console.log(JSON.stringify(await approvePackage(root, args[0]!, command === 'approve' ? 'approved' : 'rejected'))); }
    else if (command === 'status' || command === 'resume') { requirePackage(!args.length, 'unexpected-arguments'); console.log(JSON.stringify(await packageStatus(root))); }
    else throw new Error('unknown-collection-command');
  } finally { state.close(); }
}
if (import.meta.main) main().catch(() => { console.error('Collection command failed. Check package structure, private permissions, media and approval. No credential values were printed.'); process.exitCode = 1; });

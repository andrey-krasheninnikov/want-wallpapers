import { DraftError, DraftStore, requireDraft, draftObject, hash, type Outcome } from './generation-store';
import { prepareResult, packageArchive } from './generation-media';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reviewFields } from './generation-review';
import { timingSafeEqual } from 'node:crypto';

export function draftApi(root: string, token: string) {
  const store = new DraftStore(root);
  const origin = process.env.DRAFT_FORM_ORIGIN ?? 'http://localhost:5678';
  requireDraft(/^http:\/\/(localhost|127\.0\.0\.1):[0-9]{1,5}$/.test(origin), 'local-form-origin-required');
  const handler = async (request: Request): Promise<Response> => {
    try {
      if (new URL(request.url).pathname === '/healthz' && request.method === 'GET') return Response.json({ status: 'ready' });
      const supplied = Buffer.from(request.headers.get('Authorization') ?? ''), expected = Buffer.from(`Bearer ${token}`);
      requireDraft(supplied.length === expected.length && timingSafeEqual(supplied, expected), 'unauthorized', 401);
      const url = new URL(request.url);
      const json = async (limit = 1024 * 1024) => {
        requireDraft(Number(request.headers.get('content-length') ?? 0) <= limit, 'request-too-large', 413);
        const reader = request.body?.getReader();
        requireDraft(reader, 'invalid-json');
        const chunks: Uint8Array[] = []; let length = 0;
        try {
          while (true) {
            const next = await reader.read(); if (next.done) break;
            length += next.value.byteLength;
            requireDraft(length <= limit, 'request-too-large', 413); chunks.push(next.value);
          }
        } finally { await reader.cancel(); }
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
      };
      if (url.pathname === '/runs' && request.method === 'POST') {
        const result = store.create(await json(10000));
        return Response.json(store.view(result.run.runId), { status: result.created ? 201 : 200 });
      }
      if (url.pathname === '/work/claim' && request.method === 'POST') return Response.json(store.claim(await json()));
      if (url.pathname === '/work/active' && request.method === 'GET') { const id = store.active(); const row = id ? store.attempt(id) : null; return Response.json({ attemptId: id, state: row?.state ?? (store.database.query("SELECT 1 FROM runs WHERE json_extract(state, '$.status') IN ('queued', 'generating') AND json_extract(state, '$.nextAt') <= ? LIMIT 1").get(Date.now()) ? 'idle' : 'waiting'), outcomeAvailable: !!row?.detail.outcome }); }
      const complete = url.pathname.match(/^\/attempts\/([0-9a-f-]{36})\/complete$/);
      if (complete && request.method === 'POST') {
        const receipt = draftObject(await json(100 * 1024 * 1024), 'invalid-provider-receipt');
        const attempt = store.attempt(complete[1]!).detail;
        requireDraft(typeof receipt.status === 'number' && Number.isInteger(receipt.status) && receipt.status >= 0 && receipt.status <= 599, 'invalid-provider-receipt');
        let outcome: Outcome | null = null;
        if (receipt.status) {
          outcome = { status: receipt.status, receiptHash: hash(JSON.stringify({ status: receipt.status, body: receipt.body })) };
          if (receipt.status >= 200 && receipt.status < 300) {
            try {
              outcome.result = await prepareResult(root, attempt.task, receipt.body);
              if ('manifest' in outcome.result) {
                const run = store.get(attempt.task.runId);
                requireDraft(outcome.result.manifest.collection.id === run.collectionId, 'draft-identity-changed');
                if (attempt.task.kind === 'text') requireDraft(JSON.stringify(outcome.result.scenes) === JSON.stringify(run.scenes), 'text-revision-changed-scenes');
              }
            } catch (error) { outcome.errorCode = error instanceof DraftError ? error.code : 'invalid-provider-result'; delete outcome.result; }
          } else if (receipt.status >= 400) {
            if (typeof receipt.retryAfter === 'number' && Number.isFinite(receipt.retryAfter)) outcome.retryAfter = receipt.retryAfter;
          } else outcome.errorCode = 'invalid-provider-status';
        }
        const run = store.complete(complete[1]!, outcome, receipt.context);
        return Response.json(store.view(run.runId));
      }
      const reconcile = url.pathname.match(/^\/attempts\/([0-9a-f-]{36})\/reconcile$/);
      if (reconcile && request.method === 'POST') return Response.json(store.view(store.complete(reconcile[1]!, null, await json()).runId));
      const decision = url.pathname.match(/^\/runs\/([0-9a-f-]{36})\/decision$/);
      if (decision && request.method === 'POST') return Response.json(store.view(store.decision(decision[1]!, await json()).runId));
      const asset = url.pathname.match(/^\/runs\/([0-9a-f-]{36})\/assets\/([1-5]-(?:desktop|mobile))$/);
      if (asset && request.method === 'GET') {
        const run = store.get(asset[1]!); requireDraft(url.searchParams.get('version') === String(run.version), 'stale-draft-version', 409);
        const item = run.assets[asset[2]!]; requireDraft(item, 'asset-not-found', 404);
        const preview = url.searchParams.get('preview') === 'true', digest = preview ? item.previewHash : item.hash;
        const bytes = readFileSync(join(root, 'assets', `${digest}.${preview ? 'webp' : 'png'}`));
        requireDraft(hash(bytes) === digest, 'asset-storage-conflict');
        return new Response(bytes, { headers: { 'Content-Type': preview ? 'image/webp' : 'image/png', 'Cache-Control': 'no-store' } });
      }
      const reference = url.pathname.match(/^\/attempts\/([0-9a-f-]{36})\/reference$/);
      if (reference && request.method === 'GET') {
        const row = store.attempt(reference[1]!); requireDraft(row.state === 'pending' && row.detail.task.referenceHash, 'reference-unavailable', 409);
        const bytes = readFileSync(join(root, 'assets', `${row.detail.task.referenceHash}.png`));
        requireDraft(hash(bytes) === row.detail.task.referenceHash, 'asset-storage-conflict');
        return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
      }
      const archive = url.pathname.match(/^\/runs\/([0-9a-f-]{36})\/package$/);
      if (archive && request.method === 'GET') {
        const run = store.get(archive[1]!); requireDraft(url.searchParams.get('version') === String(run.version), 'stale-draft-version', 409);
        const bytes = await packageArchive(root, run);
        return new Response(bytes, { headers: { 'Content-Type': 'application/x-tar', 'Content-Disposition': `attachment; filename="${run.collectionId}-v${run.version}.tar"`, 'Cache-Control': 'no-store' } });
      }
      const collection = url.pathname.match(/^\/collections\/(0*[1-9]\d*-[a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if (collection && request.method === 'GET') {
        const row = store.database.query('SELECT id FROM runs WHERE collection_id = ?').get(collection[1]!) as { id: string } | null;
        requireDraft(row, 'draft-not-found', 404); const view = store.view(row.id);
        return Response.json({ ...view, formFields: reviewFields(view, origin) });
      }
      const match = url.pathname.match(/^\/runs\/([0-9a-f-]{36})$/);
      if (match && request.method === 'GET') return Response.json(store.view(match[1]!));
      throw new DraftError('route-not-found', 404);
    } catch (error) {
      const known = error instanceof DraftError || error instanceof SyntaxError;
      return Response.json({ error: { code: error instanceof DraftError ? error.code : error instanceof SyntaxError ? 'invalid-json' : 'draft-operation-failed' } }, { status: error instanceof DraftError ? error.status : known ? 422 : 500 });
    }
  };
  return Object.assign(handler, { close: () => store.close() });
}

if (import.meta.main) {
  process.umask(0o077);
  try {
    const root = process.env.DRAFT_STORE_DIRECTORY ?? '/state';
    const token = readFileSync(join(root, 'access-token'), 'utf8').trim();
    requireDraft(/^[a-f0-9]{64}$/.test(token), 'local-credential-required');
    const api = draftApi(root, token);
    const server = Bun.serve({ hostname: '0.0.0.0', port: 8091, idleTimeout: 255, maxRequestBodySize: 100 * 1024 * 1024, fetch: api });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.stop(true); api.close(); process.exit(0); });
    console.log('Private collection draft store ready.');
  } catch { console.error('Private draft store startup failed. Check local storage and provisioning.'); process.exit(1); }
}

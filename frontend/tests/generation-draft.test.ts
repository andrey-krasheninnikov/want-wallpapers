import { afterEach, expect, test, setSystemTime } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { context, plan } from './generation-fixtures';
import { draftApi } from '../scripts/generation-api';
import { DraftStore } from '../scripts/generation-store';
import { packageArchive } from '../scripts/generation-media';
import { reviewFields } from '../scripts/generation-review';

const roots: string[] = [];
const openApis: ReturnType<typeof draftApi>[] = [];
afterEach(async () => { setSystemTime(); for (const api of openApis.splice(0)) api.close(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function client() {
  const root = await mkdtemp(join(tmpdir(), 'wallpapers-draft-test-'));
  roots.push(root);
  const api = draftApi(root, 'synthetic-local-access'); openApis.push(api);
  const request = async (path: string, body?: unknown) => {
    const response = await api(new Request(`http://draft-store:8091${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer synthetic-local-access', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { root, api, request };
}

test('one collection intent survives a repeat and rejects changed input', async () => {
  const { request } = await client();
  const input = { collectionId: '900026-test-light', theme: 'Quiet blue mountains at dawn' };
  const first = await request('/runs', input);
  expect(first.status).toBe(201);
  const repeated = await request('/runs', input);
  expect(repeated.status).toBe(200);
  expect(repeated.body.runId).toBe(first.body.runId);
  expect((await request('/runs', { ...input, theme: 'Changed scene' })).status).toBe(422);
  expect((await request('/runs', { ...input, collectionId: '../outside' })).status).toBe(422);
});

test('private endpoints require the configured local credential', async () => {
  const { api } = await client();
  expect((await api(new Request('http://draft-store:8091/runs'))).status).toBe(401);
});

test('claim checks Quest-only restrictions and excludes a concurrent request', async () => {
  const { request } = await client();
  const run = (await request('/runs', { collectionId: '900026-test-light', theme: 'Quiet mountains' })).body;
  const resume = () => request(`/runs/${run.runId}/decision`, { action: 'resume', version: 1 });
  const unsafe = context(); unsafe.key.questPollenOnly = false;
  expect((await request('/work/claim', unsafe)).status).toBe(422);
  expect((await request(`/runs/${run.runId}`)).body.errorCode).toBe('key-restrictions-required');
  await resume();
  const changed = context(); changed.imageModel.pricing.completionImageTokens = '0.01';
  expect((await request('/work/claim', changed)).status).toBe(422);
  await resume();
  const first = await request('/work/claim', context());
  expect(first.status).toBe(200);
  expect(first.body.task.kind).toBe('plan');
  expect(first.body.task.body.model).toBe('openai/gpt-5.4-nano');
  expect(first.body.task.body.messages[0].content).toContain('slug test-light, count 5');
  expect((await request('/work/claim', context())).status).toBe(409);
});

test('restart holds an unfinished attempt rather than issuing another request', async () => {
  const { root, request } = await client();
  const run = await request('/runs', { collectionId: '900026-test-light', theme: 'Quiet mountains' });
  const first = await request('/work/claim', context());
  expect(first.body.task.attemptId).toBeString();
  const restored = draftApi(root, 'synthetic-local-access'); openApis.push(restored);
  const response = await restored(new Request('http://draft-store:8091/work/claim', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-local-access' }, body: JSON.stringify(context()),
  }));
  expect(response.status).toBe(409);
  const status = await request(`/runs/${run.body.runId}`);
  expect(status.body.status).toBe('blocked');
  expect(status.body.errorCode).toBe('attempt-outcome-unknown');
});

async function prepared() {
  const instance = await client();
  const created = await instance.request('/runs', { collectionId: '900026-test-light', theme: 'Central blue abstraction' });
  let budget = 40;
  const usage: unknown[] = [];
  const advance = async (override?: unknown) => {
    const claimed = await instance.request('/work/claim', context(budget, usage));
    expect(claimed.status).toBe(200);
    const task = claimed.body.task;
    let body: unknown;
    if (['plan', 'text'].includes(task.kind)) body = { choices: [{ message: { content: JSON.stringify(plan()) } }], usage: { prompt_tokens: 500, completion_tokens: 1500 } };
    else {
      const width = task.kind === 'desktop' ? 3840 : 2160, height = task.kind === 'desktop' ? 2160 : 3840;
      const png = await sharp({ create: { width, height, channels: 3, background: { r: task.design * 20, g: 10, b: 90 } } }).png().toBuffer();
      body = { data: [{ b64_json: png.toString('base64') }], usage: { input_tokens: 500, output_tokens: 13342 } };
    }
    budget = Math.round((budget - 0.35) * 1e9) / 1e9;
    usage.push({ cursor_event_id: task.attemptId, model: task.body.model, meter_source: 'tier' });
    const receipt = { status: 200, body: override ?? body, context: context(budget, usage) };
    const complete = await instance.request(`/attempts/${task.attemptId}/complete`, receipt);
    expect(complete.status).toBe(200);
    return { complete, task, receipt };
  };
  return { ...instance, runId: created.body.runId, advance };
}

test('ten native PNGs make a private package; approval is tied to its exact version', async () => {
  const { root, api, request, runId, advance } = await prepared();
  for (let index = 0; index < 11; index++) await advance();
  const run = (await request(`/runs/${runId}`)).body;
  expect(run.status).toBe('review');
  expect(Object.keys(run.assets)).toHaveLength(10);
  expect(run.assets['1-desktop'].width).toBe(3840);
  expect(run.assets['1-mobile'].height).toBe(3840);
  const stale = await request(`/runs/${runId}/decision`, { action: 'approve', version: run.version - 1, packageHash: run.packageHash, contentChecked: true });
  expect(stale.status).toBe(409);
  const approved = await request(`/runs/${runId}/decision`, { action: 'approve', version: run.version, packageHash: run.packageHash, contentChecked: true });
  expect(approved.body.status).toBe('approved');
  const download = await api(new Request(`http://draft-store:8091/runs/${runId}/package?version=1`, {headers:{Authorization:'Bearer synthetic-local-access'}}));
  expect(download.status).toBe(200);
  expect(download.headers.get('Content-Type')).toBe('application/x-tar');
  const archive=Buffer.from(await download.arrayBuffer());
  expect(archive.includes(Buffer.from('manifest.json'))).toBe(true);
  expect(archive.includes(Buffer.from('5-mobile.png'))).toBe(true);
  const revision = await request(`/runs/${runId}/decision`, { action: 'revise', version: run.version, variants: ['1-desktop'], feedback: 'Make the central subject brighter', texts: false });
  expect(revision.body.approval).toBeNull();
  expect(revision.body.version).toBe(run.version + 1);
  expect((await request(`/runs/${runId}/decision`, { action: 'approve', version: run.version, packageHash: run.packageHash, contentChecked: true })).status).toBe(409);
  const duplicate = await readFile(join(root, 'assets', run.assets['2-desktop'].hash + '.png'));
  await advance({ data:[{b64_json:duplicate.toString('base64')}] });
  const blocked=(await request(`/runs/${runId}`)).body;
  expect(blocked.errorCode).toBe('duplicate-design-output');
  expect(blocked.packageHash).toBeNull();
  expect((await request(`/runs/${runId}/decision`,{action:'resume',version:blocked.version})).status).toBe(409);
  expect((await request(`/runs/${runId}/decision`,{action:'approve',version:blocked.version,packageHash:null,contentChecked:true})).status).toBe(409);
});

test('an invalid provider image keeps the charge and requires intervention', async () => {
  const { request, runId, advance } = await prepared();
  await advance();
  await advance({ data: [{ b64_json: Buffer.from('not PNG').toString('base64') }], usage: { input_tokens: 500, output_tokens: 13342 } });
  const run = (await request(`/runs/${runId}`)).body;
  expect(run.status).toBe('blocked');
  expect(run.errorCode).toBe('invalid-png');
  expect(run.imageAttempts).toBe(1);
  expect(run.spentPollen).toBe(0.7);
});

test('Pollen exhaustion reserves no attempt and an uncertain receipt cannot be retried', async () => {
  const { request, runId } = await prepared();
  expect((await request('/work/claim', context(.000001))).status).toBe(422);
  expect((await request(`/runs/${runId}`)).body.textAttempts).toBe(0);
  expect((await request(`/runs/${runId}`)).body.errorCode).toBe('pollen-budget-exhausted');
  await request(`/runs/${runId}/decision`, { action: 'resume', version: 1 });
  const task = (await request('/work/claim', context())).body.task;
  const body = { choices: [{ message: { content: JSON.stringify(plan()) } }], usage: { prompt_tokens: 500, completion_tokens: 1500 } };
  const result = await request(`/attempts/${task.attemptId}/complete`, { status: 200, body, context: context(39.65) });
  expect(result.body.errorCode).toBe('attempt-outcome-unknown');
  expect((await request('/work/claim', context(39.65))).status).toBe(409);
  const recovered = await request(`/attempts/${task.attemptId}/reconcile`, context(39.65, [{ cursor_event_id: 'confirmed', model: 'openai/gpt-5.4-nano', meter_source: 'tier' }]));
  expect(recovered.body.status).toBe('generating');
  expect(recovered.body.textAttempts).toBe(1);
});

test('four selected image revisions exhaust the shared reserve', async () => {
  const { request, runId, advance } = await prepared();
  for (let index = 0; index < 11; index++) await advance();
  for (let index = 0; index < 4; index++) {
    const run = (await request(`/runs/${runId}`)).body;
    expect((await request(`/runs/${runId}/decision`, { action: 'revise', version: run.version, variants: ['1-desktop'], texts: false, feedback: 'Brighter centre' })).status).toBe(200);
    await advance();
  }
  const run = (await request(`/runs/${runId}`)).body;
  expect(run.imageAttempts).toBe(14);
  expect(run.extraImageAttempts).toBe(4);
  expect((await request(`/runs/${runId}/decision`, { action: 'revise', version: run.version, variants: ['1-mobile'], texts: false, feedback: 'Brighter centre' })).status).toBe(422);
});

test('cancel during generation retains the charge and resuming reuses the completed response', async () => {
  const { request, runId } = await prepared();
  const task = (await request('/work/claim', context())).body.task;
  expect((await request(`/runs/${runId}/decision`, { action: 'cancel', version: 1 })).body.status).toBe('cancelled');
  const body = { choices: [{ message: { content: JSON.stringify(plan()) } }], usage: { prompt_tokens: 500, completion_tokens: 1500 } };
  const completed = await request(`/attempts/${task.attemptId}/complete`, { status: 200, body, context: context(39.65, [{ cursor_event_id: 'charged', model: 'openai/gpt-5.4-nano', meter_source: 'tier' }]) });
  expect(completed.body.status).toBe('cancelled');
  expect(completed.body.spentPollen).toBe(.35);
  const resumed = await request(`/runs/${runId}/decision`, { action: 'resume', version: 1 });
  expect(resumed.status).toBe(200);
  expect(resumed.body.manifest.collection.count).toBe(5);
  expect(resumed.body.textAttempts).toBe(1);
});

test('a confirmed text rejection backs off but never permits a third text attempt', async () => {
  setSystemTime(new Date('2026-11-01T00:00:00Z'));
  const { request } = await prepared();
  for (let index = 0; index < 2; index++) {
    const task = (await request('/work/claim', context())).body.task;
    const result = await request(`/attempts/${task.attemptId}/complete`, { status: 503, body: null, retryAfter: 60, context: context() });
    expect(result.body.errorCode).toBe('provider-backoff');
    expect((await request('/work/claim', context())).body.task).toBeNull();
    setSystemTime(new Date(Date.now() + 61000));
  }
  expect((await request('/work/claim', context())).status).toBe(422);
});

test('four started collections consume the UTC month slots even when cancelled', async () => {
  setSystemTime(new Date('2026-11-01T00:00:00Z'));
  const { request } = await client();
  for (let index = 0; index < 4; index++) {
    const run = (await request('/runs', { collectionId: `${900030+index}-test-light`, theme: 'Quiet shapes' })).body;
    const task = (await request('/work/claim', context())).body.task;
    await request(`/attempts/${task.attemptId}/complete`, { status: 503, body: null, context: context() });
    await request(`/runs/${run.runId}/decision`, { action: 'cancel', version: 1 });
  }
  const last = (await request('/runs', { collectionId: '900034-test-light', theme: 'Quiet shapes' })).body;
  expect((await request('/work/claim', context())).status).toBe(422);
  setSystemTime(new Date('2026-12-01T00:00:00Z'));
  await request(`/runs/${last.runId}/decision`, { action: 'resume', version: 1 });
  expect((await request('/work/claim', context())).body.task.kind).toBe('plan');
});


test('malformed receipts, decisions and oversized chunked JSON fail at the boundary', async () => {
  const { api, request } = await client();
  const run = (await request('/runs', { collectionId: '900026-test-light', theme: 'Quiet shapes' })).body;
  const task = (await request('/work/claim', context())).body.task;
  expect((await request(`/attempts/${task.attemptId}/complete`, null)).status).toBe(422);
  expect((await request(`/runs/${run.runId}/decision`, [])).status).toBe(422);
  const response = await api(new Request('http://draft-store:8091/runs', { method:'POST', headers:{Authorization:'Bearer synthetic-local-access'}, body:' '.repeat(10001) }));
  expect(response.status).toBe(413);
});

test('invalid locales stop the draft and an identical settled receipt is idempotent', async () => {
  const { request, runId } = await prepared();
  const task = (await request('/work/claim', context())).body.task;
  const invalid = plan(); delete (invalid.manifest.collection.title as Partial<typeof invalid.manifest.collection.title>).ru;
  const receipt = { status:200, body:{choices:[{message:{content:JSON.stringify(invalid)}}],usage:{prompt_tokens:500,completion_tokens:1500}}, context:context(39.65,[{cursor_event_id:'charged',model:'openai/gpt-5.4-nano',meter_source:'tier'}]) };
  expect((await request(`/attempts/${task.attemptId}/complete`, receipt)).body.errorCode).toBe('invalid-draft-manifest');
  expect((await request(`/attempts/${task.attemptId}/complete`, receipt)).body.spentPollen).toBe(.35);
  expect((await request(`/attempts/${task.attemptId}/complete`, {...receipt,status:503})).status).toBe(422);
  expect((await request(`/runs/${runId}/decision`,{action:'reject',version:1})).body.status).toBe('rejected');
  expect((await request('/work/claim',context())).body.task).toBeNull();
});


test('valid PNG bytes at the wrong dimensions stop without resizing', async () => {
  const {request,runId,advance}=await prepared();
  await advance();
  const small=await sharp({create:{width:16,height:9,channels:3,background:'black'}}).png().toBuffer();
  await advance({data:[{b64_json:small.toString('base64')}]});
  const blocked=(await request(`/runs/${runId}`)).body;
  expect(blocked.errorCode).toBe('invalid-png-dimensions');
  expect(blocked.spentPollen).toBe(.7);
  expect(Object.keys(blocked.assets)).toHaveLength(0);
});


test('provider preflight failures are visible and ageing usage does not block a dedicated key', async () => {
  const {request,runId,advance}=await prepared();
  expect((await request('/work/claim',{preflightError:'provider-preflight-http-401'})).status).toBe(422);
  expect((await request(`/runs/${runId}`)).body.errorCode).toBe('provider-preflight-http-401');
  await request(`/runs/${runId}/decision`,{action:'resume',version:1});
  await advance();
  const claimed=await request('/work/claim',context(39.65,[]));
  expect(claimed.body.task.kind).toBe('desktop');
});

test('cancellation records final overspend and cannot resume around the cap', async () => {
  const {request,runId}=await prepared();
  const task=(await request('/work/claim',context())).body.task;
  await request(`/runs/${runId}/decision`,{action:'cancel',version:1});
  const body={choices:[{message:{content:JSON.stringify(plan())}}],usage:{prompt_tokens:500,completion_tokens:1500}};
  const complete=await request(`/attempts/${task.attemptId}/complete`,{status:200,body,context:context(29,[{cursor_event_id:'charged',model:'openai/gpt-5.4-nano',meter_source:'tier'}])});
  expect(complete.body.status).toBe('cancelled');
  expect(complete.body.spentPollen).toBe(11);
  expect(complete.body.errorCode).toBe('actual-pollen-limit-exceeded');
  expect((await request(`/runs/${runId}/decision`,{action:'resume',version:1})).status).toBe(409);
});


test('legacy drafts keep their assets and text but require Japanese before approval and packaging', async () => {
  const { root, request } = await client();
  const created = (await request('/runs', { collectionId: '900026-test-light', theme: 'Quiet mountains' })).body;
  const store = new DraftStore(root);
  try {
    const run = store.get(created.runId);
    run.manifest = plan().manifest;
    for (const item of [run.manifest.collection, ...run.manifest.wallpapers]) {
      delete (item.title as Partial<typeof item.title>).ja;
      delete (item.description as Partial<typeof item.description>).ja;
    }
    run.assets = { '1-desktop': { hash: 'preserved', previewHash: 'preserved-preview', width: 3840, height: 2160 } };
    run.status = 'approved'; run.packageHash = 'legacy'; run.approval = { version: run.version, packageHash: 'legacy', approvedAt: '2026-10-01T00:00:00Z' };
    store.save(run);
    expect(JSON.stringify(reviewFields({ ...run, spentPollen: 0, reservedPollen: 0 }, 'http://localhost:5678'))).toContain('ja: Перевод отсутствует');
    const result = await request(`/runs/${run.runId}/decision`, { action: 'approve', version: run.version, packageHash: run.packageHash, contentChecked: true });
    expect(result.status).toBe(422); expect(result.body.error.code).toBe('draft-translations-required');
    const failure = await packageArchive(root, run).then(() => '', error => error.code);
    expect(failure).toBe('draft-translations-required');
    expect(store.get(run.runId)).toEqual(run);
    expect(run.assets['1-desktop']!.hash).toBe('preserved');
  } finally { store.database.close(); }
});

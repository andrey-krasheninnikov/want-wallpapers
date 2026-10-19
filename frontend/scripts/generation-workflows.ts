import { writeFileSync } from 'node:fs';

type Node = { id: string; name: string; type: string; typeVersion: number; position: number[]; parameters: Record<string, unknown>; credentials?: Record<string, unknown>; onError?: string; webhookId?: string };
type Workflow = { id: string; name: string; active: boolean; nodes: Node[]; connections: Record<string, { main: { node: string; type: string; index: number }[][] }>; settings: Record<string, unknown> };
const local = { httpHeaderAuth: { id: 'CollectionDraftStore', name: 'Collection draft store' } };
const provider = { httpHeaderAuth: { id: 'CollectionDraftProvider', name: 'Collection draft provider' } };
const form = { httpBasicAuth: { id: 'CollectionDraftOwner', name: 'Collection draft owner' } };
const formCss = `:root { color-scheme: dark; --color-background: #141414; --color-card-bg: #1C1C1C; --color-card-border: transparent; --color-header: #E8E8E8; --color-label: #E8E8E8; --color-input-text: #E8E8E8; --color-input-border: transparent; --color-focus-border: #5B4FFF; --color-submit-btn-bg: #5B4FFF; --color-submit-btn-text: #FFFFFF; --color-link: #E8E8E8; --color-error: #FF738D; --font-size-body: 16px; --font-size-label: 16px; --font-size-input: 16px; --font-size-paragraph: 16px; }
input:not([type=radio]):not([type=checkbox]), textarea, select { background: #252525; color: #E8E8E8; border-radius: 12px; min-height: 44px; }
button { min-height: 44px; border-radius: 999px; } input, textarea, select, button { accent-color: #5B4FFF; }
a { color: #E8E8E8; text-decoration: underline; } p { max-width: 65ch; line-height: 1.65; } img { max-width: 100%; height: auto; border-radius: 24px; } h2,h3 { overflow-wrap: anywhere; }
:focus-visible { outline: 2px solid #5B4FFF; outline-offset: 3px; }
@media (forced-colors: active) { :focus-visible { outline-color: Highlight; } }
@media (min-width: 768px) { img { max-width: 48%; } }`;

function workflow(id: string, name: string): Workflow { return { id, name, active: false, nodes: [], connections: {}, settings: {
  executionOrder: 'v1', saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 1800,
} }; }
function node(work: Workflow, name: string, type: string, version: number, parameters: Record<string, unknown>, credentials?: Record<string, unknown>) {
  const value: Node = { id: `node-${work.nodes.length}`, name, type: 'n8n-nodes-base.' + type, typeVersion: version, position: [work.nodes.length * 240, 0], parameters, ...(credentials ? { credentials } : {}) };
  work.nodes.push(value); return value;
}
function link(work: Workflow, from: string, to: string, output = 0) {
  const main = (work.connections[from] ??= { main: [] }).main;
  while (main.length <= output) main.push([]);
  main[output]!.push({ node: to, type: 'main', index: 0 });
}
function http(work: Workflow, name: string, url: string, credentials = local, body?: string, options: Record<string, unknown> = {}) {
  return node(work, name, 'httpRequest', 4.2, { method: body ? 'POST' : 'GET', url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    ...(body ? { sendBody: true, specifyBody: 'json', jsonBody: body } : {}), options: { timeout: 30000, ...options } }, credentials);
}
function condition(work: Workflow, name: string, expression: string) {
  return node(work, name, 'if', 2.2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: name, leftValue: expression, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
}
function code(work: Workflow, name: string, jsCode: string) { return node(work, name, 'code', 2, { jsCode }); }
function trigger(work: Workflow, name: string, path: string, fields: unknown[]) {
  const value = node(work, name, 'formTrigger', 2.6, { authentication: 'basicAuth', formTitle: name, formDescription: 'Приватный черновик коллекции. Публикация не выполняется.',
    formFields: { values: fields }, options: { path, appendAttribution: false, customCss: formCss, buttonLabel: 'Продолжить' } }, form);
  value.webhookId = path; return value;
}
function ending(work: Workflow, name: string, message: string) { return node(work, name, 'form', 2.5, { operation: 'completion', respondWith: 'text', completionTitle: name, completionMessage: message, options: { appendAttribution: false, customCss: formCss } }); }

export function generationWorkflows() {
  const start = workflow('CollectionDraftStart', 'Collection draft: start');
  trigger(start, 'Новая коллекция', 'collection-draft-start', [
    { fieldLabel: 'ID коллекции', fieldName: 'collectionId', fieldType: 'text', placeholder: '0006-something', requiredField: true },
    { fieldLabel: 'Тема', fieldName: 'theme', fieldType: 'textarea', requiredField: true },
  ]);
  http(start, 'Create draft', 'http://draft-store:8091/runs', local, '={{ JSON.stringify({ collectionId: $json.collectionId, theme: $json.theme }) }}');
  ending(start, 'Черновик сохранён', '={{ "Коллекция " + $json.collectionId + ". Выполнение продолжится через локальный polling. Для просмотра откройте /form/collection-draft-review и введите ID коллекции." }}');
  link(start, 'Новая коллекция', 'Create draft'); link(start, 'Create draft', 'Черновик сохранён');

  const review = workflow('CollectionDraftReview', 'Collection draft: review');
  trigger(review, 'Проверка коллекции', 'collection-draft-review', [{ fieldLabel: 'ID коллекции', fieldName: 'collectionId', fieldType: 'text', requiredField: true }]);
  http(review, 'Read draft', '={{ "http://draft-store:8091/collections/" + encodeURIComponent($json.collectionId) }}');
  node(review, 'Просмотр и решение', 'form', 2.5, { operation: 'page', defineForm: 'json', jsonOutput: '={{ JSON.stringify($json.formFields) }}',
    options: { formTitle: 'Просмотр коллекции', buttonLabel: 'Применить', customCss: formCss } });
  http(review, 'Record decision', '={{ "http://draft-store:8091/runs/" + $json.runId + "/decision" }}', local,
    '={{ JSON.stringify({ action: ({"Одобрить":"approve","Запросить правки":"revise","Отклонить":"reject","Отменить":"cancel","Возобновить":"resume"})[$json.action], version: Number($json.version), packageHash: $json.packageHash, contentChecked: Array.isArray($json.contentChecked) && $json.contentChecked.length === 1, variants: $json.variants ?? [], feedback: $json.feedback ?? "", texts: Array.isArray($json.texts) && $json.texts.length === 1 }) }}');
  ending(review, 'Решение сохранено', '={{ "Коллекция " + $json.collectionId + ", версия " + $json.version + ". Состояние: " + $json.status + ". Обновите просмотр для проверки результата." }}');
  link(review, 'Проверка коллекции', 'Read draft'); link(review, 'Read draft', 'Просмотр и решение'); link(review, 'Просмотр и решение', 'Record decision'); link(review, 'Record decision', 'Решение сохранено');

  const advance = workflow('CollectionDraftAdvance', 'Collection draft: advance');
  node(advance, 'Poll drafts', 'scheduleTrigger', 1.2, { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } });
  http(advance, 'Read active attempt', 'http://draft-store:8091/work/active');
  condition(advance, 'Can advance', '={{ $json.state === "idle" || ($json.state === "unknown" && $json.outcomeAvailable === true) }}');
  http(advance, 'Read key', 'https://gen.pollinations.ai/account/key', provider);
  http(advance, 'Read usage', 'https://gen.pollinations.ai/account/key/usage?format=json&limit=500&days=90', provider);
  http(advance, 'Read image model', 'https://gen.pollinations.ai/image/models?community=false', provider, undefined, { response: { response: { fullResponse: true, responseFormat: 'json' } } });
  http(advance, 'Read text model', 'https://gen.pollinations.ai/text/models?community=false', provider, undefined, { response: { response: { fullResponse: true, responseFormat: 'json' } } });
  code(advance, 'Provider context', `return [{ json: { key: $('Read key').first().json, usage: $('Read usage').first().json.usage,
imageModel: $('Read image model').first().json.body.find(item => item.name === 'openai/gpt-image-2'),
textModel: $('Read text model').first().json.body.find(item => item.name === 'openai/gpt-5.4-nano') } }];`);
  condition(advance, 'Reconcile saved receipt', '={{ $("Read active attempt").first().json.state === "unknown" }}');
  http(advance, 'Reconcile receipt', '={{ "http://draft-store:8091/attempts/" + $("Read active attempt").first().json.attemptId + "/reconcile" }}', local, '={{ JSON.stringify($json) }}');
  http(advance, 'Claim attempt', 'http://draft-store:8091/work/claim', local, '={{ JSON.stringify($json) }}');
  condition(advance, 'Has task', '={{ $json.task !== null }}');
  condition(advance, 'Is text', '={{ ["plan", "text"].includes($json.task.kind) }}');
  condition(advance, 'Has reference', '={{ typeof $json.task.referenceHash === "string" }}');
  const response = { response: { fullResponse: true, responseFormat: 'json', neverError: true } };
  const text = http(advance, 'Generate text', 'https://gen.pollinations.ai/v1/chat/completions', provider, '={{ JSON.stringify($json.task.body) }}', { response, timeout: 900000 });
  const image = http(advance, 'Generate desktop', 'https://gen.pollinations.ai/v1/images/generations', provider, '={{ JSON.stringify($json.task.body) }}', { response, timeout: 900000 });
  text.onError = image.onError = 'continueRegularOutput';
  http(advance, 'Read reference', '={{ "http://draft-store:8091/attempts/" + $("Claim attempt").first().json.task.attemptId + "/reference" }}', local, undefined,
    { response: { response: { responseFormat: 'file', outputPropertyName: 'reference' } } });
  const edit = node(advance, 'Generate referenced variant', 'httpRequest', 4.2, { method: 'POST', url: 'https://gen.pollinations.ai/v1/images/edits',
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: [ { parameterType: 'formBinaryData', name: 'image', inputDataFieldName: 'reference' },
      ...['model','prompt','n','size','quality','response_format'].map(name => ({ name, value: `={{ $("Claim attempt").first().json.task.body.${name} }}` })) ] }, options: { response, timeout: 900000 } }, provider);
  edit.onError = 'continueRegularOutput';
  code(advance, 'Keep receipt', `const raw = $input.first().json; const status = Number(raw.statusCode ?? 0); const task = $('Claim attempt').first().json.task;
let body = null;
if (status >= 200 && status < 300) {
  const value = raw.body;
  if (['plan','text'].includes(task.kind)) body = { choices: value?.choices?.map(item => ({ message: { content: item.message?.content } })), usage: value?.usage };
  else body = { data: value?.data?.map(item => ({ b64_json: item.b64_json })), usage: value?.usage };
}
const retry = raw.headers?.['retry-after']; const seconds = /^\\d+$/.test(String(retry)) ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000);
return [{ json: { attemptId: task.attemptId, status, body, ...(Number.isFinite(seconds) ? { retryAfter: seconds } : {}) } }];`);
  const afterKey = http(advance, 'Read key after', 'https://gen.pollinations.ai/account/key', provider);
  const afterUsage = http(advance, 'Read usage after', 'https://gen.pollinations.ai/account/key/usage?format=json&limit=500&days=90', provider);
  afterKey.onError = afterUsage.onError = 'continueRegularOutput';
  code(advance, 'Completion context', `return [{ json: { ...$('Keep receipt').first().json, context: { ...$('Provider context').first().json,
key: $('Read key after').first().json, usage: $('Read usage after').first().json.usage } } }];`);
  http(advance, 'Complete attempt', '={{ "http://draft-store:8091/attempts/" + $json.attemptId + "/complete" }}', local, '={{ JSON.stringify($json) }}');
  const sequence = ['Poll drafts','Read active attempt','Can advance','Read key','Read usage','Read image model','Read text model','Provider context','Reconcile saved receipt'];
  for (let index = 0; index < sequence.length - 1; index++) link(advance, sequence[index]!, sequence[index + 1]!);
  link(advance, 'Reconcile saved receipt', 'Reconcile receipt', 0); link(advance, 'Reconcile saved receipt', 'Claim attempt', 1);
  link(advance, 'Claim attempt', 'Has task'); link(advance, 'Has task', 'Is text'); link(advance, 'Is text', 'Generate text', 0); link(advance, 'Is text', 'Has reference', 1);
  link(advance, 'Has reference', 'Read reference', 0); link(advance, 'Read reference', 'Generate referenced variant'); link(advance, 'Has reference', 'Generate desktop', 1);
  for (const name of ['Generate text','Generate desktop','Generate referenced variant']) link(advance, name, 'Keep receipt');
  for (const [from,to] of [['Keep receipt','Read key after'],['Read key after','Read usage after'],['Read usage after','Completion context'],['Completion context','Complete attempt']]) link(advance, from!, to!);

  const media = workflow('CollectionDraftMedia', 'Collection draft: private media');
  const webhook = node(media, 'Read private media', 'webhook', 2, { httpMethod: 'GET', path: 'collection-draft-media', authentication: 'basicAuth', responseMode: 'responseNode', options: {} }, form);
  webhook.webhookId = 'collection-draft-media';
  code(media, 'Validate media request', `const query = $json.query;
if (!/^[0-9a-f-]{36}$/.test(query.runId) || !/^[1-9][0-9]*$/.test(query.version) || (query.package !== 'true' && !/^[1-5]-(desktop|mobile)$/.test(query.variant))) throw new Error('invalid-media-request');
return [{ json: { url: 'http://draft-store:8091/runs/' + query.runId + (query.package === 'true' ? '/package' : '/assets/' + query.variant) + '?version=' + query.version + '&preview=' + (query.preview === 'true') } }];`);
  http(media, 'Get private bytes', '={{ $json.url }}', local, undefined, { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } });
  node(media, 'Return private bytes', 'respondToWebhook', 1.4, { respondWith: 'binary', responseDataSource: 'set', inputFieldName: 'data', options: {
    responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } });
  link(media, 'Read private media', 'Validate media request'); link(media, 'Validate media request', 'Get private bytes'); link(media, 'Get private bytes', 'Return private bytes');
  return [start, review, advance, media];
}
if (import.meta.main) {
  if (![3, 6].includes(process.argv.length)) throw new Error('Usage: bun generation-workflows.ts /path/workflows.json [store-credential-id provider-credential-id owner-credential-id]');
  const workflows = generationWorkflows();
  if (process.argv.length === 6) {
    const ids = Object.fromEntries(['CollectionDraftStore', 'CollectionDraftProvider', 'CollectionDraftOwner'].map((name, index) => [name, process.argv[index + 3]!]));
    if (!Object.values(ids).every(id => /^[a-zA-Z0-9_-]{1,64}$/.test(id))) throw new Error('Invalid credential ID.');
    for (const workflow of workflows) for (const node of workflow.nodes) for (const credential of Object.values(node.credentials ?? {}) as { id: string }[]) if (ids[credential.id]) credential.id = ids[credential.id]!;
  }
  writeFileSync(process.argv[2]!, JSON.stringify(workflows, null, 2) + '\n', { mode: 0o600 });
}

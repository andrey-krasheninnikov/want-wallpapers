#!/usr/bin/env python3
"""Exercise draft forms and polling against a local provider in an isolated Docker network."""
import base64
import json
from html.parser import HTMLParser
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
IMAGE = 'docker.n8n.io/n8nio/n8n:2.41.7@sha256:bcef56dd44014e09774219536a3f8cb07f1b553fcba94044bd9fc0f21f8676a3'
PROVIDER = r"""
const http = require('http'), fs = require('fs');
const fixture = JSON.parse(fs.readFileSync('/fixtures/provider.json'));
let budget = 40, usage = [], images = 0, texts = 0, rejectPreflight = false;
http.createServer(async (request, response) => {
  const send = value => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); };
  if (request.url === '/reject-preflight') { rejectPreflight=true; return send({ready:true}); }
  if (request.url === '/account/key' && rejectPreflight) { rejectPreflight=false; response.statusCode=401; return send({error:'fixture-preflight'}); }
  if (request.url === '/stats') return send({ images, texts });
  if (request.headers.authorization !== 'Bearer synthetic-provider') { response.statusCode = 401; return send({ error: 'fixture-auth' }); }
  if (request.url === '/account/key') return send({ ...fixture.context.key, pollenBudget: budget });
  if (request.url.startsWith('/account/key/usage')) return send({ usage });
  if (request.url.startsWith('/image/models')) return send([fixture.context.imageModel]);
  if (request.url.startsWith('/text/models')) return send([fixture.context.textModel]);
  let chunks = []; for await (const chunk of request) chunks.push(chunk);
  const bytes = Buffer.concat(chunks), text = bytes.toString();
  let body = {};
  if (request.headers['content-type']?.startsWith('application/json')) body = JSON.parse(text);
  const isText = request.url === '/v1/chat/completions';
  const model = isText ? 'openai/gpt-5.4-nano' : 'openai/gpt-image-2';
  if (isText) {
    if (body.model !== model || body.max_completion_tokens !== 8192) { response.statusCode = 400; return send({ error: 'text-contract' }); }
    texts++;
  } else {
    const size = body.size ?? text.match(/name="size"\r\n\r\n([^\r]+)/)?.[1];
    if (!['3840x2160','2160x3840'].includes(size) || (size === '2160x3840' && !text.includes('name="image"'))) { response.statusCode = 400; return send({ error: 'image-contract' }); }
    images++;
  }
  budget = Math.round((budget - .35) * 1e9) / 1e9;
  usage.push({ cursor_event_id: 'event-' + usage.length, model, meter_source: 'tier' });
  if (isText) return send({ choices: [{ message: { content: JSON.stringify(fixture.plan) } }], usage: { prompt_tokens: 500, completion_tokens: 1500 } });
  const number = Math.ceil(images / 2), variant = images % 2 ? 'desktop' : 'mobile';
  send({ data: [{ b64_json: fs.readFileSync('/fixtures/' + number + '-' + variant + '.png').toString('base64') }], usage: { input_tokens: 500, output_tokens: 13342 } });
}).listen(8092, '0.0.0.0');
process.on('SIGTERM',()=>process.exit(0));
"""


def run(*arguments, environment=None, input=None):
    result = subprocess.run(arguments, cwd=ROOT, env=environment, input=input, capture_output=True, timeout=300)
    if result.returncode:
        detail = result.stderr.decode(errors='replace').strip()[-2000:] if 'scripts/n8n-state.py' in arguments else ''
        raise RuntimeError('Local fixture command failed: ' + ' '.join(arguments[:3]) + '. '+detail)
    return result.stdout


def main():
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    signal.signal(signal.SIGINT, lambda *_: sys.exit(130))
    suffix = secrets.token_hex(4)
    project = 'want-wallpapers-n8n-generation-' + suffix
    original, restored = project + '-data', project + '-recovery'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0)); port = listener.getsockname()[1]
    environment = {**os.environ, 'N8N_PORT': str(port), 'N8N_DATA_VOLUME': original}
    token = secrets.token_hex(32)
    owner_header = 'Basic ' + base64.b64encode(b'test-owner:synthetic-form-access').decode()
    with tempfile.TemporaryDirectory(prefix='wallpapers-generation-test-') as temporary:
        fixtures = Path(temporary); fixtures.chmod(0o755)
        run('bun', 'frontend/tests/generation-fixtures.ts', str(fixtures))
        workflow_file = fixtures / 'workflows.json'
        run('bun', 'frontend/scripts/generation-workflows.ts', str(workflow_file))
        workflows = json.loads(workflow_file.read_text())
        for workflow in workflows:
            for node in workflow['nodes']:
                if node['name'] == 'Poll drafts':
                    node.update(type='n8n-nodes-base.webhook', typeVersion=2, webhookId='generation-check-advance',
                        parameters={'httpMethod':'GET','path':'generation-check-advance','responseMode':'onReceived','options':{}})
                url = node['parameters'].get('url')
                if isinstance(url, str):
                    node['parameters']['url'] = url.replace('https://gen.pollinations.ai', 'http://provider:8092')
        workflow_file.write_text(json.dumps(workflows))
        credentials = [
            {'id':'CollectionDraftStore','name':'Collection draft store','type':'httpHeaderAuth','data':{'name':'Authorization','value':'Bearer ' + token}},
            {'id':'CollectionDraftProvider','name':'Collection draft provider','type':'httpHeaderAuth','data':{'name':'Authorization','value':'Bearer synthetic-provider'}},
            {'id':'CollectionDraftOwner','name':'Collection draft owner','type':'httpBasicAuth','data':{'user':'test-owner','password':'synthetic-form-access'}},
        ]
        (fixtures / 'credentials.json').write_text(json.dumps(credentials))
        (fixtures / 'provider.cjs').write_text(PROVIDER)
        override = fixtures / 'compose.json'
        override.write_text(json.dumps({'services': {
            'n8n': {'environment': {'N8N_LOG_LEVEL':'error','N8N_PYTHON_ENABLED':'false','NODES_INCLUDE':json.dumps(sorted({node['type'] for workflow in workflows for node in workflow['nodes']}))}},
            'provider': {'cpus':0.25,'mem_limit':'192m','image':IMAGE, 'entrypoint':['node','/fixtures/provider.cjs'], 'volumes':[str(fixtures)+':/fixtures:ro']},
            'draft-store': {'environment': {'DRAFT_FORM_ORIGIN': f'http://localhost:{port}'}}},
            'networks': {'default': {'internal':True}}}))
        files = ['-f',str(ROOT/'automation/n8n/compose.yaml'),'-f',str(ROOT/'automation/n8n/generation.compose.yaml'),'-f',str(override)]
        def compose(*arguments): return run('docker','compose','--project-name',project,*files,*arguments,environment=environment)
        def cli(command,*arguments):
            print('Fixture CLI: '+command,flush=True)
            return compose('run','--rm','--no-deps','-T','--volume',str(fixtures)+':/fixtures:ro','--entrypoint','n8n','n8n',command,*arguments)
        cookies = {}
        def request(path, body=None, headers=None):
            script = """
const fs=require('fs');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
let target='http://n8n:5678'+input.path, method=input.body===null?'GET':'POST';
let body; if(input.body!==null){body=new FormData();for(const [key,value] of Object.entries(input.body))for(const item of Array.isArray(value)?value:[value])body.append(key,item);}
for(let index=0;index<5;index++) {
  const response=await fetch(target,{method,body:method==='GET'?undefined:body,headers:{...input.headers,Cookie:Object.entries(input.cookies).map(([key,value])=>key+'='+value).join('; ')},redirect:'manual'});
  for(const value of response.headers.getSetCookie()) {const [name,content]=value.split(';')[0].split('=');input.cookies[name]=content;}
  if(response.status>=300&&response.status<400&&response.headers.has('location')) {target=new URL(response.headers.get('location'),target).href.replace(input.origin,'http://n8n:5678');method='GET';continue;}
  const bytes=Buffer.from(await response.arrayBuffer());
  let value; try{value=JSON.parse(bytes.toString());}catch{}
  if(value?.formWaitingUrl){target=value.formWaitingUrl.replace(input.origin,'http://n8n:5678').replace('http://localhost:5678','http://n8n:5678');method='GET';await new Promise(resolve=>setTimeout(resolve,100));continue;}
  await new Promise(resolve=>process.stdout.write(JSON.stringify({status:response.status,cookies:input.cookies,body:bytes.toString('base64')}),resolve));process.exit(0);
}
throw Error('Fixture redirect limit.');
"""
            payload={'path':path,'body':body,'headers':headers or {},'cookies':cookies,'origin':f'http://localhost:{port}'}
            result=json.loads(run('docker','compose','--project-name',project,*files,'exec','-T','provider','node','--input-type=module','-e',script.replace("const fs=require('fs');", "import fs from 'node:fs';"), environment=environment,input=json.dumps(payload).encode()))
            cookies.update(result['cookies'])
            if result['status']>=400: raise urllib.error.HTTPError(path,result['status'],'Fixture HTTP failure',{},None)
            return base64.b64decode(result['body'])
        def view():
            script = "fetch('http://127.0.0.1:8091/collections/900026-test-light',{headers:{Authorization:'Bearer '+require('fs').readFileSync('/state/access-token','utf8').trim()}}).then(r=>r.json()).then(v=>console.log(JSON.stringify({runId:v.runId,status:v.status,assets:Object.keys(v.assets??{}).length,imageAttempts:v.imageAttempts,textAttempts:v.textAttempts,errorCode:v.errorCode,activeAttempt:v.activeAttempt})))"
            return json.loads(compose('exec','-T','draft-store','bun','-e',script))
        def wait(predicate, limit=60):
            deadline = time.monotonic()+limit
            while time.monotonic()<deadline:
                try:
                    value=predicate()
                    if value: return value
                except (urllib.error.URLError, json.JSONDecodeError, RuntimeError): pass
                time.sleep(1)
            raise RuntimeError('Isolated workflow did not reach the expected state.')
        try:
            compose('build','draft-store')
            initialize = "const fs=require('fs');fs.mkdirSync('/home/node/.n8n/generation',{recursive:true,mode:0o700});fs.writeFileSync('/home/node/.n8n/generation/access-token',fs.readFileSync(0),{mode:0o600});"
            run('docker','compose','--project-name',project,*files,'run','--rm','--no-deps','-T','--entrypoint','node','n8n','-e',initialize,environment=environment,input=token.encode())
            cli('import:workflow','--input','/fixtures/workflows.json'); cli('import:credentials','--input','/fixtures/credentials.json')
            for workflow in workflows: cli('publish:workflow','--id',workflow['id'])
            compose('up','--detach','--wait','--wait-timeout','180')
            print('Isolated services healthy.',flush=True)
            wait(lambda: request('/healthz/readiness'))
            print('Isolated n8n readiness passed.', flush=True)
            try: request('/form/collection-draft-start'); raise RuntimeError('Owner form is unprotected.')
            except urllib.error.HTTPError as error:
                if error.code != 401: raise
            page = request('/form/collection-draft-start',headers={'Authorization':owner_header}).decode()
            class Fields(HTMLParser):
                def __init__(self): super().__init__(); self.hidden={}; self.names=[]
                def handle_starttag(self, tag, attributes):
                    values=dict(attributes)
                    if tag in ('input','textarea') and values.get('name'):
                        if values.get('type')=='hidden': self.hidden[values['name']]=values.get('value','')
                        elif values.get('type') not in ('submit','button'): self.names.append(values['name'])
            fields=Fields(); fields.feed(page)
            assert len(fields.names)==2, fields.names
            request('/form/collection-draft-start', {**fields.hidden,fields.names[0]:'900026-test-light',fields.names[1]:'Central blue abstraction'}, {'Authorization':owner_header})
            wait(lambda: view().get('runId'))
            print('Isolated forms and private store ready.', flush=True)
            compose('exec','-T','provider','node','-e',"fetch('http://127.0.0.1:8092/reject-preflight').then(r=>{if(!r.ok)process.exit(1)})")
            request('/webhook/generation-check-advance')
            failed=wait(lambda: (value if (value:=view()).get('errorCode')=='provider-preflight-http-401' else None))
            resume="fetch('http://127.0.0.1:8091/runs/"+failed['runId']+"/decision',{method:'POST',headers:{Authorization:'Bearer '+require('fs').readFileSync('/state/access-token','utf8').trim(),'Content-Type':'application/json'},body:JSON.stringify({action:'resume',version:1})}).then(r=>{if(!r.ok)process.exit(1)})"
            compose('exec','-T','draft-store','bun','-e',resume)
            print('Fixture preflight failure is visible and resumable.',flush=True)
            for index in range(11):
                request('/webhook/generation-check-advance')
                state = wait(lambda: (value if (value:=view()).get('textAttempts',0)+value.get('imageAttempts',0)==index+1 and value.get('activeAttempt') is None and value['status'] in ('generating','review','blocked') else None))
                print(f'Fixture progress: {index+1}/11, {state["status"]}',flush=True)
                if state['status']=='blocked': raise RuntimeError('Fixture draft stopped: '+str(state['errorCode']))
                if index==2:
                    compose('stop','--timeout','90','n8n','draft-store'); compose('up','--detach','--wait','--wait-timeout','180','n8n','draft-store')
            assert view()['status']=='review' and view()['assets']==10
            initial=request('/form/collection-draft-review',headers={'Authorization':owner_header}).decode()
            fields=Fields(); fields.feed(initial)
            page=request('/form/collection-draft-review', {**fields.hidden,fields.names[0]:'900026-test-light'}, {'Authorization':owner_header}).decode()
            missing=[value for value in ['Дизайн 1','Дизайн 5','zh-cn','pt-br','collection-draft-media'] if value not in page]
            assert not missing, 'Review response missing '+repr(missing)+': '+page[-2000:]
            media=request('/webhook/collection-draft-media?runId='+view()['runId']+'&version=1&variant=1-desktop&preview=true',headers={'Authorization':owner_header})
            assert media[:4]==b'RIFF' and media[8:12]==b'WEBP'
            archive=run(sys.executable,'-B','scripts/n8n-state.py','--project',project,'backup','--directory',str(fixtures/'backups'),environment=environment).decode().strip()
            run(sys.executable,'-B','scripts/n8n-state.py','--project',project,'restore',archive,'--volume',restored,environment=environment)
            compose('stop','--timeout','90','n8n','draft-store')
            environment['N8N_DATA_VOLUME']=restored
            compose('up','--detach','--wait','--wait-timeout','180','n8n','draft-store')
            assert view()['status']=='review' and view()['assets']==10
            request('/webhook/generation-check-advance'); time.sleep(2)
            stats=json.loads(compose('exec','-T','provider','node','-e',"fetch('http://127.0.0.1:8092/stats').then(r=>r.json()).then(v=>console.log(JSON.stringify(v)))"))
            assert stats=={'images':10,'texts':1},stats
            print('PASS: ten PNGs, four locales, private media, restart and snapshot recovery; provider calls 10 image + 1 text.', flush=True)
        finally:
            compose('down','--timeout','15','--remove-orphans')
            existing = run('docker','volume','ls','--format','{{.Name}}').decode().split()
            for volume in (original,restored):
                if volume in existing: run('docker','volume','rm',volume)
            remaining = run('docker','ps','-a','--filter','label=com.docker.compose.project='+project,'--format','{{.ID}}').decode().strip()
            assert not remaining, 'Fixture containers remain.'
            assert not set((original,restored)) & set(run('docker','volume','ls','--format','{{.Name}}').decode().split()), 'Fixture volumes remain.'
            print('Removed fixture containers, volumes, snapshots and temporary files.',flush=True)


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)

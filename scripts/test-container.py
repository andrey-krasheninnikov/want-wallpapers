#!/usr/bin/env python3
"""Exercise the production image against a separate PostgreSQL 18 TLS endpoint."""
import base64
import json
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request

repository = Path(__file__).resolve().parent.parent
postgres = os.environ.get('TEST_DB_CONTAINER', 'want-wallpapers-test-pg')
image = os.environ.get('TEST_APP_IMAGE', 'want-wallpapers:local')
root = Path(os.environ.get('TEST_SECRETS_DIR', f'/tmp/want-wallpapers-test-{os.getuid()}'))
nonce = secrets.token_hex(8)
network = f'wallpapers-egress-{nonce}'
proxy = f'wallpapers-proxy-{nonce}'
project = f'wallpapers-runtime-{nonce}'
work = root / f'runtime-{nonce}'
work.mkdir(mode=0o700)

def run(command, input=None, environment=None):
    result = subprocess.run(command, input=input, env=environment, text=True, capture_output=True)
    if result.returncode: raise RuntimeError(f'Runtime fixture command failed: {command[0]} {command[1]}')
    return result.stdout.strip()

def query(sql):
    return run(['docker', 'exec', '-i', postgres, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], sql)

container = json.loads(run(['docker', 'inspect', postgres]))[0]
if container['Config'].get('Labels', {}).get('foundation.want.wallpapers.test') != 'true':
    raise SystemExit('Runtime checks require the dedicated make test-db container.')
assert query('SHOW server_version_num').startswith('18')
inspection = subprocess.run(['docker', 'network', 'inspect', network], capture_output=True)
if inspection.returncode:
    run(['docker', 'network', 'create', '--label', 'foundation.want.wallpapers.test=true', network])
else:
    existing = json.loads(inspection.stdout)[0]
    if existing.get('Labels', {}).get('foundation.want.wallpapers.test') != 'true': raise SystemExit('Test network name is in use.')
if network not in container['NetworkSettings']['Networks']:
    run(['docker', 'network', 'connect', network, postgres])
run(['docker', 'network', 'create', '--internal', '--label', 'foundation.want.wallpapers.test=true', proxy])
run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'ca.key'), '-out', str(work / 'ca.crt'), '-subj', '/CN=Wallpapers test CA', '-days', '1'])
run(['openssl', 'req', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'server.key'), '-out', str(work / 'server.csr'), '-subj', f'/CN={postgres}'])
(work / 'extensions').write_text(f'subjectAltName=DNS:{postgres}\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n')
run(['openssl', 'x509', '-req', '-in', str(work / 'server.csr'), '-CA', str(work / 'ca.crt'), '-CAkey', str(work / 'ca.key'), '-CAcreateserial', '-out', str(work / 'server.crt'), '-days', '1', '-extfile', str(work / 'extensions')])
key_path, cert_path = f'/tmp/wallpapers-{nonce}.key', f'/tmp/wallpapers-{nonce}.crt'
run(['docker', 'cp', str(work / 'server.key'), f'{postgres}:{key_path}'])
run(['docker', 'cp', str(work / 'server.crt'), f'{postgres}:{cert_path}'])
run(['docker', 'exec', postgres, 'chown', 'postgres:postgres', key_path, cert_path])
run(['docker', 'exec', postgres, 'chmod', '600', key_path])
query(f"ALTER SYSTEM SET ssl='on'; ALTER SYSTEM SET ssl_cert_file='{cert_path}'; ALTER SYSTEM SET ssl_key_file='{key_path}'; SELECT pg_reload_conf();")
for _ in range(30):
    if query('SHOW ssl') == 'on': break
    time.sleep(1)
else: raise RuntimeError('Test PostgreSQL TLS did not become available.')
migration_password = secrets.token_hex(32)
app_password = secrets.token_hex(32)
role, migrator, database = f'wallpapers-app-{nonce}', f'wallpapers-migrator-{nonce}', f'wallpapers_runtime_{nonce}'
query(f'''CREATE ROLE "{role}" LOGIN PASSWORD '{app_password}'; CREATE ROLE "{migrator}" LOGIN PASSWORD '{migration_password}'; CREATE DATABASE {database} OWNER "{migrator}"; REVOKE ALL ON DATABASE {database} FROM PUBLIC; GRANT CONNECT ON DATABASE {database} TO "{role}";''')
admin_password = secrets.token_hex(24)
password_hash = run(['bun', str(repository / 'scripts/password-hash.ts')], admin_password)
values = {'database_url': f'postgresql://{role}:{app_password}@{postgres}:5432/{database}?sslmode=verify-full',
    'migration_database_url': f'postgresql://{migrator}:{migration_password}@{postgres}:5432/{database}?sslmode=verify-full',
    'admin_password_hash': password_hash, 'admin_totp_secret': base64.b32encode(secrets.token_bytes(20)).decode(), 'catalog_api_token': secrets.token_hex(32)}
for name, value in values.items():
    (work / name).write_text(value); (work / name).chmod(0o444)
(work / 'ca.crt').chmod(0o444)
(work / 'postgres_ca.pem').write_bytes((work / 'ca.crt').read_bytes()); (work / 'postgres_ca.pem').chmod(0o444)
# Synthetic credentials exercise SDK initialization without contacting Google.
(work / 'google_application_credentials.json').write_text(json.dumps({'type': 'service_account', 'project_id': 'want-wallpapers', 'private_key_id': 'test-only', 'private_key': (work / 'ca.key').read_text(), 'client_email': 'test-only@want-wallpapers.iam.gserviceaccount.com', 'token_uri': 'https://oauth2.googleapis.com/token'}))
(work / 'google_application_credentials.json').chmod(0o444)
common = ['docker', 'run', '--rm', '--network', network, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:size=32m',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '64',
    '--log-driver', 'local', '--log-opt', 'max-size=5m', '--log-opt', 'max-file=3',
    '-e', 'APP_ENV=production', '-e', 'PGSSLROOTCERT=/run/secrets/ca.crt']
def mounts(names):
    result = []
    for name in ['ca.crt'] + names:
        result += ['--mount', f'type=bind,src={work / name},dst=/run/secrets/{name},readonly']
    return result

override = work / 'compose-test.json'
override.write_text(json.dumps({'services': {'app': {'ports': ['127.0.0.1::8080']}}}))
profile_environment = os.environ.copy()
profile_environment.update(APP_IMAGE=image, SECRETS_DIR=str(work), TRAEFIK_NETWORK=proxy,
    EGRESS_NETWORK=network, COMPOSE_PROJECT_NAME=project, TRUSTED_PROXY_CIDRS='192.0.2.1/32',
    RECAPTCHA_PROJECT_ID='want-wallpapers', PUBLIC_RECAPTCHA_SITE_KEY='test-web-site-key', ADMIN_USERNAME='admin')
compose = ['docker', 'compose', '--env-file', '/dev/null', '-p', project, '-f',
    str(repository / 'deploy/compose.yaml'), '-f', str(override), '--profile', 'operations']
run(compose + ['config', '--quiet'], environment=profile_environment)
run(['make', 'migrate', 'DEPLOY_ENV_FILE=/dev/null'], environment=profile_environment)
psql = ['docker', 'exec', '-i', postgres, 'psql', '-X', '-U', 'postgres', '-d', database,
    '-v', 'ON_ERROR_STOP=1', '-v', f'runtime_role={role}', '-v', f'migrator_role={migrator}']
grants = (repository / 'deploy/runtime-grants.sql').read_text()
verification = (repository / 'deploy/verify-runtime-grants.sql').read_text()
for _ in range(2):
    run(psql, grants)
    run(psql, verification)
# A future automatic grant must be detected before it can expose a new table.
run(psql, f'ALTER DEFAULT PRIVILEGES FOR ROLE "{migrator}" GRANT SELECT ON TABLES TO "{role}";')
unsafe = subprocess.run(psql, input=verification, capture_output=True, text=True)
assert unsafe.returncode != 0, 'Broad default privileges must fail verification.'
# Reproduce the two reciprocal public defaults reported on the production database.
run(psql, 'ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime_role"; ALTER DEFAULT PRIVILEGES FOR ROLE :"runtime_role" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO :"migrator_role";')
run(psql, f'GRANT TEMPORARY ON DATABASE {database} TO "{role}"; GRANT SELECT, UPDATE ON public.audit_log_id_seq TO "{role}"; REVOKE USAGE ON public.audit_log_id_seq FROM "{role}";')
hardening = (repository / 'deploy/runtime-hardening.sql').read_text()
# Reviewed remediation clears known excessive ACLs, never ownership or memberships.
run(psql, f'GRANT ALL ON public.audit_log, public._sqlx_migrations TO "{role}";')
for _ in range(2):
    run(psql, hardening)
    run(psql, grants)
    run(psql, verification)
# CREATE in another schema must fail even when public is locked down.
run(psql, f'CREATE SCHEMA profile_extra; GRANT CREATE ON SCHEMA profile_extra TO "{role}";')
unsafe = subprocess.run(psql, input=verification, capture_output=True, text=True)
assert unsafe.returncode != 0, 'Runtime CREATE outside public must fail verification.'
run(psql, f'REVOKE CREATE ON SCHEMA profile_extra FROM "{role}";')
run(psql, verification)
# Exercise permissions as runtime, not merely catalog metadata.
runtime_psql = psql + ['-v', f'checked_role={role}']
run(runtime_psql, 'SET ROLE :"checked_role"; BEGIN; INSERT INTO public.audit_log(action,target,actor) VALUES (\'permission-test\',\'fixture\',\'admin\'); SELECT count(*) FROM public.collections; ROLLBACK;')
for forbidden in ['CREATE TABLE public.forbidden(id int)', 'SELECT * FROM public._sqlx_migrations',
    'SELECT version FROM public._sqlx_migrations', 'UPDATE public.audit_log SET action=action',
    'DELETE FROM public.audit_log', 'TRUNCATE public.audit_log']:
    denied = subprocess.run(runtime_psql, input='SET ROLE :"checked_role"; ' + forbidden + ';', capture_output=True, text=True)
    assert denied.returncode != 0, 'Runtime accepted a forbidden database operation.'
name = f'{project}-app-1'
run(compose + ['up', '-d', '--wait', '--no-deps', 'app'], environment=profile_environment)

try:
    running = json.loads(run(['docker', 'inspect', name]))[0]
    assert running['HostConfig']['NanoCpus'] == 1000000000
    assert running['HostConfig']['Memory'] == 512 * 1024 ** 2
    assert running['HostConfig']['MemorySwap'] == running['HostConfig']['Memory']
    assert running['Config']['User'] == '10001:10001' and running['HostConfig']['ReadonlyRootfs']
    assert set(running['NetworkSettings']['Networks']) == {proxy, network}
    assert 'wallpapers' in running['NetworkSettings']['Networks'][proxy]['Aliases']
    assert 'wallpapers' not in running['NetworkSettings']['Networks'][network]['Aliases']
    assert running['NetworkSettings']['Networks'][network]['GwPriority'] == 1
    assert json.loads(run(['docker', 'network', 'inspect', proxy]))[0]['Internal']
    assert not json.loads(run(['docker', 'network', 'inspect', network]))[0]['Internal']
    mounted = {mount['Destination'] for mount in running['Mounts']}
    assert '/run/secrets/migration_database_url' not in mounted and '/var/run/docker.sock' not in mounted
    for state in ['running', 'paused']:
        if state == 'paused': run(['docker', 'pause', name])
        try:
            refused = subprocess.run(['make', 'migrate', 'DEPLOY_ENV_FILE=/dev/null'], env=profile_environment, capture_output=True, text=True)
            assert refused.returncode != 0 and 'Stop app' in refused.stdout, f'Migrations must refuse a {state} app.'
        finally:
            if state == 'paused': run(['docker', 'unpause', name])
    port = running['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort']
    origin = f'http://127.0.0.1:{port}'
    for _ in range(30):
        try:
            with urllib.request.urlopen(origin + '/health/ready') as response:
                if response.status == 200: break
        except (OSError, urllib.error.URLError): time.sleep(1)
    else: raise RuntimeError('Production image did not become ready.')
    initial = json.loads((repository / 'backend/data/catalog.json').read_text())
    expected = json.loads((repository / 'frontend/src/data/catalog-live.json').read_text())
    with urllib.request.urlopen(origin + '/api/v1/catalog') as response:
        assert json.load(response) == initial, 'Initial migrations changed.'
    for collection in expected['collections']:
        manifest = {'collection': collection, 'wallpapers': [item for item in expected['wallpapers'] if item['collectionId'] == collection['id']]}
        for attempt in range(2):
            request = urllib.request.Request(origin + '/api/v1/admin/catalog/import', data=json.dumps(manifest).encode(), headers={'Authorization': 'Bearer ' + values['catalog_api_token'], 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request) as response:
                result = json.load(response)['result']
                assert result in ['created', 'unchanged'] if attempt == 0 else result == 'unchanged'
    with urllib.request.urlopen(origin + '/api/v1/catalog') as response:
        assert json.load(response) == expected, 'Runtime catalogue differs from the build snapshot.'
    print(f"Verified catalogue import/readback and exact-repeat no-op: {len(expected['collections'])} collections and {len(expected['wallpapers'])} wallpapers.")
    with urllib.request.urlopen(origin + '/admin/login/') as response:
        assert 'noindex' in response.headers['X-Robots-Tag']
        assert "'unsafe-inline'" not in response.headers['Content-Security-Policy'].split('style-src')[0]
        assert response.headers['Cache-Control'] == 'no-store'
    request = urllib.request.Request(origin + '/api/v1/session', method='POST', headers={'Origin': 'https://wallpapers.want.foundation'})
    with urllib.request.urlopen(request) as response:
        cookie = response.headers['Set-Cookie']; assert all(value in cookie for value in ['__Host-want-visitor=', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'])
    with urllib.request.urlopen(origin + '/api/v1/recaptcha/config') as response:
        assert json.load(response) == {'enabled': True, 'siteKey': 'test-web-site-key'}
        assert response.headers['Cache-Control'] == 'no-store'
    request = urllib.request.Request(origin + '/api/v1/admin/login', data=json.dumps({'username': 'admin', 'password': admin_password, 'code': '123456'}).encode(), headers={'Origin': 'https://wallpapers.want.foundation', 'Content-Type': 'application/json'})
    try: urllib.request.urlopen(request); raise AssertionError('Login bypassed reCAPTCHA.')
    except urllib.error.HTTPError as error:
        assert error.code == 400 and json.load(error)['error']['code'] == 'recaptcha-required'
        assert error.headers.get('Set-Cookie') is None
    # Seed only this isolated fixture; successful login is covered by the SDK-stub API tests.
    admin_token = secrets.token_hex(32)
    session = {'csrf': secrets.token_hex(32)}
    fingerprint = hashlib.sha256(f"{values['admin_password_hash']}\0{values['admin_totp_secret']}\0admin".encode()).hexdigest()
    run(['docker', 'exec', '-i', postgres, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], f"INSERT INTO sessions(token_hash,role,csrf,credential_fingerprint,expires_at) VALUES('{hashlib.sha256(admin_token.encode()).hexdigest()}','admin','{session['csrf']}','{fingerprint}',now()+interval '8 hours');")
    admin_cookie = '__Host-want-admin=' + admin_token
    request = urllib.request.Request(origin + '/api/v1/admin/session', headers={'Cookie': admin_cookie})
    with urllib.request.urlopen(request) as response: assert json.load(response)['username'] == 'admin'
    request = urllib.request.Request(origin + '/api/v1/admin/logout', method='POST', headers={'Origin': 'https://wallpapers.want.foundation', 'Cookie': admin_cookie, 'X-CSRF-Token': session['csrf']})
    with urllib.request.urlopen(request) as response: assert response.headers['Set-Cookie'].startswith('__Host-want-admin=;') and 'Max-Age=0' in response.headers['Set-Cookie']
    request = urllib.request.Request(origin + '/api/v1/admin/session', headers={'Cookie': admin_cookie})
    try: urllib.request.urlopen(request); raise AssertionError('Logged-out session is still authorized.')
    except urllib.error.HTTPError as error: assert error.code == 401
    request = urllib.request.Request(origin + '/api/v1/admin/moderation/feedback', headers={'Authorization': 'Bearer ' + values['catalog_api_token']})
    try: urllib.request.urlopen(request); raise AssertionError('Catalog token reached moderation.')
    except urllib.error.HTTPError as error: assert error.code == 403
    print('Production image passed: PostgreSQL 18 verify-full TLS, least-privilege runtime, catalog, private headers, visitor cookie, seeded admin session/logout, required reCAPTCHA and token scope.')
finally:
    # Stop only the exact task-created container; never delete databases or other containers.
    run(['docker', 'stop', name])
# Wrong hostname must fail before migration writes.
ip = json.loads(run(['docker', 'inspect', postgres]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
(work / 'invalid_database_url').write_text(values['migration_database_url'].replace(f'@{postgres}:', f'@{ip}:')); (work / 'invalid_database_url').chmod(0o444)
result = subprocess.run(common + mounts(['invalid_database_url']) + ['-e', 'DATABASE_URL_FILE=/run/secrets/invalid_database_url', image, 'migrate'], capture_output=True)
assert result.returncode != 0, 'TLS hostname mismatch must fail.'
print('TLS certificate hostname mismatch rejected. Test databases preserved.')

# Production never allows the development opt-out or missing public configuration.
for name, value, reason in [('RECAPTCHA_ENABLED', 'false', 'Production requires reCAPTCHA'), ('PUBLIC_RECAPTCHA_SITE_KEY', '', 'PUBLIC_RECAPTCHA_SITE_KEY is required'), ('RECAPTCHA_MIN_SCORE', 'NaN', 'RECAPTCHA_MIN_SCORE must be between 0 and 1'), ('GOOGLE_APPLICATION_CREDENTIALS', '/missing.json', 'Google credentials file is required')]:
    invalid = common + mounts(['database_url', 'admin_password_hash', 'admin_totp_secret', 'catalog_api_token', 'google_application_credentials.json']) + ['-e', 'DATABASE_URL_FILE=/run/secrets/database_url', '-e', 'ADMIN_PASSWORD_HASH_FILE=/run/secrets/admin_password_hash', '-e', 'ADMIN_TOTP_SECRET_FILE=/run/secrets/admin_totp_secret', '-e', 'CATALOG_API_TOKEN_FILE=/run/secrets/catalog_api_token', '-e', 'RECAPTCHA_PROJECT_ID=want-wallpapers', '-e', 'PUBLIC_RECAPTCHA_SITE_KEY=test-web-site-key', '-e', 'GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google_application_credentials.json', '-e', f'{name}={value}', image]
    result = subprocess.run(invalid, capture_output=True, timeout=30)
    assert result.returncode != 0 and reason in result.stderr.decode(), 'Production accepted invalid security configuration.'
print('Production reCAPTCHA opt-out, missing key/credentials and non-finite score rejected.')

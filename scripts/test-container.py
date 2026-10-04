#!/usr/bin/env python3
"""Exercise the production image against a separate PostgreSQL 18 TLS endpoint."""
import base64
import json
import hashlib
import hmac
import struct
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request

repository = Path(__file__).resolve().parent.parent
postgres = os.environ.get('TEST_DB_CONTAINER', 'want-wallpapers-test-pg')
image = os.environ.get('TEST_APP_IMAGE', 'want-wallpapers:local')
network = 'want-wallpapers-runtime-test'
root = Path(os.environ.get('TEST_SECRETS_DIR', f'/tmp/want-wallpapers-test-{os.getuid()}'))
nonce = secrets.token_hex(8)
work = root / f'runtime-{nonce}'
work.mkdir(mode=0o700)

def run(command, input=None):
    result = subprocess.run(command, input=input, text=True, capture_output=True)
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
owner_password = (root / 'postgres_password').read_text().strip()
app_password = secrets.token_hex(32)
role, database = f'wallpapers_app_{nonce}', f'wallpapers_runtime_{nonce}'
query(f"CREATE ROLE {role} LOGIN PASSWORD '{app_password}'; CREATE DATABASE {database}; REVOKE ALL ON DATABASE {database} FROM PUBLIC; GRANT CONNECT ON DATABASE {database} TO {role};")
admin_password = secrets.token_hex(24)
password_hash = run(['bun', str(repository / 'scripts/password-hash.ts')], admin_password)
values = {'database_url': f'postgresql://{role}:{app_password}@{postgres}:5432/{database}?sslmode=verify-full',
    'migration_database_url': f'postgresql://postgres:{owner_password}@{postgres}:5432/{database}?sslmode=verify-full',
    'admin_password_hash': password_hash, 'admin_totp_secret': base64.b32encode(secrets.token_bytes(20)).decode(), 'catalog_api_token': secrets.token_hex(32)}
for name, value in values.items():
    (work / name).write_text(value); (work / name).chmod(0o444)
(work / 'ca.crt').chmod(0o444)
common = ['docker', 'run', '--rm', '--network', network, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:size=32m',
    '-e', 'APP_ENV=production', '-e', 'PGSSLROOTCERT=/run/secrets/ca.crt']
def mounts(names):
    result = []
    for name in ['ca.crt'] + names:
        result += ['--mount', f'type=bind,src={work / name},dst=/run/secrets/{name},readonly']
    return result

run(common + mounts(['migration_database_url']) + ['-e', 'DATABASE_URL_FILE=/run/secrets/migration_database_url', image, 'migrate'])
grants = (repository / 'deploy/runtime-grants.sql').read_text().replace('wallpapers_app', role)
run(['docker', 'exec', '-i', postgres, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], grants)
privileges = run(['docker', 'exec', '-i', postgres, 'psql', '-U', 'postgres', '-d', database, '-At'], f"SELECT has_database_privilege('{role}',current_database(),'CREATE'),has_schema_privilege('{role}','public','CREATE'),has_table_privilege('{role}','_sqlx_migrations','INSERT');")
assert privileges == 'f|f|f', 'Runtime must not have DDL or migration-history write privileges.'
name = f'wallpapers-runtime-{nonce}'
arguments = common[:2] + ['-d', '--name', name, '-p', '127.0.0.1::8080'] + common[2:]
arguments += mounts(['database_url', 'admin_password_hash', 'admin_totp_secret', 'catalog_api_token'])
arguments += ['-e', 'DATABASE_URL_FILE=/run/secrets/database_url', '-e', 'ADMIN_PASSWORD_HASH_FILE=/run/secrets/admin_password_hash', '-e', 'ADMIN_TOTP_SECRET_FILE=/run/secrets/admin_totp_secret', '-e', 'CATALOG_API_TOKEN_FILE=/run/secrets/catalog_api_token', image]
run(arguments)
try:
    port = json.loads(run(['docker', 'inspect', name]))[0]['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort']
    origin = f'http://127.0.0.1:{port}'
    for _ in range(30):
        try:
            with urllib.request.urlopen(origin + '/health/ready') as response:
                if response.status == 200: break
        except (OSError, urllib.error.URLError): time.sleep(1)
    else: raise RuntimeError('Production image did not become ready.')
    with urllib.request.urlopen(origin + '/api/v1/catalog') as response:
        snapshot = json.load(response); assert len(snapshot['collections']) == 3 and len(snapshot['wallpapers']) == 25
    with urllib.request.urlopen(origin + '/admin/login/') as response:
        assert 'noindex' in response.headers['X-Robots-Tag']
        assert "'unsafe-inline'" not in response.headers['Content-Security-Policy'].split('style-src')[0]
        assert response.headers['Cache-Control'] == 'no-store'
    request = urllib.request.Request(origin + '/api/v1/session', method='POST', headers={'Origin': 'https://wallpapers.want.foundation'})
    with urllib.request.urlopen(request) as response:
        cookie = response.headers['Set-Cookie']; assert all(value in cookie for value in ['__Host-want-visitor=', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'])
    counter = struct.pack('>Q', int(time.time()) // 30)
    digest = hmac.new(base64.b32decode(values['admin_totp_secret']), counter, hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = str((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000).zfill(6)
    request = urllib.request.Request(origin + '/api/v1/admin/login', data=json.dumps({'username': 'admin', 'password': admin_password, 'code': code}).encode(), headers={'Origin': 'https://wallpapers.want.foundation', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request) as response:
        cookie = response.headers['Set-Cookie']; session = json.load(response)
        assert cookie.startswith('__Host-want-admin=') and 'Domain=' not in cookie
    admin_cookie = cookie.split(';', 1)[0]
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
    print('Production image passed: PostgreSQL 18 verify-full TLS, least-privilege runtime, catalog, private headers, secure cookies and token scope.')
finally:
    # Remove only the exact task-created container; never delete databases or other containers.
    run(['docker', 'stop', name])
# Wrong hostname must fail before migration writes.
ip = json.loads(run(['docker', 'inspect', postgres]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
(work / 'invalid_database_url').write_text(values['migration_database_url'].replace(f'@{postgres}:', f'@{ip}:')); (work / 'invalid_database_url').chmod(0o444)
result = subprocess.run(common + mounts(['invalid_database_url']) + ['-e', 'DATABASE_URL_FILE=/run/secrets/invalid_database_url', image, 'migrate'], capture_output=True)
assert result.returncode != 0, 'TLS hostname mismatch must fail.'
print('TLS certificate hostname mismatch rejected. Test databases preserved.')

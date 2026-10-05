#!/usr/bin/env python3
"""Check the deployment contract through Compose without loading real secrets."""
import json
import os
from pathlib import Path
import subprocess

repository = Path(__file__).resolve().parent.parent
environment = os.environ.copy()
environment.update(APP_IMAGE='want-wallpapers:profile-test', SECRETS_DIR='/unused/profile-secrets',
    TRAEFIK_NETWORK='profile-proxy', EGRESS_NETWORK='profile-egress',
    TRUSTED_PROXY_CIDRS='192.0.2.1/32', RECAPTCHA_PROJECT_ID='profile-test',
    PUBLIC_RECAPTCHA_SITE_KEY='profile-test-key')
result = subprocess.run(['docker', 'compose', '--env-file', '/dev/null', '-f',
    str(repository / 'deploy/compose.yaml'), '--profile', 'operations', 'config', '--format', 'json'],
    env=environment, capture_output=True, text=True)
if result.returncode:
    raise SystemExit('Compose deployment profile is invalid.')
profile = json.loads(result.stdout)
app, migrate = (profile['services'][name] for name in ['app', 'migrate'])
for service in [app, migrate]:
    assert 0 < float(service['cpus']) <= 1, 'Deployment must fit one CPU.'
    assert service['user'] == '10001:10001' and service['read_only']
    assert service['cap_drop'] == ['ALL'] and service['security_opt'] == ['no-new-privileges:true']
    assert service['pids_limit'] == 64 and not service.get('ports') and not service.get('volumes')
    assert service['memswap_limit'] == service['mem_limit'], 'Container swap must remain disabled.'
assert int(app['mem_limit']) == 512 * 1024 ** 2 and int(migrate['mem_limit']) == 128 * 1024 ** 2
assert set(app['networks']) == {'traefik', 'egress'}
assert app['networks']['traefik']['aliases'] == ['wallpapers']
assert set(migrate['networks']) == {'egress'} and not (migrate['networks']['egress'] or {}).get('aliases')
assert all(profile['networks'][name]['external'] for name in ['traefik', 'egress'])
assert {secret['source'] for secret in app['secrets']} == {
    'database_url', 'postgres_ca', 'admin_password_hash', 'admin_totp_secret',
    'catalog_api_token', 'google_application_credentials'}
assert {secret['source'] for secret in migrate['secrets']} == {'migration_database_url', 'postgres_ca'}
assert set(migrate['environment']) == {'APP_ENV', 'DATABASE_URL_FILE', 'PGSSLROOTCERT'}
assert app['environment']['RECAPTCHA_ENABLED'] == 'true'
print('Compose profile passed: one CPU, resource limits, isolated networks and secret mounts.')

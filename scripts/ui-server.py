#!/usr/bin/env python3
"""Run an isolated database and Rust server for browser tests."""
import base64
import os
from pathlib import Path
import secrets
import subprocess

repository = Path(__file__).resolve().parent.parent
secret_dir = Path(os.environ.get('TEST_SECRETS_DIR', f'/tmp/want-wallpapers-test-{os.getuid()}'))
environment = os.environ.copy()
admin_password = secrets.token_hex(24)
password_hash = subprocess.run(['bun', 'scripts/password-hash.ts'], input=admin_password, text=True, capture_output=True, check=True, cwd=repository).stdout.strip()
for name, value in {'ui_admin_password': admin_password, 'ui_admin_hash': password_hash,
    'ui_admin_totp': base64.b32encode(secrets.token_bytes(20)).decode(), 'ui_catalog_token': secrets.token_hex(32)}.items():
    (secret_dir / name).write_text(value); (secret_dir / name).chmod(0o600)
# Each run owns a new database; existing databases are never overwritten or removed.
database_name = 'wallpapers_ui_' + secrets.token_hex(8)
subprocess.run(['docker', 'exec', os.environ.get('TEST_DB_CONTAINER', 'want-wallpapers-test-pg'), 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', f'CREATE DATABASE {database_name}'], check=True, stdout=subprocess.DEVNULL)
database = (secret_dir / 'database_url').read_text().strip().replace('/wallpapers_test?', f'/{database_name}?')
(secret_dir / 'ui_database_url').write_text(database); (secret_dir / 'ui_database_url').chmod(0o600)
environment.update(APP_ENV='development', RECAPTCHA_ENABLED='false', DATABASE_URL_FILE=str(secret_dir / 'ui_database_url'), ADMIN_PASSWORD_HASH_FILE=str(secret_dir / 'ui_admin_hash'),
    ADMIN_TOTP_SECRET_FILE=str(secret_dir / 'ui_admin_totp'), CATALOG_API_TOKEN_FILE=str(secret_dir / 'ui_catalog_token'),
    ADMIN_USERNAME='admin', SITE_URL='http://127.0.0.1:4322', BIND_ADDR='127.0.0.1:4322', STATIC_DIR=str(repository / 'frontend/dist'))
environment.pop('DATABASE_URL', None)
subprocess.run(['cargo', 'run', '--locked', '-p', 'want-wallpapers-server', '--', 'migrate'], cwd=repository, env=environment, check=True)
os.chdir(repository)
os.execvpe('cargo', ['cargo', 'run', '--locked', '-p', 'want-wallpapers-server'], environment)

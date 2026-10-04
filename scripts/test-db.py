#!/usr/bin/env python3
"""Start a dedicated PostgreSQL 18 instance for development and tests."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

root = Path(os.environ.get('TEST_SECRETS_DIR', f'/tmp/want-wallpapers-test-{os.getuid()}'))
name = os.environ.get('TEST_DB_CONTAINER', 'want-wallpapers-test-pg')
port = os.environ.get('TEST_DB_PORT', '55432')
root.mkdir(mode=0o700, parents=True, exist_ok=True)
if root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
    raise SystemExit('Test secret directory must be owned by this user and have mode 0700.')
inspect = subprocess.run(['docker', 'inspect', name], capture_output=True)
if inspect.returncode == 0:
    container = json.loads(inspect.stdout)[0]
    if container['Config'].get('Labels', {}).get('foundation.want.wallpapers.test') != 'true':
        raise SystemExit('Container name is already in use. Choose TEST_DB_CONTAINER.')
    subprocess.run(['docker', 'start', name], check=True, stdout=subprocess.DEVNULL)
else:
    password = secrets.token_hex(32)
    (root / 'postgres_password').write_text(password); (root / 'postgres_password').chmod(0o600)
    (root / 'database_url').write_text(f'postgresql://postgres:{password}@127.0.0.1:{port}/wallpapers_test?sslmode=disable')
    (root / 'database_url').chmod(0o600)
    subprocess.run(['docker', 'run', '-d', '--name', name, '--label', 'foundation.want.wallpapers.test=true',
        '-p', f'127.0.0.1:{port}:5432', '-e', 'POSTGRES_DB=wallpapers_test', '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password',
        '--mount', f'type=bind,src={root / "postgres_password"},dst=/run/secrets/postgres_password,readonly', 'postgres:18'], check=True, stdout=subprocess.DEVNULL)
for _ in range(60):
    if subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres', '-d', 'wallpapers_test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0: break
    time.sleep(1)
else: raise SystemExit('PostgreSQL 18 did not become ready.')
print('PostgreSQL 18 ready on localhost. Test credentials stored outside the repository.')

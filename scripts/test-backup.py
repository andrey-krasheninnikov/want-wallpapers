#!/usr/bin/env python3
"""Exercise encryption and real PostgreSQL 18 restoration with isolated synthetic data."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from deployment import DeployError, require, run
spec = importlib.util.spec_from_file_location('worker', ROOT / 'scripts/backup-worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

name = 'wallpapers-backup-test-' + uuid.uuid4().hex
with tempfile.TemporaryDirectory(prefix='wallpapers-backup-test-') as directory:
    root = Path(directory)
    identity = root / 'identity'
    run(['age-keygen', '-o', str(identity)])
    identity.chmod(0o600)
    recipient = run(['age-keygen', '-y', str(identity)]).strip()
    run(['docker', 'run', '--detach', '--name', name, '--network', 'none', '--memory', '512m',
         '--cpus', '1', '--label', 'foundation.want.wallpapers.backup-test=' + name,
         '--tmpfs', '/var/lib/postgresql:size=384m,mode=0700,uid=999,gid=999',
         '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_DB=wallpapers_restore', worker.POSTGRES], timeout=180)
    try:
        import time
        for attempt in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise DeployError('fixture-database-unavailable')
        migrations = sorted((ROOT / 'backend/migrations').glob('*.sql'))
        setup = 'CREATE TABLE public._sqlx_migrations (version bigint PRIMARY KEY, checksum bytea NOT NULL, success boolean NOT NULL);\n'
        for migration in migrations:
            setup += migration.read_text() + '\n'
            version = int(migration.name.split('_')[0])
            checksum = hashlib.sha384(migration.read_bytes()).hexdigest()
            setup += f"INSERT INTO public._sqlx_migrations VALUES ({version},decode('{checksum}','hex'),true);\n"
        run(['docker', 'exec', '--interactive', name, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1',
             '-U', 'postgres', '-d', 'wallpapers_restore'], input=setup)
        expected = worker.restored_state(name)
        cipher = root / 'backup.dump.age'
        with cipher.open('wb') as encrypted:
            worker.pipeline(['docker', 'exec', name, 'pg_dump', '-U', 'postgres', '-d', 'wallpapers_restore', '-Fc'],
                            ['age', '-r', recipient], encrypted)
        require(not cipher.read_bytes().startswith(b'PGDMP'), 'backup-not-encrypted')
        restored = worker.restore(cipher, identity)
        require(restored == expected, 'restored-metadata-mismatch')
        require(len(restored['history']) == 2 and restored['history'][0]['version'] == 202610040001
                and restored['history'][1]['version'] == 202610040002, 'restored-migration-history-mismatch')
        corrupt = root / 'corrupt.age'
        body = bytearray(cipher.read_bytes())
        body[-1] ^= 1
        corrupt.write_bytes(body)
        try:
            worker.restore(corrupt, identity)
        except DeployError:
            pass
        else:
            raise DeployError('corrupted-backup-accepted')
        print(json.dumps({'status': 'success', 'postgresMajor': 18, 'encrypted': True,
                          'schemaHistoryCatalogVerified': True, 'corruptionRejected': True}))
    finally:
        metadata = json.loads(run(['docker', 'inspect', name]))[0]
        require(metadata['Config']['Labels'].get('foundation.want.wallpapers.backup-test') == name,
                'fixture-container-identity-changed')
        run(['docker', 'rm', '--force', name])

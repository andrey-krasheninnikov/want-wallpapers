#!/usr/bin/env python3
"""Prepare encrypted deployment-bound backups and restore them outside the VPS."""
import argparse
import configparser
import hashlib
import json
import os
from pathlib import Path
import select
import re
import subprocess
import sys
import tempfile
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import (DeployError, PREFIX, Store, matches, private_file, require, run,
                        verify_receipt)

ROOT = Path(__file__).resolve().parent.parent
POSTGRES = 'postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336'
ENDPOINT = 'https://s3.twcstorage.ru'
BUCKET = 'want-foundation'


def configuration(path):
    path = private_file(path)
    value = json.loads(path.read_text())
    required = {'sshConfig', 'pgServiceFile', 'pgPassFile', 'postgresCa', 'ageIdentity', 'ageRecipient', 'awsProfile'}
    require(set(value) == required, 'invalid-worker-config')
    for key in required - {'ageRecipient', 'awsProfile'}:
        value[key] = str(private_file(Path(value[key]).expanduser()))
    require(matches(r'age1[0-9a-z]{58}', value['ageRecipient'])
            and matches(r'[A-Za-z0-9_-]{1,80}', value['awsProfile'])
            and value['awsProfile'] != 'timeweb-admin', 'worker-credential-isolation')
    require(run(['age-keygen', '-y', value['ageIdentity']]).strip() == value['ageRecipient'],
            'encryption-key-mismatch')
    service = configparser.ConfigParser(interpolation=None)
    service.read(value['pgServiceFile'])
    require(service.sections() == ['wallpapers-backup'], 'invalid-backup-service')
    settings = dict(service['wallpapers-backup'])
    require(set(settings) <= {'host', 'port', 'dbname', 'user', 'sslmode', 'sslrootcert', 'connect_timeout'}
            and settings.get('dbname') == 'wallpapers' and settings.get('user') == 'wallpapers-backup'
            and settings.get('sslmode') == 'verify-full'
            and settings.get('sslrootcert') == '/run/secrets/postgres_ca'
            and settings.get('host') and settings.get('port', '5432').isdigit(), 'invalid-backup-service')
    identity = json.dumps([settings['host'], settings.get('port', '5432'), 'wallpapers', 'verify-full'])
    identity += hashlib.sha256(Path(value['postgresCa']).read_bytes()).hexdigest()
    value['databaseId'] = hashlib.sha256(identity.encode()).hexdigest()
    value['directory'] = path.parent
    return value


def ssh(config, command, payload=None):
    return json.loads(run(['ssh', '-F', config['sshConfig'], '-T', '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=2', 'wallpapers-backup', command],
        input=json.dumps(payload) if payload is not None else None, timeout=60))


def client(config, executable):
    arguments = ['docker', 'run', '--rm', '--interactive', '--read-only', '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges:true', '--memory', '128m', '--cpus', '1', '--pids-limit', '64',
        '--user', str(os.getuid()) + ':' + str(os.getgid()), '--tmpfs', '/tmp:size=16m,mode=1777']
    for key, destination in [('pgServiceFile','pg_service'), ('pgPassFile','pgpass'), ('postgresCa','postgres_ca')]:
        arguments += ['--mount', 'type=bind,src=' + config[key] + ',dst=/run/secrets/' + destination + ',readonly']
    return [*arguments, '--env', 'PGSERVICE=wallpapers-backup', '--env', 'PGSERVICEFILE=/run/secrets/pg_service',
        '--env', 'PGPASSFILE=/run/secrets/pgpass', '--env', 'PGCONNECT_TIMEOUT=10',
        '--env', 'PGOPTIONS=-c statement_timeout=600000 -c timezone=UTC', '--entrypoint', executable, POSTGRES]


def line(process, buffer):
    deadline = time.monotonic() + 30
    while b'\n' not in buffer:
        remaining = deadline - time.monotonic()
        require(remaining > 0 and select.select([process.stdout], [], [], remaining)[0], 'snapshot-timeout')
        block = os.read(process.stdout.fileno(), 4096)
        require(block and len(buffer) + len(block) <= 131072, 'snapshot-failed')
        buffer.extend(block)
    value, _, rest = buffer.partition(b'\n')
    buffer[:] = rest
    return value.decode()


def pipeline(producer, consumer, output=subprocess.DEVNULL):
    first = subprocess.Popen(producer, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    second = None
    try:
        second = subprocess.Popen(consumer, stdin=first.stdout, stdout=output, stderr=subprocess.DEVNULL)
        first.stdout.close()
        require(second.wait(timeout=600) == 0 and first.wait(timeout=10) == 0, 'backup-pipeline-failed')
    finally:
        for process in (first, second):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def restored_state(container):
    sql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC';\n"
    sql += (ROOT / 'deploy/backup-state.sql').read_text() + '\nCOMMIT;'
    return json.loads(run(['docker', 'exec', '--interactive', container, 'psql', '-X', '-A', '-t', '-q',
        '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'wallpapers_restore'], input=sql))


def restore(ciphertext, identity):
    name = 'wallpapers-restore-' + uuid.uuid4().hex
    run(['docker', 'run', '--detach', '--name', name, '--network', 'none', '--memory', '512m',
         '--cpus', '1', '--pids-limit', '128', '--security-opt', 'no-new-privileges:true',
         '--label', 'foundation.want.wallpapers.restore=' + name,
         '--tmpfs', '/var/lib/postgresql:size=384m,mode=0700,uid=999,gid=999',
         '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_DB=wallpapers_restore', POSTGRES], timeout=180)
    try:
        for attempt in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres', '-d', 'wallpapers_restore'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise DeployError('restore-database-unavailable')
        pipeline(['age', '--decrypt', '--identity', str(identity), str(ciphertext)],
                 ['docker', 'exec', '--interactive', name, 'pg_restore', '--exit-on-error', '--single-transaction',
                  '--no-owner', '--no-acl', '-U', 'postgres', '-d', 'wallpapers_restore'])
        return restored_state(name)
    finally:
        metadata = json.loads(run(['docker', 'inspect', name]))[0]
        require(metadata['Config']['Labels'].get('foundation.want.wallpapers.restore') == name,
                'restore-container-identity-changed')
        run(['docker', 'rm', '--force', name])


def aws(config, *arguments):
    return ['aws', '--profile', config['awsProfile'], '--endpoint-url', ENDPOINT, '--no-cli-pager',
            '--region', 'ru-1', '--cli-connect-timeout', '10', '--cli-read-timeout', '60', 's3api', *arguments]


def existing_object(config, key):
    response = subprocess.run(aws(config, 'head-object', '--bucket', BUCKET, '--key', key),
                              capture_output=True, text=True, timeout=70)
    if response.returncode == 0:
        return json.loads(response.stdout)
    if '(404)' in response.stderr or '(NotFound)' in response.stderr or '(NoSuchKey)' in response.stderr:
        return None
    raise DeployError('backup-object-unavailable')


def prepare(config, request):
    require(matches(r'[0-9a-f]{32}', request.get('requestId')) and request.get('databaseId') == config['databaseId']
            and type(request.get('backupDeadline')) is int and time.time() < request['backupDeadline'],
            'invalid-backup-request')
    key = PREFIX + request['requestId'] + '.dump.age'
    ledger = Store(config['directory'] / 'state')
    with tempfile.TemporaryDirectory(prefix='backup-', dir=config['directory']) as directory:
        cipher = Path(directory) / 'snapshot.dump.age'
        original = existing_object(config, key)
        if original is None:
            process = subprocess.Popen(client(config, 'psql') + ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'],
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
            try:
                process.stdin.write(b"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC';\nSELECT pg_export_snapshot();\n")
                buffer = bytearray()
                snapshot = line(process, buffer)
                require(matches(r'[A-F0-9-]+', snapshot), 'invalid-snapshot')
                process.stdin.write((ROOT / 'deploy/backup-state.sql').read_bytes())
                source = json.loads(line(process, buffer))
                require(source == request['before'], 'backup-source-changed')
                descriptor = os.open(cipher, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                with os.fdopen(descriptor, 'wb') as encrypted:
                    pipeline(client(config, 'pg_dump') + ['--format=custom', '--snapshot=' + snapshot],
                             ['age', '--recipient', config['ageRecipient']], encrypted)
            finally:
                if process.poll() is None:
                    process.stdin.close()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.terminate()
                        process.wait(timeout=10)
            checksum = hashlib.sha256(cipher.read_bytes()).hexdigest()
            ledger.write({'requestId': request['requestId'], 'ciphertextSha256': checksum,
                          'createdAt': int(time.time())})
            run(aws(config, 'put-object', '--bucket', BUCKET, '--key', key, '--body', str(cipher),
                    '--acl', 'private', '--if-none-match', '*', '--metadata', json.dumps({'ciphertext-sha256': checksum})),
                timeout=180)
        else:
            saved = ledger.read(request['requestId'])
            checksum = saved['ciphertextSha256']
            require(matches(r'[0-9a-f]{64}', checksum)
                    and original.get('Metadata', {}).get('ciphertext-sha256') == checksum
                    and saved['createdAt'] >= request['backupDeadline'] - 1800, 'backup-object-metadata-mismatch')
        downloaded = Path(directory) / 'downloaded.dump.age'
        run(aws(config, 'get-object', '--bucket', BUCKET, '--key', key, str(downloaded)), timeout=180)
        downloaded.chmod(0o600)
        require(hashlib.sha256(downloaded.read_bytes()).hexdigest() == checksum, 'ciphertext-checksum-mismatch')
        restored = restore(downloaded, config['ageIdentity'])
        receipt = {**{key: request[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'databaseId')},
                   'verifiedAt': int(time.time()), 'ciphertextSha256': checksum, 'objectKey': key,
                   'restored': restored, 'status': 'verified'}
        verify_receipt(request, receipt)
        return receipt


def retention(config):
    from datetime import datetime, timezone
    listing = json.loads(run(aws(config, 'list-objects-v2', '--bucket', BUCKET, '--prefix', PREFIX)))
    # Refuse incomplete listings rather than guessing which backups may be deleted.
    require(not listing.get('IsTruncated'), 'retention-listing-incomplete')
    now = datetime.now(timezone.utc)
    for entry in listing.get('Contents', []):
        key = entry['Key']
        if not matches(re.escape(PREFIX) + r'[0-9a-f]{32}\.dump\.age', key):
            continue
        created = datetime.fromisoformat(entry['LastModified'].replace('Z', '+00:00'))
        if (now - created).total_seconds() > 30 * 86400:
            run(aws(config, 'delete-object', '--bucket', BUCKET, '--key', key))


def verify_backup_policy(policy):
    require(isinstance(policy, dict) and isinstance(policy.get('Statement'), list)
            and all(isinstance(entry, dict) for entry in policy['Statement']), 'backup-prefix-policy-not-verified')
    statements = policy['Statement']
    public = [entry for entry in statements if entry.get('Sid') == 'PublicReadGetObject_v1']
    require(len(public) == 1 and public[0].get('Principal') == {'AWS': '*'}
            and public[0].get('Effect') == 'Allow' and public[0].get('Action') == 's3:GetObject'
            and isinstance(public[0].get('NotResource'), list)
            and 'arn:aws:s3:::want-foundation/wallpapers-backups/*' in public[0]['NotResource'],
            'backup-prefix-policy-not-verified')
    media = {'Sid': 'PrizmaxisPublicProductionMedia', 'Effect': 'Allow', 'Principal': '*',
             'Action': 's3:GetObject', 'Resource': 'arn:aws:s3:::want-foundation/prizmaxis/production/media/*'}
    others = [entry for entry in statements if entry.get('Sid') != 'PublicReadGetObject_v1']
    require(others in ([], [media]), 'backup-prefix-policy-not-verified')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('once', 'serve'))
    parser.add_argument('--config', required=True)
    arguments = parser.parse_args()
    config = configuration(arguments.config)
    store = Store(config['directory'] / 'state')
    with store.lock('deployment', blocking=False):
        run(['docker', 'version', '--format', '{{.Server.Version}}'], timeout=15)
        run(['docker', 'pull', POSTGRES], timeout=300)
        policy = json.loads(json.loads(run(aws(config, 'get-bucket-policy', '--bucket', BUCKET)))['Policy'])
        verify_backup_policy(policy)
        retention(config)
        while True:
            request = ssh(config, 'backup-next')
            if request.get('pending') is not False:
                try:
                    receipt = prepare(config, request)
                except Exception:
                    ssh(config, 'backup-result ' + request['requestId'], {'requestId': request['requestId'], 'status': 'failed'})
                    raise DeployError('backup-verification-failed')
                try:
                    accepted = ssh(config, 'backup-result ' + request['requestId'], receipt)
                except Exception:
                    # Replaying this identical receipt only returns its stored acknowledgement.
                    accepted = ssh(config, 'backup-result ' + request['requestId'], receipt)
                require(accepted.get('accepted') is True, 'backup-receipt-not-accepted')
                print(json.dumps({'requestId': request['requestId'], 'status': 'verified'}), flush=True)
            if arguments.mode == 'once':
                return
            time.sleep(15)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, DeployError) else 'worker-failed'}))
        sys.exit(1)

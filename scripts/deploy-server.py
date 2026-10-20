#!/usr/bin/env python3
"""Root-owned fixed-profile deployment service and restricted request protocol."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import select
import shutil
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import (DeployError, IMAGE, Store, TERMINAL, atomic_bytes, database_environment,
                        image_matches, public_record, request_command, require, run,
                        update_image, verify_receipt)

ROOT = Path(__file__).resolve().parent.parent
DEPLOYMENT = Path('/opt/want/apps/wallpapers-v1.1.0')
ENV = DEPLOYMENT / 'deploy/.env'
COMPOSE = DEPLOYMENT / 'deploy/compose.yaml'
STATE = Path('/var/lib/want-deploy/wallpapers')
SECRETS = Path('/etc/want-wallpapers/secrets')
CONTAINER = 'want-wallpapers-app-1'
README = Path('/README.md')
ACTORS = {'ci': 'wallpapers-deploy', 'worker': 'wallpapers-backup'}
spec = importlib.util.spec_from_file_location('release', ROOT / 'scripts/ci-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def compose(*arguments, environment=None, timeout=60):
    return run(['/usr/bin/docker', 'compose', '--project-name', 'want-wallpapers', '--env-file',
                str(environment or ENV), '-f', str(COMPOSE), '-f', str(ROOT / 'deploy/migrate-override.yaml'),
                *arguments], timeout=timeout)


def inspect(kind, reference):
    return json.loads(run(['/usr/bin/docker', kind, 'inspect', reference]))[0]


def psql(environment, sql):
    return run(['/usr/bin/psql', '-X', '-w', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'],
               input=sql, env=environment, timeout=30)


def database_state(environment):
    sql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC';\n"
    sql += (ROOT / 'deploy/backup-state.sql').read_text() + '\nCOMMIT;'
    return json.loads(psql(environment, sql))


def verify_privileges(environment):
    psql(environment, (ROOT / 'deploy/verify-runtime-grants.sql').read_text())


def database_connections():
    ca = SECRETS / 'postgres_ca.pem'
    runtime, runtime_id = database_environment(SECRETS / 'database_url', 'wallpapers', ca)
    migrator, database_id = database_environment(SECRETS / 'migration_database_url', 'wallpapers-migrator', ca)
    require(runtime_id == database_id, 'database-identity-mismatch')
    sql = "SELECT json_build_object('user',current_user,'sessionUser',session_user,'database',current_database()," \
          "'server',inet_server_addr()::text,'port',inet_server_port(),'version',current_setting('server_version_num')::int);"
    actual = []
    for environment in (runtime, migrator):
        connection = json.loads(psql(environment, sql))
        require(connection['user'] == environment['PGUSER'] and connection['sessionUser'] == environment['PGUSER']
                and connection['database'] == 'wallpapers', 'database-connection-role-mismatch')
        require(connection['version'] // 10000 == 18, 'postgresql-version')
        actual.append({key: connection[key] for key in ('server', 'port', 'database', 'version')})
    require(actual[0] == actual[1], 'database-identity-mismatch')
    return migrator, database_id


def https(path, headers=False):
    arguments = ['/usr/bin/curl', '-q', '--noproxy', '*', '--fail', '--silent', '--show-error',
                 '--connect-timeout', '5', '--max-time', '20']
    if headers:
        arguments += ['--head']
    return run([*arguments, 'https://wallpapers.want.foundation' + path], timeout=25)


def wait_ready():
    deadline = time.monotonic() + 90
    while True:
        try:
            if json.loads(https('/health/ready')) == {'status': 'ok'}:
                return
        except (DeployError, ValueError):
            pass
        require(time.monotonic() < deadline, 'readiness-failed')
        time.sleep(3)


def smoke():
    wait_ready()
    catalog = json.loads(https('/api/v1/catalog'))
    require(isinstance(catalog.get('collections'), list) and isinstance(catalog.get('wallpapers'), list), 'catalog-failed')
    for prefix in ('/', '/ru/', '/zh-cn/', '/pt-br/'):
        page = https(prefix)
        require('<html' in page and 'hreflang=' in page, 'locale-failed')
    page = https('/')
    import re
    assets = re.findall(r'(?:src|href)="(/(?:_astro|assets)/[^"?#]+)', page)
    require(assets, 'static-assets-missing')
    for asset in dict.fromkeys(assets[:3]):
        https(asset, headers=True)
    for path in ('/api/v1/admin/session', '/admin/login/', '/health/ready', '/api/v1/recaptcha/config'):
        # The unauthenticated private API must return 401 without becoming an HTTP client error.
        header = run(['/usr/bin/curl', '-q', '--noproxy', '*', '--silent', '--show-error', '--head',
                      '--connect-timeout', '5', '--max-time', '20',
                      'https://wallpapers.want.foundation' + path], timeout=25).lower()
        require('cache-control:' in header and 'no-store' in header and '\nage:' not in header
                and not any('cf-cache-status: ' + value in header for value in ('hit', 'stale', 'updating', 'revalidated')),
                'private-cache-failed')
    require(json.loads(https('/api/v1/recaptcha/config')).get('enabled') is True, 'captcha-profile-failed')


def validate_container(container):
    host = container['HostConfig']
    require(container['Config']['User'] == '10001:10001' and host['ReadonlyRootfs']
            and host['Memory'] == 512 * 1024 ** 2 and host['MemorySwap'] == host['Memory']
            and 0 < host['NanoCpus'] <= 10 ** 9 and host['PidsLimit'] == 64
            and host['CapDrop'] == ['ALL'] and 'no-new-privileges' in ' '.join(host['SecurityOpt'])
            and not host.get('PortBindings'), 'runtime-isolation-mismatch')
    mounts = {entry['Destination']: entry for entry in container['Mounts'] if entry['Type'] == 'bind'}
    expected = {'database_url': 'database_url', 'postgres_ca': 'postgres_ca.pem',
                'admin_password_hash': 'admin_password_hash', 'admin_totp_secret': 'admin_totp_secret',
                'catalog_api_token': 'catalog_api_token', 'google_application_credentials': 'google_application_credentials.json'}
    require(set(mounts) == {'/run/secrets/' + name for name in expected}, 'runtime-secret-mounts')
    for name, filename in expected.items():
        mount = mounts['/run/secrets/' + name]
        require(not mount['RW'] and mount['Source'] == str(SECRETS / filename), 'runtime-secret-mounts')
    networks = container['NetworkSettings']['Networks']
    require(set(networks) == {'wallpapers-proxy', 'want-wallpapers_egress'}
            and 'wallpapers' in networks['wallpapers-proxy']['Aliases'], 'runtime-network-mismatch')


def other_containers():
    names = run(['/usr/bin/docker', 'ps', '--all', '--format', '{{.Names}}']).splitlines()
    return {name: inspect('container', name)['Id'] for name in names
            if name != CONTAINER and not name.startswith('want-wallpapers-migrate-')}


def migration_active():
    states = run(['/usr/bin/docker', 'ps', '--all', '--filter', 'label=com.docker.compose.project=want-wallpapers',
                  '--filter', 'label=com.docker.compose.service=migrate', '--format', '{{.State}}']).splitlines()
    return any(state not in ('exited', 'dead') for state in states)


def preflight():
    require(not migration_active(), 'migration-already-active')
    for path in (ENV, COMPOSE, ROOT / 'deploy/runtime-grants.sql', ROOT / 'deploy/verify-runtime-grants.sql'):
        details = path.stat()
        require(not path.is_symlink() and details.st_uid == 0 and details.st_mode & 0o022 == 0,
                'deployment-profile-not-root-owned')
    for filename in ('database_url', 'migration_database_url', 'postgres_ca.pem', 'admin_password_hash',
                     'admin_totp_secret', 'catalog_api_token', 'google_application_credentials.json'):
        path = SECRETS / filename
        require(not path.is_symlink() and path.stat().st_uid == 10001
                and path.stat().st_mode & 0o777 == 0o400, 'secret-permissions-mismatch')
    require(shutil.disk_usage(DEPLOYMENT).free >= 1024 ** 3, 'insufficient-disk')
    compose('config', '--quiet')
    profile = json.loads(compose('--profile', 'operations', 'config', '--format', 'json'))
    migration = profile['services']['migrate']
    require(set(migration['networks']) == {'egress'} and migration['user'] == '10001:10001'
            and int(migration['mem_limit']) == int(migration['memswap_limit']) == 128 * 1024 ** 2
            and migration['read_only']
            and {entry['source']: entry['target'] for entry in migration['secrets']}
                == {'migration_database_url': '/run/secrets/migration_database_url', 'postgres_ca': '/run/secrets/postgres_ca'}
            and set(migration['environment']) == {'APP_ENV', 'DATABASE_URL_FILE', 'PGSSLROOTCERT'}
            and migration['environment']['DATABASE_URL_FILE'] == '/run/secrets/migration_database_url',
            'migration-profile-mismatch')
    container = inspect('container', CONTAINER)
    require(container['State']['Health']['Status'] == 'healthy', 'current-app-unhealthy')
    validate_container(container)
    current_image = inspect('image', container['Config']['Image'])
    require(current_image['Id'] == container['Image'] and current_image['Os'] == 'linux'
            and current_image['Architecture'] == 'amd64'
            and current_image['Config']['Labels'].get('org.opencontainers.image.source') == 'https://github.com/' + release.REPOSITORY,
            'current-image-config-mismatch')
    environment, database_id = database_connections()
    verify_privileges(environment)
    return container, environment, database_id


def publish(store, record, stage=None, state=None, error=None):
    if stage:
        record['stage'] = stage
    if state:
        record['state'] = state
    if error:
        record['errorCode'] = error
    record['updatedAt'] = int(time.time())
    with store.lock():
        store.write(record)


def execute(store, record):
    stopped = False
    environment = None
    snapshot = None
    before = None
    try:
        with store.lock('deployment', blocking=False):
            with store.lock():
                record = store.read(record['requestId'])
                if record['state'] != 'running':
                    return
            publish(store, record, 'preflight')
            previous, environment, database_id = preflight()
            record['databaseId'] = database_id
            before = database_state(environment)
            require(all(row['success'] for row in before['history']), 'dirty-migration-history')
            record['before'] = before
            original_env = ENV.read_bytes()
            original_compose = COMPOSE.read_bytes()
            previous_image = previous['Config']['Image']
            require(previous_image.startswith(IMAGE + '@sha256:'), 'previous-image-not-immutable')
            record['previousImage'] = previous_image
            preserved = other_containers()
            publish(store, record, 'pulling')
            image = IMAGE + '@' + record['indexDigest']
            run(['/usr/bin/docker', 'pull', '--platform', 'linux/amd64', image], timeout=300)
            image_matches(inspect('image', image), record)
            snapshot = STATE / ('snapshot-' + record['requestId'])
            snapshot.mkdir(mode=0o700)
            (snapshot / 'old.env').write_bytes(original_env)
            (snapshot / 'old.env').chmod(0o600)
            (snapshot / 'compose.yaml').write_bytes(original_compose)
            (snapshot / 'compose.yaml').chmod(0o600)
            (snapshot / 'rollback.env').write_bytes(update_image(original_env, previous_image))
            (snapshot / 'rollback.env').chmod(0o600)
            record['snapshot'] = str(snapshot)
            record['backupDeadline'] = int(time.time()) + 1800
            publish(store, record, 'backup-pending')
            while True:
                with store.lock():
                    current = store.read(record['requestId'])
                if 'backupError' in current:
                    raise DeployError('backup-worker-failed')
                if 'receipt' in current:
                    verify_receipt(record, current['receipt'])
                    record['receipt'] = current['receipt']
                    record['backupVerified'] = True
                    break
                require(time.time() < record['backupDeadline'], 'backup-worker-timeout')
                time.sleep(5)
            require(database_state(environment) == before and ENV.read_bytes() == original_env
                    and COMPOSE.read_bytes() == original_compose, 'preflight-changed')
            fresh_environment, fresh_database_id = database_connections()
            require(fresh_environment == environment and fresh_database_id == database_id, 'database-profile-changed')
            os.environ['WANT_RELEASE_PUBLIC_API'] = '1'
            fresh = release.resolve(argparse.Namespace(tag=record['tag'], digest=record['indexDigest'], timeout=0))
            require(all(fresh.get(key) == record.get(key) for key in
                        ('sourceSha', 'verificationRun', 'verificationProfile', 'skippedChecks', 'platforms')),
                    'release-verification-changed')
            verify_privileges(environment)
            verify_receipt(record, record['receipt'])
            publish(store, record, 'app-stopped')
            stopped = True
            compose('stop', '--timeout', '30', 'app')
            target_env = snapshot / 'target.env'
            target_env.write_bytes(update_image(original_env, image))
            target_env.chmod(0o600)
            verify_receipt(record, record['receipt'])
            publish(store, record, 'migrating')
            compose('--profile', 'operations', 'run', '--rm', '--no-deps', '--pull', 'never', 'migrate',
                    environment=target_env, timeout=300)
            require(not migration_active(), 'migration-outcome-unknown')
            # Schema USAGE is established by the actual schema owner during provisioning.
            grants = (ROOT / 'deploy/runtime-grants.sql').read_text()
            grants = grants.replace('GRANT USAGE ON SCHEMA public TO :"runtime_role";\n', '')
            psql(environment, grants)
            verify_privileges(environment)
            record['after'] = database_state(environment)
            require(ENV.read_bytes() == original_env and COMPOSE.read_bytes() == original_compose,
                    'deployment-config-changed')
            # Preserve every other byte of the operational configuration.
            atomic_bytes(ENV, target_env.read_bytes())
            publish(store, record, 'starting')
            compose('up', '--detach', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', '120', 'app', timeout=180)
            active = inspect('container', CONTAINER)
            validate_container(active)
            require(active['Config']['Image'] == image and active['State']['Health']['Status'] == 'healthy',
                    'running-image-mismatch')
            image_matches(inspect('image', active['Image']), record)
            descriptor = active.get('ImageManifestDescriptor')
            require(descriptor is None or descriptor['digest'] == record['platforms']['linux/amd64']['digest'],
                    'running-platform-mismatch')
            publish(store, record, 'verifying')
            smoke()
            require(other_containers() == preserved and COMPOSE.read_bytes() == original_compose,
                    'other-services-changed')
            for timer in ('want-monitor.timer', 'want-cloudflare-update.timer'):
                require(run(['/usr/bin/systemctl', 'is-active', timer]).strip() == 'active', 'monitoring-inactive')
            record.update(actualImageId=active['Image'], architecture='amd64', revision=record['sourceSha'])
            notes = (f"## Состояние после деплоя {record['tag']}\n\n"
                     f"- Образ: `{image}`; revision `{record['sourceSha']}`; linux/amd64, app healthy.\n"
                     "- Backup зашифрован и восстановлен вне VPS; runtime privileges и public smoke прошли.\n"
                     f"- Deployment request: `{record['requestId']}`; rollback snapshot: `{snapshot}`.\n"
                     "- Login/CAPTCHA и logout требуют отдельной приватной приёмки владельцем.\n\n")
            recovery = README
            original = recovery.read_bytes()
            heading, separator, body = original.partition(b'\n')
            atomic_bytes(recovery, heading + separator + b'\n' + notes.encode() + body)
            recovery.chmod(0o644)
            publish(store, record, 'complete', 'succeeded')
    except Exception as error:
        code = str(error) if isinstance(error, DeployError) else 'deployment-step-failed'
        state = 'failed'
        if stopped:
            state = 'recovery-required'
            try:
                after = database_state(environment)
                verify_privileges(environment)
                compatible = (not migration_active() and code != 'command-unavailable'
                              and after['schema'] == before['schema'] and after['history'] == before['history'])
                if compatible:
                    atomic_bytes(ENV, (snapshot / 'rollback.env').read_bytes())
                    compose('up', '--detach', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', '120', 'app', timeout=180)
                    smoke()
                    state = 'rolled-back'
                else:
                    compose('stop', '--timeout', '30', 'app')
            except Exception:
                state = 'recovery-required'
            if state == 'recovery-required':
                try:
                    compose('stop', '--timeout', '30', 'app')
                except Exception:
                    pass
        publish(store, record, state=state, error=code)


def reconcile(store, record):
    if record['state'] in TERMINAL:
        return
    if record['stage'] in ('app-stopped', 'migrating', 'starting', 'verifying'):
        try:
            compose('stop', '--timeout', '30', 'app')
        except Exception:
            pass
        state = 'recovery-required'
    else:
        state = 'failed'
    publish(store, record, state=state, error='deployment-service-interrupted')


def submit(store, tag, sha, digest):
    os.environ['WANT_RELEASE_PUBLIC_API'] = '1'
    evidence = release.resolve(argparse.Namespace(tag=tag, digest=digest, timeout=0))
    require(evidence['sourceSha'] == sha, 'release-source-mismatch')
    with store.lock():
        for record in store.records():
            require(record['state'] != 'recovery-required', 'operator-recovery-required')
            require(record['tag'] != tag or (record['sourceSha'], record['indexDigest']) == (sha, digest),
                    'release-intent-digest-mismatch')
            same = (record['tag'], record['sourceSha'], record['indexDigest']) == (tag, sha, digest)
            if record['state'] not in TERMINAL:
                require(same, 'deployment-busy')
                return public_record(record)
            if same and record['state'] == 'succeeded':
                active = inspect('container', CONTAINER)
                require(active['Config']['Image'] == IMAGE + '@' + digest
                        and active['State']['Health']['Status'] == 'healthy', 'release-no-longer-active')
                return public_record(record)
            if same and record['state'] == 'recovery-required':
                raise DeployError('operator-recovery-required')
        request_id = uuid.uuid4().hex
        record = {**evidence, 'requestId': request_id, 'state': 'running', 'stage': 'requested',
                  'createdAt': int(time.time())}
        store.write(record)
        try:
            run(['/usr/bin/systemd-run', '--quiet', '--no-block', '--unit', 'wallpapers-deploy-' + request_id,
                 '--property=Type=oneshot', '--property=UMask=0077', '--property=TimeoutStartSec=45min',
                 '--property=ExecStopPost=/usr/local/sbin/wallpapers-deploy reconcile ' + request_id,
                 '/usr/local/sbin/wallpapers-deploy', 'run', request_id])
        except Exception:
            record.update(state='failed', errorCode='service-start-failed')
            store.write(record)
            raise
        return public_record(record)


def read_receipt(stream, timeout=10):
    deadline = time.monotonic() + timeout
    payload = bytearray()
    while len(payload) <= 16384:
        remaining = deadline - time.monotonic()
        require(remaining > 0 and select.select([stream], [], [], remaining)[0], 'backup-receipt-timeout')
        block = os.read(stream.fileno(), 16385 - len(payload))
        if not block:
            receipt = json.loads(payload)
            require(isinstance(receipt, dict), 'invalid-backup-receipt')
            return receipt
        payload.extend(block)
    raise DeployError('backup-receipt-too-large')


def protocol(store, actor, words):
    command = request_command(' '.join(words), actor)
    require(os.environ.get('SUDO_USER') == ACTORS[actor], 'invalid-account')
    if command[0] == 'deploy':
        return submit(store, *command[1:])
    receipt = read_receipt(sys.stdin.buffer) if command[0] == 'backup-result' else None
    with store.lock():
        if command[0] == 'deploy-status':
            if len(command) == 2:
                record = store.read(command[1])
            else:
                records = [record for record in store.records()
                           if (record['tag'], record['sourceSha'], record['indexDigest']) == command[1:]]
                require(records, 'request-not-found')
                record = max(records, key=lambda value: value['createdAt'])
            if record['state'] not in TERMINAL:
                state = run(['/usr/bin/systemctl', 'show', 'wallpapers-deploy-' + record['requestId'],
                             '--property=ActiveState', '--value']).strip()
                if state not in ('active', 'activating'):
                    record['state'] = ('recovery-required' if record['stage'] in
                                       ('app-stopped', 'migrating', 'starting', 'verifying') else 'failed')
                    record['errorCode'] = 'deployment-service-interrupted'
                    store.write(record)
            return public_record(record)
        if command[0] == 'backup-next':
            for record in store.records():
                if record['state'] == 'running' and record['stage'] == 'backup-pending' and 'receipt' not in record:
                    require(time.time() <= record['backupDeadline'], 'backup-request-expired')
                    return {key: record[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest',
                                                        'databaseId', 'before', 'backupDeadline')}
            return {'pending': False}
        record = store.read(command[1])
        if record.get('receipt') == receipt:
            return {'requestId': record['requestId'], 'accepted': True}
        require(record['state'] == 'running' and record['stage'] == 'backup-pending'
                and 'receipt' not in record and 'backupError' not in record, 'backup-already-consumed')
        if receipt.get('status') == 'failed':
            require(receipt.get('requestId') == record['requestId'], 'backup-request-mismatch')
            record['backupError'] = 'worker-failed'
        else:
            verify_receipt(record, receipt)
            record['receipt'] = receipt
        store.write(record)
        return {'requestId': record['requestId'], 'accepted': True}


def main():
    require(os.geteuid() == 0, 'root-owned-service-required')
    require(len(sys.argv) >= 3, 'invalid-command')
    store = Store(STATE / 'requests')
    if sys.argv[1] in ('run', 'reconcile'):
        require(len(sys.argv) == 3 and not os.environ.get('SUDO_USER'), 'invalid-service-invocation')
        operation = execute if sys.argv[1] == 'run' else reconcile
        operation(store, store.read(sys.argv[2]))
        return
    require(sys.argv[1] in ACTORS, 'invalid-actor')
    print(json.dumps(protocol(store, sys.argv[1], sys.argv[2:]), sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, DeployError) else 'request-failed'
        print(json.dumps({'errorCode': code}))
        sys.exit(1)

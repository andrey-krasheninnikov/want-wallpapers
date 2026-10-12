import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from deployment import DeployError, IMAGE, Store
spec = importlib.util.spec_from_file_location('server', ROOT / 'scripts/deploy-server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class ServerTransitions(unittest.TestCase):
    def exercise(self, *, wrong_image=False, worker_failure=False, migration_failure=False,
                 schema_changes=False, readiness_failure=False, worker_unavailable=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            environment = root / '.env'
            composition = root / 'compose.yaml'
            notes = root / 'README.md'
            previous = IMAGE + '@sha256:' + '6' * 64
            original = ('APP_IMAGE=' + previous + '\nKEEP=preserved\n').encode()
            environment.write_bytes(original)
            composition.write_text('preserved operational profile')
            notes.write_text('# Recovery\nHistorical state\n')
            store = Store(root / 'requests')
            record = {'schemaVersion': 1, 'requestId': 'c' * 32, 'tag': 'v1.5.0', 'sourceSha': 'd' * 40,
                      'indexDigest': 'sha256:' + 'a' * 64, 'state': 'running', 'stage': 'requested',
                      'verificationRun': {'id': 73, 'attempt': 1}, 'createdAt': int(time.time()),
                      'platforms': {'linux/amd64': {'digest': 'sha256:' + 'b' * 64, 'configDigest': 'sha256:' + 'e' * 64}}}
            store.write(record)
            before = {'schema': '1' * 64, 'history': [{'version': 1, 'success': True, 'checksum': '2' * 96}], 'catalog': '3' * 64}
            migrated = [False]
            clock = [int(time.time())]
            active = {'Config': {'Image': previous}, 'State': {'Health': {'Status': 'healthy'}},
                      'Image': record['indexDigest']}

            def compose(*arguments, **options):
                if 'run' in arguments:
                    migrated[0] = schema_changes
                    if migration_failure:
                        raise DeployError('migration-fixture-failed')
                if 'up' in arguments:
                    active['Config']['Image'] = environment.read_text().splitlines()[0].split('=', 1)[1]
                return ''

            def inspect(kind, reference):
                if kind == 'container':
                    return active
                return {'Id': 'sha256:' + ('f' if wrong_image else 'a') * 64,
                        'Os': 'linux', 'Architecture': 'amd64',
                        'Config': {'Labels': {'org.opencontainers.image.revision': record['sourceSha']}}}

            def state(environment):
                value = copy.deepcopy(before)
                if migrated[0]:
                    value['schema'] = '9' * 64
                    value['history'].append({'version': 2, 'success': True, 'checksum': '8' * 96})
                return value

            def worker(_):
                if worker_unavailable:
                    clock[0] += 1801
                    return
                with patch.dict(os.environ, {'SUDO_USER': 'wallpapers-backup'}):
                    request = server.protocol(store, 'worker', ('backup-next',))
                    receipt = {'requestId': record['requestId'], 'status': 'failed'} if worker_failure else {
                        **{key: request[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'databaseId')},
                        'verifiedAt': int(time.time()), 'ciphertextSha256': '4' * 64,
                        'objectKey': 'wallpapers-backups/' + record['requestId'] + '.dump.age',
                        'restored': copy.deepcopy(before), 'status': 'verified'}
                    with tempfile.TemporaryFile() as payload:
                        payload.write(json.dumps(receipt).encode())
                        payload.seek(0)
                        stream = type('Input', (), {'buffer': payload})()
                        with patch.object(sys, 'stdin', stream):
                            server.protocol(store, 'worker', ('backup-result', record['requestId']))

            def smoke():
                if readiness_failure and active['Config']['Image'] != previous:
                    raise DeployError('readiness-fixture-failed')

            with patch.multiple(server, ENV=environment, COMPOSE=composition, STATE=root, DEPLOYMENT=root, README=notes), \
                 patch.dict(os.environ, {'WANT_RELEASE_PUBLIC_API': '0'}), \
                 patch.object(server, 'preflight', return_value=(copy.deepcopy(active), {}, '5' * 64)), \
                 patch.object(server, 'database_connections', return_value=({}, '5' * 64)), \
                 patch.object(server, 'other_containers', return_value={'proxy': 'unchanged'}), \
                 patch.object(server, 'migration_active', return_value=False), \
                 patch.object(server, 'compose', side_effect=compose), patch.object(server, 'inspect', side_effect=inspect), \
                 patch.object(server, 'database_state', side_effect=state), patch.object(server, 'psql', return_value=''), \
                 patch.object(server, 'verify_privileges', return_value=None), patch.object(server, 'validate_container', return_value=None), \
                 patch.object(server, 'run', return_value='active'), patch.object(server, 'smoke', side_effect=smoke), \
                 patch.object(server.release, 'resolve', return_value=record), \
                 patch.object(server.time, 'time', side_effect=lambda: clock[0]), \
                 patch.object(server.time, 'sleep', side_effect=worker):
                server.execute(store, record)
            result = store.read(record['requestId'])
            return result, environment.read_bytes(), migrated[0]

    def test_success_switches_only_the_application_and_records_verified_backup(self):
        result, environment, _ = self.exercise()
        self.assertEqual(result['state'], 'succeeded')
        self.assertTrue(result['backupVerified'])
        self.assertIn(b'KEEP=preserved\n', environment)

    def test_wrong_image_and_failed_worker_leave_the_old_app_config(self):
        for arguments in ({'wrong_image': True}, {'worker_failure': True}, {'worker_unavailable': True}):
            with self.subTest(arguments=arguments):
                result, environment, _ = self.exercise(**arguments)
                self.assertEqual(result['state'], 'failed')
                self.assertIn(('sha256:' + '6' * 64).encode(), environment)

    def test_migration_failure_rolls_back_only_unchanged_schema(self):
        result, environment, changed = self.exercise(migration_failure=True)
        self.assertEqual(result['state'], 'rolled-back')
        self.assertFalse(changed)
        self.assertIn(('sha256:' + '6' * 64).encode(), environment)

    def test_changed_schema_is_preserved_for_operator_recovery(self):
        result, _, changed = self.exercise(migration_failure=True, schema_changes=True)
        self.assertEqual(result['state'], 'recovery-required')
        self.assertTrue(changed)

    def test_failed_new_readiness_returns_the_old_compatible_app(self):
        result, environment, _ = self.exercise(readiness_failure=True)
        self.assertEqual(result['state'], 'rolled-back')
        self.assertIn(('sha256:' + '6' * 64).encode(), environment)

    def test_submit_acknowledges_before_oneshot_service_finishes(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory))
            evidence = {'tag': 'v1.5.0', 'sourceSha': 'a' * 40, 'indexDigest': 'sha256:' + 'b' * 64}

            def start(arguments, **options):
                self.assertIn('--no-block', arguments)
                return ''

            with patch.object(server.release, 'resolve', return_value=evidence), patch.object(server, 'run', side_effect=start):
                record = server.submit(store, evidence['tag'], evidence['sourceSha'], evidence['indexDigest'])
            self.assertEqual(record['state'], 'running')
            self.assertEqual(store.read(record['requestId'])['stage'], 'requested')

    def test_slow_receipt_has_a_deadline_and_does_not_hold_requests_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory))
            started = threading.Event()
            errors = []
            descriptor, writer = os.pipe()
            original = server.read_receipt

            def read(stream):
                started.set()
                return original(stream, timeout=0.2)

            def receive():
                try:
                    server.protocol(store, 'worker', ('backup-result', 'c' * 32))
                except DeployError as error:
                    errors.append(str(error))

            with os.fdopen(descriptor, 'rb', buffering=0) as reader, \
                 patch.dict(os.environ, {'SUDO_USER': 'wallpapers-backup'}), \
                 patch.object(server, 'read_receipt', side_effect=read), \
                 patch.object(sys, 'stdin', type('Input', (), {'buffer': reader})()):
                thread = threading.Thread(target=receive)
                try:
                    thread.start()
                    self.assertTrue(started.wait(timeout=1))
                    with store.lock(blocking=False):
                        pass
                    thread.join(timeout=1)
                    self.assertFalse(thread.is_alive())
                    self.assertEqual(errors, ['backup-receipt-timeout'])
                finally:
                    os.close(writer)
                    thread.join(timeout=1)

    def test_runtime_and_migrator_connections_require_the_same_database_and_actual_roles(self):
        with tempfile.TemporaryDirectory() as directory:
            secrets = Path(directory)
            ca = secrets / 'postgres_ca.pem'
            ca.write_text('test certificate')
            for name, role in [('database_url', 'wallpapers'), ('migration_database_url', 'wallpapers-migrator')]:
                path = secrets / name
                path.write_text(f'postgresql://{role}:test-only@database.example.invalid/wallpapers?sslmode=verify-full')
                path.chmod(0o600)

            def query(environment, sql):
                return json.dumps({'user': environment['PGUSER'], 'sessionUser': environment['PGUSER'],
                                   'database': 'wallpapers', 'server': '192.0.2.1', 'port': 5432, 'version': 180006})

            with patch.object(server, 'SECRETS', secrets), patch.object(server, 'psql', side_effect=query):
                environment, identity = server.database_connections()
                self.assertEqual(environment['PGUSER'], 'wallpapers-migrator')
                self.assertEqual(len(identity), 64)
                (secrets / 'database_url').write_text(
                    'postgresql://wallpapers-migrator:test-only@database.example.invalid/wallpapers?sslmode=verify-full')
                with self.assertRaisesRegex(DeployError, 'database-profile-mismatch'):
                    server.database_connections()
                (secrets / 'database_url').write_text(
                    'postgresql://wallpapers:test-only@other.example.invalid/wallpapers?sslmode=verify-full')
                with self.assertRaisesRegex(DeployError, 'database-identity-mismatch'):
                    server.database_connections()

    def test_failed_service_start_cannot_later_stop_the_app(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory))
            evidence = {'tag': 'v1.5.0', 'sourceSha': 'a' * 40, 'indexDigest': 'sha256:' + 'b' * 64}
            with patch.object(server.release, 'resolve', return_value=evidence), \
                 patch.object(server, 'run', side_effect=DeployError('command-unavailable')):
                with self.assertRaises(DeployError):
                    server.submit(store, evidence['tag'], evidence['sourceSha'], evidence['indexDigest'])
            record = store.records()[0]
            self.assertEqual(record['state'], 'failed')
            with patch.object(server, 'preflight', side_effect=AssertionError('Failed request executed')):
                server.execute(store, {**record, 'state': 'running'})
            self.assertEqual(store.read(record['requestId'])['errorCode'], 'service-start-failed')


if __name__ == '__main__':
    unittest.main()

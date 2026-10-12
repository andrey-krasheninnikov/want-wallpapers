import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
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
                 schema_changes=False, readiness_failure=False):
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
                with patch.dict(os.environ, {'SUDO_USER': 'wallpapers-backup'}):
                    request = server.protocol(store, 'worker', ('backup-next',))
                    receipt = {'requestId': record['requestId'], 'status': 'failed'} if worker_failure else {
                        **{key: request[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'databaseId')},
                        'verifiedAt': int(time.time()), 'ciphertextSha256': '4' * 64,
                        'objectKey': 'wallpapers-backups/' + record['requestId'] + '.dump.age',
                        'restored': copy.deepcopy(before), 'status': 'verified'}
                    stream = type('Input', (), {'buffer': io.BytesIO(json.dumps(receipt).encode())})()
                    with patch.object(sys, 'stdin', stream):
                        server.protocol(store, 'worker', ('backup-result', record['requestId']))

            def smoke():
                if readiness_failure and active['Config']['Image'] != previous:
                    raise DeployError('readiness-fixture-failed')

            with patch.object(server, 'ENV', environment), patch.object(server, 'COMPOSE', composition), \
                 patch.dict(os.environ, {'WANT_RELEASE_PUBLIC_API': '0'}), \
                 patch.object(server, 'STATE', root), patch.object(server, 'DEPLOYMENT', root), \
                 patch.object(server, 'README', notes), \
                 patch.object(server, 'preflight', return_value=(copy.deepcopy(active), {}, '5' * 64)), \
                 patch.object(server, 'other_containers', return_value={'proxy': 'unchanged'}), \
                 patch.object(server, 'migration_active', return_value=False), \
                 patch.object(server, 'compose', side_effect=compose), patch.object(server, 'inspect', side_effect=inspect), \
                 patch.object(server, 'database_state', side_effect=state), patch.object(server, 'psql', return_value=''), \
                 patch.object(server, 'verify_privileges', return_value=None), patch.object(server, 'validate_container', return_value=None), \
                 patch.object(server, 'run', return_value='active'), patch.object(server, 'smoke', side_effect=smoke), \
                 patch.object(server.release, 'resolve', return_value=record), patch.object(server.time, 'sleep', side_effect=worker):
                server.execute(store, record)
            result = store.read(record['requestId'])
            return result, environment.read_bytes(), migrated[0]

    def test_success_switches_only_the_application_and_records_verified_backup(self):
        result, environment, _ = self.exercise()
        self.assertEqual(result['state'], 'succeeded')
        self.assertTrue(result['backupVerified'])
        self.assertIn(b'KEEP=preserved\n', environment)

    def test_wrong_image_and_failed_worker_leave_the_old_app_config(self):
        for arguments in ({'wrong_image': True}, {'worker_failure': True}):
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


if __name__ == '__main__':
    unittest.main()

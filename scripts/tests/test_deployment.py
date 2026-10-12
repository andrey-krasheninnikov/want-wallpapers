import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('deployment', ROOT / 'scripts/deployment.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentContractTests(unittest.TestCase):
    def test_owner_provisioning_rejects_noninteractive_credential_input(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/setup-production-owner.py'),
                                 '--postgres-host', 'database.example.invalid', '--postgres-ca', '/unused/ca.pem'],
                                stdin=subprocess.DEVNULL, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('private-owner-terminal-required', result.stdout)

    def test_deployment_events_exclude_branches_prs_and_forks(self):
        for event, ref in [('push', 'refs/heads/main'), ('pull_request', 'refs/pull/1/merge'),
                           ('workflow_dispatch', 'refs/heads/main')]:
            self.assertFalse(deployment.deployment_event(event, ref, deployment.REPOSITORY, 'v1.5.0', 'sha256:' + 'a' * 64))
        self.assertFalse(deployment.deployment_event('push', 'refs/tags/v1.5.0', 'other/fork'))
        self.assertTrue(deployment.deployment_event('push', 'refs/tags/v1.5.0', deployment.REPOSITORY))
        self.assertTrue(deployment.deployment_event('workflow_dispatch', 'refs/tags/v1.5.0', deployment.REPOSITORY,
                                                    'v1.5.0', 'sha256:' + 'a' * 64))
        self.assertFalse(deployment.deployment_event('workflow_dispatch', 'refs/tags/v1.5.0', deployment.REPOSITORY,
                                                     'v1.4.2', 'sha256:' + 'a' * 64))

    def test_image_identity_handles_both_docker_stores_without_accepting_wrong_platforms(self):
        record = {'indexDigest': 'sha256:' + 'a' * 64, 'sourceSha': 'd' * 40,
                  'platforms': {'linux/amd64': {'digest': 'sha256:' + 'b' * 64, 'configDigest': 'sha256:' + 'c' * 64}}}
        metadata = {'Id': record['indexDigest'], 'Os': 'linux', 'Architecture': 'amd64',
                    'Config': {'Labels': {'org.opencontainers.image.revision': record['sourceSha']}}}
        for identifier in (record['indexDigest'], record['platforms']['linux/amd64']['digest'], record['platforms']['linux/amd64']['configDigest']):
            deployment.image_matches({**metadata, 'Id': identifier}, record)
        for key, value in [('Id', 'sha256:' + 'e' * 64), ('Os', 'windows'), ('Architecture', 'arm64'), ('Config', {})]:
            with self.subTest(key=key), self.assertRaises(deployment.DeployError):
                deployment.image_matches({**metadata, key: value}, record)

    def test_lock_contention_rejects_a_second_deployment(self):
        with tempfile.TemporaryDirectory() as directory:
            store = deployment.Store(Path(directory))
            with store.lock('deployment', blocking=False):
                with self.assertRaises(deployment.DeployError):
                    with store.lock('deployment', blocking=False):
                        self.fail('Concurrent deployment acquired the lock')

    def test_environment_update_preserves_every_other_byte(self):
        old = b'# profile\r\nAPP_IMAGE=ghcr.io/andrey-krasheninnikov/want-wallpapers@sha256:old\r\nKEEP=value\r\n'
        image = deployment.IMAGE + '@sha256:' + 'a' * 64
        self.assertEqual(deployment.update_image(old, image),
                         b'# profile\r\nAPP_IMAGE=' + image.encode() + b'\r\nKEEP=value\r\n')

    def test_restricted_command_accepts_one_release_only(self):
        sha = 'a' * 40
        digest = 'sha256:' + 'b' * 64
        self.assertEqual(deployment.request_command(f'deploy v1.5.0 {sha} {digest}', 'ci'),
                         ('deploy', 'v1.5.0', sha, digest))
        for command in ('id', 'deploy ../other', f'deploy v1.5.0 {sha} {digest};id',
                        f'deploy v1.5.0 {sha} {digest} extra', 'backup-next'):
            with self.subTest(command=command), self.assertRaises(deployment.DeployError):
                deployment.request_command(command, 'ci')

    def test_worker_cannot_submit_deployments(self):
        self.assertEqual(deployment.request_command('backup-next', 'worker'), ('backup-next',))
        with self.assertRaises(deployment.DeployError):
            deployment.request_command('deploy v1.5.0 ' + 'a' * 40 + ' sha256:' + 'b' * 64, 'worker')

    def test_receipt_is_bound_to_one_fresh_request_and_ciphertext(self):
        request = {'requestId': 'c' * 32, 'tag': 'v1.5.0', 'sourceSha': 'a' * 40,
                   'indexDigest': 'sha256:' + 'b' * 64, 'databaseId': 'd' * 64,
                   'before': {'schema': 'e' * 64, 'history': [], 'catalog': 'f' * 64},
                   'backupDeadline': 2000}
        receipt = {**{key: request[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'databaseId')},
                   'verifiedAt': 1500, 'ciphertextSha256': '1' * 64,
                   'objectKey': 'wallpapers-backups/' + 'c' * 32 + '.dump.age',
                   'restored': request['before'], 'status': 'verified'}
        deployment.verify_receipt(request, receipt, 1501)
        for key, value in [('requestId', '2' * 32), ('databaseId', '3' * 64),
                           ('objectKey', 'axentra/other'), ('status', 'failed'), ('verifiedAt', 999)]:
            invalid = {**receipt, key: value}
            with self.subTest(key=key), self.assertRaises(deployment.DeployError):
                deployment.verify_receipt(request, invalid, 1501)
        with self.assertRaises(deployment.DeployError):
            deployment.verify_receipt(request, receipt, 2500)

    def test_record_is_atomic_private_and_cannot_escape_its_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            store = deployment.Store(Path(directory))
            record = {'requestId': 'c' * 32, 'state': 'running', 'stage': 'preflight'}
            store.write(record)
            self.assertEqual(store.read('c' * 32), record)
            self.assertEqual(store.path('c' * 32).stat().st_mode & 0o777, 0o600)
            with self.assertRaises(deployment.DeployError):
                store.read('../record')


if __name__ == '__main__':
    unittest.main()

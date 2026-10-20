"""Exercise local release failures and reconciliation without external mutations."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from deployment import DeployError, Store, atomic_json
from local_evidence import required_checks
from local_release_runtime import Fixtures, execute, registry_auth, validate_ssh

spec = importlib.util.spec_from_file_location('local_release_test', ROOT / 'scripts/local-release.py')
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)
spec = importlib.util.spec_from_file_location('local_install_test', ROOT / 'scripts/install-deployment.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
spec = importlib.util.spec_from_file_location('local_worker_test', ROOT / 'scripts/backup-worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class LocalPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wallpapers-release-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.state = local.load_state(self.root, 'v1.9.3', 'a' * 40, 'fast')
        self.config = {'buildEnvironment': {}}
        self.identity = ('checked-inputs', {'hostArchitecture': 'arm64', 'sourceTree': 'b' * 40, 'toolDigest': 'sha256:' + 'c' * 64})

    def test_premerge_result_rebinds_only_before_any_image_is_built(self):
        self.state['stages'] = ['Install', 'Static']
        local.save(self.root, self.state)
        resumed = local.load_state(self.root, 'v1.9.3', 'd' * 40, 'fast')
        self.assertEqual(resumed['stages'], ['Install', 'Static'])
        resumed['images']['arm64'] = {'configDigest': 'sha256:' + '0' * 64}
        local.save(self.root, resumed)
        with self.assertRaises(DeployError):
            local.load_state(self.root, 'v1.9.3', 'e' * 40, 'fast')
        with self.assertRaises(DeployError):
            local.load_state(self.root, 'v1.9.3', 'd' * 40, 'full')

    def test_failed_check_blocks_later_steps_and_cleans_fixtures(self):
        fixtures = Mock()
        fixtures.start.return_value = {}
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'Fixtures', return_value=fixtures), patch.object(local, 'run', return_value=''), \
             patch.object(local, 'execute', side_effect=[None, DeployError('static-failed')]) as execute:
            with self.assertRaisesRegex(DeployError, 'static-failed'):
                local.prepare(self.root, self.root, self.state, self.config)
        self.assertEqual(self.state['stages'], ['Install'])
        self.assertEqual(fixtures.start.call_args.args[1]['BUN_OPTIONS'], '--timeout=30000')
        self.assertEqual(fixtures.start.call_args.args[1]['RUST_TEST_THREADS'], '2')
        self.assertEqual(execute.call_count, 2)
        self.assertEqual(fixtures.cleanup.call_count, 2)
        self.assertFalse(self.state.get('published'))

    def test_current_backup_failure_keeps_unit_stage_incomplete(self):
        self.state['stages'] = ['Install', 'Static']
        fixtures = Mock()
        fixtures.start.side_effect = lambda source, environment: environment
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'Fixtures', return_value=fixtures), \
             patch.object(local, 'execute', side_effect=[None, DeployError('restore-failed')]) as execute:
            with self.assertRaisesRegex(DeployError, 'restore-failed'):
                local.prepare(self.root, self.root, self.state, self.config)
        self.assertNotIn('Unit/API', self.state['stages'])
        self.assertEqual(execute.call_args_list[0].args[0], ['make', 'test-frontend', 'test-backend', 'test-ci'])
        self.assertEqual(execute.call_args_list[1].args[0], ['python3', '-B', str(ROOT / 'scripts/test-backup.py')])
        self.assertEqual(execute.call_args_list[1].args[2]['TEST_SOURCE_ROOT'], str(self.root))

    def test_backup_sql_and_release_policy_change_tool_digest(self):
        original = Path.read_bytes
        expected = local.tool_digest()
        for relative in ('deploy/backup-state.sql', '.github/release-policy.json'):
            def changed(path):
                body = original(path)
                return body + b'\n' if path == ROOT / relative else body
            with self.subTest(path=relative), patch.object(Path, 'read_bytes', changed):
                self.assertNotEqual(local.tool_digest(), expected)

    def test_changed_inputs_cannot_reuse_completed_checks(self):
        self.state['inputFingerprint'] = 'old-inputs'
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'execute') as execute, self.assertRaisesRegex(DeployError, 'inputs-changed'):
            local.prepare(self.root, self.root, self.state, self.config)
        execute.assert_not_called()

    def test_completed_prepare_reuses_results_and_checks_exact_image_ids(self):
        self.state.update(inputFingerprint='checked-inputs', stages=required_checks('fast') + ['Install', 'Build (arm64)', 'Build (amd64)'],
                          images={arch: {'reference': 'checked-' + arch, 'configDigest': 'sha256:' + '1' * 64} for arch in ('arm64', 'amd64')})
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'run', return_value=''), patch.object(local, 'Fixtures') as fixtures, \
             patch.object(local, 'image_identity', return_value='sha256:' + '1' * 64):
            local.prepare(self.root, self.root, self.state, self.config)
        fixtures.return_value.cleanup.assert_called_once()
        fixtures.return_value.start.assert_not_called()
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'run', return_value=''), patch.object(local, 'image_identity', return_value='wrong'), \
             self.assertRaisesRegex(DeployError, 'image-changed'):
            local.prepare(self.root, self.root, self.state, self.config)

    def test_existing_publication_is_reconciled_without_push_or_rebuild(self):
        self.state.update(inputFingerprint='checked-inputs', inputs=self.identity[1], stages=required_checks('fast'),
                          images={arch: {'reference': 'checked-' + arch, 'configDigest': 'sha256:' + digit * 64}
                                  for arch, digit in [('arm64', '1'), ('amd64', '2')]}, signedRecord={'signed': 'fixture'})
        public = self.root / 'key.pub'
        public.write_text('public fixture')
        self.config['signingPublicKey'] = str(public)
        manifests = [{'config': {'digest': self.state['images'][arch]['configDigest']}} for arch in ('arm64', 'amd64')]
        manifests.append({'annotations': {local.release.ANNOTATION: json.dumps(self.state['signedRecord'])}})
        with patch.object(local, 'verification_identity', return_value=self.identity), \
             patch.object(local, 'allowed_signer', return_value='synthetic signer'), \
             patch.object(local, 'registry_auth', return_value=contextlib.nullcontext(('owner', 'synthetic-token'))), \
             patch.object(local, 'remote_manifest', side_effect=manifests), \
             patch.object(local.release, 'registry', return_value='sha256:' + '3' * 64), \
             patch.object(local.release, 'resolve', side_effect=lambda *a, **k: {'platforms': self.state['platforms']}), \
             patch.object(local.release, 'publish_oci_index') as publish, patch.object(local, 'execute') as execute, \
             patch.object(local, 'image_identity') as image, patch.object(local, 'cleanup_images') as cleanup:
            local.publish(self.root, self.root, self.state, self.config)
        publish.assert_not_called(); execute.assert_not_called(); image.assert_not_called(); cleanup.assert_called_once()
        self.assertTrue(self.state['published'])
        self.assertEqual(self.state['indexDigest'], 'sha256:' + '3' * 64)

    def test_containerd_image_identity_reads_config_digest_separately_from_manifest_id(self):
        config, manifest = 'sha256:' + '1' * 64, 'sha256:' + '2' * 64
        image = {'Id': manifest, 'Os': 'linux', 'Architecture': 'arm64',
                 'Descriptor': {'digest': manifest, 'mediaType': 'application/vnd.docker.distribution.manifest.v2+json',
                                'annotations': {'config.digest': config}},
                 'Config': {'Labels': {'org.opencontainers.image.revision': self.state['sourceSha'],
                                      'foundation.want.wallpapers.local-release': self.state['id']}}}
        with patch.object(local, 'inspect', return_value=image):
            self.assertEqual(local.image_identity('owned', self.state, 'arm64'), config)
        image['Descriptor']['annotations'] = {}
        with patch.object(local, 'inspect', return_value=image), self.assertRaises(local.release.ReleaseError):
            local.image_identity('owned', self.state, 'arm64')
        del image['Descriptor']
        with patch.object(local, 'inspect', return_value={**image, 'Id': config}):
            self.assertEqual(local.image_identity('owned', self.state, 'arm64'), config)

    def test_image_cleanup_removes_only_owned_references(self):
        self.state['images'] = {'arm64': {'reference': 'owned', 'configDigest': 'sha256:' + '1' * 64}}
        metadata = {'Id': 'sha256:' + '1' * 64, 'Config': {'Labels': {'foundation.want.wallpapers.local-release': self.state['id']}}}
        with patch.object(local, 'inspect', return_value=metadata), patch.object(local, 'run') as run:
            local.cleanup_images(self.state)
        self.assertEqual(run.call_count, 2)
        with patch.object(local, 'inspect', return_value={**metadata, 'Id': 'sha256:' + '2' * 64}), \
             patch.object(local, 'run') as run, self.assertRaisesRegex(DeployError, 'cleanup-ownership'):
            local.cleanup_images(self.state)
        run.assert_not_called()

    def test_deployment_requires_verified_publication_and_preserves_failure(self):
        config = {'backupConfig': 'unused', 'sshConfig': 'unused'}
        with patch.object(local, 'backup_worker') as backup, self.assertRaises(DeployError):
            local.deploy(self.root, self.state, config)
        backup.assert_not_called()
        self.state.update(published=True, indexDigest='sha256:' + '9' * 64)
        with patch.object(local, 'backup_worker', return_value=contextlib.nullcontext()), \
             patch.object(local.client, 'deploy', return_value={'state': 'recovery-required'}) as deploy, \
             self.assertRaisesRegex(DeployError, 'not-successful'):
            local.deploy(self.root, self.state, config)
        self.assertEqual(deploy.call_args.args[-1], self.state['indexDigest'])
        self.assertEqual(self.state['deployment']['state'], 'recovery-required')

    def test_lost_deployment_result_preserves_intent_and_resumes_read_only(self):
        self.state.update(published=True, indexDigest='sha256:' + '9' * 64)
        config = {'backupConfig': 'unused', 'sshConfig': 'unused'}
        with patch.object(local, 'backup_worker', return_value=contextlib.nullcontext()), \
             patch.object(local.client, 'deploy', side_effect=[DeployError('connection-lost'), {'state': 'failed'}]) as deploy:
            with self.assertRaisesRegex(DeployError, 'connection-lost'):
                local.deploy(self.root, self.state, config)
            persisted = json.loads((self.root / 'release.json').read_text())
            self.assertTrue(persisted['deploymentIntent'])
            with self.assertRaisesRegex(DeployError, 'not-successful'):
                local.deploy(self.root, persisted, config)
            self.assertFalse(deploy.call_args_list[0].kwargs['resume'])
            self.assertTrue(deploy.call_args_list[1].kwargs['resume'])

    def test_ssh_profile_rejects_owner_and_requires_a_pinned_host_key(self):
        profile = 'user wallpapers-deploy\nport 14444\nidentitiesonly yes\nidentityfile /private/key\nhostname host.example\nuserknownhostsfile /private/known_hosts\n'
        with patch('local_release_runtime.private_file', side_effect=lambda path: path):
            for wrong in (profile.replace('wallpapers-deploy', 'root'), profile.replace('14444', '22'),
                          profile.replace('identitiesonly yes', 'identitiesonly no')):
                with patch('local_release_runtime.run', return_value=wrong), self.assertRaises(DeployError):
                    validate_ssh('private-config')
            with patch('local_release_runtime.run', side_effect=[profile, 'trusted pinned key']):
                validate_ssh('private-config')
            with patch('local_release_runtime.run', side_effect=[profile, '']), self.assertRaisesRegex(DeployError, 'host-key-missing'):
                validate_ssh('private-config')

    def test_private_registry_config_preserves_plugins_without_copying_credentials(self):
        original = self.root / 'docker'
        original.mkdir()
        settings = {'cliPluginsExtraDirs': ['/extra/plugins'], 'credsStore': 'desktop', 'auths': {'private.example': {}}}
        (original / 'config.json').write_text(json.dumps(settings))
        context = json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///synthetic/docker.sock'}}}])
        with patch.dict(os.environ, {'DOCKER_CONFIG': str(original), 'DOCKER_CONTEXT': 'desktop-linux', 'GHCR_TOKEN': 'synthetic-token'}), \
             patch('local_release_runtime.run', side_effect=['owner', context]):
            with registry_auth():
                temporary = Path(os.environ['DOCKER_CONFIG'])
                private = json.loads((temporary / 'config.json').read_text())
                self.assertEqual(private['cliPluginsExtraDirs'], ['/extra/plugins', str(original / 'cli-plugins')])
                self.assertNotIn('credsStore', private)
                self.assertEqual(set(private['auths']), {'ghcr.io'})
                self.assertEqual((temporary / 'config.json').stat().st_mode & 0o777, 0o600)
            self.assertFalse(temporary.exists())
            self.assertEqual(os.environ['DOCKER_CONFIG'], str(original))
            self.assertEqual(os.environ['DOCKER_CONTEXT'], 'desktop-linux')
        self.assertEqual(json.loads((original / 'config.json').read_text()), settings)

    def test_test_process_uses_normal_modes_while_its_log_stays_private(self):
        previous = os.umask(0o077)
        try:
            execute([sys.executable, '-c', "from pathlib import Path; Path('public-fixture').mkdir(mode=0o755)"],
                    self.root, os.environ.copy(), self.root / 'check.log')
        finally:
            os.umask(previous)
        self.assertEqual((self.root / 'public-fixture').stat().st_mode & 0o777, 0o755)
        self.assertEqual((self.root / 'check.log').stat().st_mode & 0o777, 0o600)

    def test_cleanup_refuses_unknown_container_even_with_a_matching_name(self):
        fixture = Fixtures(self.root, 'a' * 32)
        atomic_json(fixture.journal, {'identity': fixture.identity, 'database': fixture.database})
        with patch('local_release_runtime.inspect', return_value={'Config': {'Labels': {}}, 'Id': 'unknown'}), \
             patch('local_release_runtime.run') as run, self.assertRaisesRegex(DeployError, 'ownership-mismatch'):
            fixture.cleanup()
        run.assert_not_called()


class ValidatorInstallationTests(unittest.TestCase):
    def exercise(self, broken=False, active=False):
        with tempfile.TemporaryDirectory(prefix='wallpapers-install-test-') as directory:
            root = Path(directory)
            destination, state, operational = root / 'installed', root / 'state', root / 'operational'
            for path in (destination, state, operational): path.mkdir(mode=0o700)
            old = destination / 'scripts/ci-release.py'; old.parent.mkdir()
            old.write_bytes(b'old = True\n'); old.chmod(0o644)
            for name in ('.env', 'compose.yaml'): (operational / name).write_bytes(b'preserved')
            store = Store(state / 'requests')
            if active: store.write({'requestId': 'a' * 32, 'state': 'running'})
            signers = root / 'signers'
            contents = {'scripts/local_evidence.py': b'new = True\n',
                        'scripts/ci-release.py': b'bad syntax!' if broken else b'current = True\n'}
            with patch.object(installer, 'DESTINATION', destination), patch.object(installer, 'STATE', state), \
                 patch.object(installer, 'OPERATIONAL', operational), patch.object(installer, 'SIGNERS', signers), \
                 patch.object(installer, 'allowed_signer', return_value='trusted public signer\n'), \
                 patch.object(installer, 'directory', side_effect=lambda p, mode=0o755: p.mkdir(parents=True, exist_ok=True, mode=mode)), \
                 patch.object(installer, 'app_identity', return_value='container image healthy'), \
                 patch.object(installer, 'run', return_value='wallpapers-release'):
                if broken or active:
                    with self.assertRaises((SyntaxError, DeployError)):
                        installer.update_validator(contents, 'public-only', 'a' * 40)
                    self.assertEqual(old.read_bytes(), b'old = True\n')
                    self.assertFalse(signers.exists())
                    self.assertFalse((destination / 'scripts/local_evidence.py').exists())
                else:
                    snapshot = installer.update_validator(contents, 'public-only', 'a' * 40)
                    self.assertTrue((snapshot / 'manifest.json').exists())
                    self.assertEqual(old.read_bytes(), contents['scripts/ci-release.py'])
                    self.assertEqual(signers.read_text(), 'trusted public signer\n')
                self.assertEqual((operational / '.env').read_bytes(), b'preserved')
                self.assertEqual((operational / 'compose.yaml').read_bytes(), b'preserved')

    def test_success_preserves_operational_files_and_records_recovery(self): self.exercise()
    def test_failed_install_restores_previous_validator_and_trust(self): self.exercise(broken=True)
    def test_active_deployment_blocks_install_before_any_replacement(self): self.exercise(active=True)


class WorkerReadinessTests(unittest.TestCase):
    def test_restore_waits_for_tcp_server_instead_of_temporary_init_socket(self):
        name = 'wallpapers-restore-' + 'd' * 32
        metadata = json.dumps([{'Config': {'Labels': {'foundation.want.wallpapers.restore': name}}}])
        with patch.object(worker.uuid, 'uuid4', return_value=Mock(hex='d' * 32)), \
             patch.object(worker, 'run', side_effect=['container', metadata, 'removed']), \
             patch.object(worker.subprocess, 'run', return_value=Mock(returncode=0)) as ready, \
             patch.object(worker, 'pipeline'), patch.object(worker, 'restored_state', return_value={}):
            worker.restore(Path('/synthetic/ciphertext'), Path('/synthetic/identity'))
        arguments = ready.call_args.args[0]
        self.assertEqual(arguments[arguments.index('-h') + 1], '127.0.0.1')

    def test_readiness_requires_matching_configuration_live_process_and_fresh_heartbeat(self):
        with tempfile.TemporaryDirectory(prefix='wallpapers-worker-test-') as directory:
            config = {'directory': Path(directory), 'databaseId': 'synthetic-database'}
            self.assertFalse(worker.worker_status(config)['ready'])
            worker.heartbeat(config, 'idle')
            self.assertTrue(worker.worker_status(config)['ready'])
            self.assertFalse(worker.worker_status({**config, 'databaseId': 'changed'})['ready'])
            with patch.object(worker.time, 'time', return_value=0):
                self.assertFalse(worker.worker_status(config)['ready'])
            with patch.object(worker, 'run', return_value='different process start'):
                self.assertFalse(worker.worker_status(config)['ready'])


if __name__ == '__main__':
    unittest.main()

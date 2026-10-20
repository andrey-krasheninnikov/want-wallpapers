import importlib.util
import contextlib
import io
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('client', ROOT / 'scripts/deploy-client.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class ClientProtocol(unittest.TestCase):
    def test_private_key_serialization_accepts_trimmed_secret_without_changing_identity(self):
        with tempfile.TemporaryDirectory(prefix='wallpapers-client-key-') as directory:
            source = Path(directory) / 'synthetic_key'
            subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', str(source)], check=True)
            original = source.read_text()
            public = subprocess.run(['ssh-keygen', '-y', '-f', str(source)],
                                    check=True, capture_output=True, text=True).stdout
            record = {'state': 'succeeded'}

            def verified_key(config, *arguments):
                key_path = next(line.strip().split(' ', 1)[1] for line in Path(config).read_text().splitlines()
                                if line.strip().startswith('IdentityFile ')).strip()
                key = Path(key_path)
                self.assertEqual(key.stat().st_mode & 0o777, 0o600)
                result = subprocess.run(['ssh-keygen', '-y', '-f', str(key)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, 'SSH key serialization invalid')
                self.assertEqual(result.stdout, public)
                return record

            for value in (original.rstrip('\r\n'), original):
                environment = {'PRODUCTION_SSH_HOST': '127.0.0.1', 'PRODUCTION_SSH_PORT': '14444',
                               'PRODUCTION_SSH_USER': 'wallpapers-deploy', 'PRODUCTION_SSH_PRIVATE_KEY': value,
                               'PRODUCTION_SSH_KNOWN_HOSTS': 'synthetic host key', 'RUNNER_TEMP': directory}
                with self.subTest(terminal_newline=value.endswith('\n')), \
                     patch.dict(os.environ, environment), \
                     patch.object(sys, 'argv', ['deploy-client.py', 'deploy', '--tag', 'v1.5.0',
                                               '--source', 'a' * 40, '--digest', 'sha256:' + 'b' * 64]), \
                     patch.object(client, 'run', return_value='trusted host entry'), \
                     patch.object(client, 'deploy', side_effect=verified_key), \
                     contextlib.redirect_stdout(io.StringIO()):
                    client.main()

    def test_lost_submit_response_queries_existing_intent_without_resubmitting(self):
        tag, sha, digest = 'v1.5.0', 'a' * 40, 'sha256:' + 'b' * 64
        record = {'requestId': 'c' * 32, 'tag': tag, 'sourceSha': sha, 'indexDigest': digest, 'state': 'succeeded'}
        with patch.object(client, 'transport', side_effect=[client.DeployError('command-unavailable'), record]) as transport:
            self.assertEqual(client.deploy('/unused/config', tag, sha, digest), record)
        self.assertEqual([call.args[1] for call in transport.call_args_list],
                         ['deploy ' + ' '.join((tag, sha, digest)), 'deploy-status ' + ' '.join((tag, sha, digest))])

    def test_resume_queries_terminal_failure_without_new_submission(self):
        tag, sha, digest = 'v1.5.0', 'a' * 40, 'sha256:' + 'b' * 64
        for state in ('failed', 'rolled-back', 'recovery-required', 'succeeded'):
            record = {'requestId': 'c' * 32, 'tag': tag, 'sourceSha': sha, 'indexDigest': digest, 'state': state}
            with self.subTest(state=state), patch.object(client, 'transport', return_value=record) as transport:
                self.assertEqual(client.deploy('/unused/config', tag, sha, digest, resume=True), record)
                transport.assert_called_once_with('/unused/config', 'deploy-status ' + ' '.join((tag, sha, digest)))

    def test_server_failure_remains_failure_and_cannot_substitute_another_release(self):
        tag, sha, digest = 'v1.5.0', 'a' * 40, 'sha256:' + 'b' * 64
        record = {'requestId': 'c' * 32, 'tag': tag, 'sourceSha': sha, 'indexDigest': digest,
                  'state': 'recovery-required', 'errorCode': 'deployment-step-failed'}
        with patch.object(client, 'transport', return_value=record):
            self.assertEqual(client.deploy('/unused/config', tag, sha, digest)['state'], 'recovery-required')
        with patch.object(client, 'transport', return_value={**record, 'indexDigest': 'sha256:' + 'd' * 64}):
            with self.assertRaisesRegex(client.DeployError, 'deployment-intent-mismatch'):
                client.deploy('/unused/config', tag, sha, digest)


if __name__ == '__main__':
    unittest.main()

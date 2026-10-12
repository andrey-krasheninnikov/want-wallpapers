import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('client', ROOT / 'scripts/deploy-client.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class ClientProtocol(unittest.TestCase):
    def test_lost_submit_response_queries_existing_intent_without_resubmitting(self):
        tag, sha, digest = 'v1.5.0', 'a' * 40, 'sha256:' + 'b' * 64
        record = {'requestId': 'c' * 32, 'tag': tag, 'sourceSha': sha, 'indexDigest': digest, 'state': 'succeeded'}
        with patch.object(client, 'transport', side_effect=[client.DeployError('command-unavailable'), record]) as transport:
            self.assertEqual(client.deploy('/unused/config', tag, sha, digest), record)
        self.assertEqual([call.args[1] for call in transport.call_args_list],
                         ['deploy ' + ' '.join((tag, sha, digest)), 'deploy-status ' + ' '.join((tag, sha, digest))])

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

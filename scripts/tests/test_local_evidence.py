"""Verify locally signed release records using isolated disposable signing keys."""
import copy
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from deployment import DeployError
import local_evidence as evidence


def unsigned_record(profile='fast'):
    return {'schemaVersion': 3, 'repository': 'andrey-krasheninnikov/want-wallpapers',
        'sourceSha': 'a' * 40, 'tag': 'v1.9.3', 'verificationProfile': profile,
        'skippedChecks': [] if profile == 'full' else ['Full UI'],
        'platforms': {'linux/' + arch: {'revision': 'a' * 40, 'digest': 'sha256:' + digit * 64,
            'configDigest': 'sha256:' + digit * 64, 'execution': 'native' if arch == 'arm64' else 'emulated'}
            for arch, digit in [('arm64', 'b'), ('amd64', 'c')]},
        'localVerification': {'id': 'd' * 32, 'hostArchitecture': 'arm64', 'sourceTree': 'e' * 40,
            'toolDigest': 'sha256:' + 'f' * 64, 'checks': evidence.required_checks(profile)}}


class LocalSignatureTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wallpapers-signature-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.key = self.root / 'key'
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', str(self.key)], check=True)
        result = subprocess.run(['ssh-agent', '-s'], check=True, text=True, capture_output=True)
        environment = {key: re.search(key + r'=([^;]+);', result.stdout).group(1)
                       for key in ('SSH_AUTH_SOCK', 'SSH_AGENT_PID')}
        self.environment = patch.dict(os.environ, environment)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.addCleanup(lambda: subprocess.run(['ssh-agent', '-k'], env={**os.environ, **environment},
                                              capture_output=True))
        subprocess.run(['ssh-add', str(self.key)], check=True, capture_output=True)
        self.public = self.key.with_suffix('.pub')
        self.signers = self.root / 'allowed_signers'
        self.signers.write_text(evidence.allowed_signer(self.public))
        self.signers.chmod(0o600)

    def signed(self, profile='fast'):
        return evidence.sign(unsigned_record(profile), self.public)

    def test_both_profiles_verify_real_signatures_without_actions_evidence(self):
        for profile in ('full', 'fast'):
            record = self.signed(profile)
            evidence.verify(record, 'v1.9.3', 'a' * 40, self.signers)
            self.assertNotIn('verificationRun', record)
            self.assertEqual(record['platforms']['linux/amd64']['execution'], 'emulated')

    def test_tampered_identity_profile_or_image_is_rejected(self):
        original = self.signed()
        changes = [('sourceSha', '0' * 40), ('tag', 'v9.0.0'), ('verificationProfile', 'full'),
                   ('skippedChecks', []), ('repository', 'other/repository')]
        for key, value in changes:
            changed = {**original, key: value}
            with self.subTest(key=key), self.assertRaises(DeployError):
                evidence.verify(changed, 'v1.9.3', 'a' * 40, self.signers)
        changed = copy.deepcopy(original)
        changed['platforms']['linux/amd64']['digest'] = 'sha256:' + '0' * 64
        with self.assertRaises(DeployError):
            evidence.verify(changed, 'v1.9.3', 'a' * 40, self.signers)

    def test_unknown_signer_wrong_namespace_or_missing_signature_is_rejected(self):
        record = self.signed()
        other = self.root / 'other'
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', str(other)], check=True)
        self.signers.write_text(evidence.allowed_signer(other.with_suffix('.pub')))
        with self.assertRaises(DeployError):
            evidence.verify(record, 'v1.9.3', 'a' * 40, self.signers)
        self.signers.write_text(evidence.allowed_signer(self.public))
        wrong = subprocess.run(['ssh-keygen', '-Y', 'sign', '-f', str(self.public), '-n', 'different-release'],
                               input=evidence.payload(record), check=True, capture_output=True, text=True).stdout.strip()
        for signature in ('', wrong, record['signature'].replace('A', 'B'), 'x' * 9000):
            with self.subTest(size=len(signature)), self.assertRaises(DeployError):
                evidence.verify({**record, 'signature': signature}, 'v1.9.3', 'a' * 40, self.signers)

    def test_signing_refuses_missing_checks_unknown_fields_or_wrong_execution(self):
        changes = []
        missing = unsigned_record(); missing['localVerification']['checks'].remove('Audit'); changes.append(missing)
        extra = unsigned_record(); extra['verificationRun'] = {'id': 1}; changes.append(extra)
        wrong = unsigned_record(); wrong['platforms']['linux/amd64']['execution'] = 'native'; changes.append(wrong)
        incomplete = unsigned_record(); del incomplete['platforms']['linux/arm64']; changes.append(incomplete)
        for record in changes:
            with self.subTest(record=record), self.assertRaises(DeployError):
                evidence.sign(record, self.public)

    def test_resolver_accepts_local_proof_without_reading_any_actions_run(self):
        spec = importlib.util.spec_from_file_location('local_contract_test', Path(__file__).resolve().parents[1] / 'ci-release.py')
        contract = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(contract)
        record = self.signed()
        index_digest = 'sha256:' + '9' * 64
        index = {'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json',
                 'annotations': {contract.ANNOTATION: json.dumps(record)}, 'manifests': [
                     {'digest': checked['digest'], 'platform': {'os': 'linux', 'architecture': platform.split('/')[1]}}
                     for platform, checked in record['platforms'].items()]}

        def registry(reference, output='--raw'):
            if reference.endswith(index_digest):
                return index_digest if output == '{{.Manifest.Digest}}' else index
            platform = next(platform for platform, value in record['platforms'].items() if reference.endswith(value['digest']))
            if output == '{{json .Image}}':
                return {'os': 'linux', 'architecture': platform.split('/')[1],
                        'config': {'Labels': {'org.opencontainers.image.revision': 'a' * 40}}}
            return {'config': {'digest': record['platforms'][platform]['configDigest']}}

        def api(path, **kwargs):
            self.assertEqual(path, 'git/commits/' + 'a' * 40)
            return {'tree': {'sha': 'e' * 40}}

        with patch.object(contract, 'registry', side_effect=registry), patch.object(contract, 'api', side_effect=api), \
             patch.object(contract, 'tag_commit', return_value='a' * 40), \
             patch.object(contract, 'successful_attempt', side_effect=AssertionError('Actions must not be queried')):
            resolved = contract.resolve(argparse.Namespace(tag='v1.9.3', digest=index_digest, timeout=0), local_signers=self.signers)
            self.assertEqual(resolved['indexDigest'], index_digest)
            self.assertEqual(resolved['localVerification'], record['localVerification'])
            with patch.object(contract, 'api', return_value={'tree': {'sha': '0' * 40}}), self.assertRaises(contract.ReleaseError):
                contract.resolve(argparse.Namespace(tag='v1.9.3', digest=index_digest, timeout=0), local_signers=self.signers)

    def test_signing_requires_key_loaded_in_ssh_agent(self):
        subprocess.run(['ssh-add', '-D'], check=True, capture_output=True)
        with self.assertRaises(DeployError):
            evidence.sign(unsigned_record(), self.public)


if __name__ == '__main__':
    unittest.main()

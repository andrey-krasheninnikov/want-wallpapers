"""Sign and verify the immutable local release statement with OpenSSH."""
import json
import os
from pathlib import Path
import tempfile

from deployment import REPOSITORY, matches, require, run

NAMESPACE = 'want-wallpapers-release-v1'
PRINCIPAL = 'wallpapers-release'
SIGNERS = Path('/etc/want-wallpapers/release-signers')
PLATFORMS = {'linux/amd64', 'linux/arm64'}


def required_checks(profile):
    require(profile in ('full', 'fast'), 'unknown-local-profile')
    return ['Static', 'Unit/API', 'Audit', 'Collection drafts', 'Runtime (amd64)', 'Runtime (arm64)'] + (
        ['Full UI'] if profile == 'full' else [])


def payload(record):
    return json.dumps({key: value for key, value in record.items() if key != 'signature'},
                      sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n'


def validate(record, tag, sha):
    require(isinstance(record, dict) and set(record) == {'schemaVersion', 'repository', 'sourceSha', 'tag',
            'verificationProfile', 'skippedChecks', 'platforms', 'localVerification', 'signature'}, 'local-record-fields')
    require(type(record['schemaVersion']) is int and record['schemaVersion'] == 3
            and record['repository'] == REPOSITORY and record['tag'] == tag and record['sourceSha'] == sha
            and matches(r'v[0-9]+\.[0-9]+\.[0-9]+', tag) and matches(r'[0-9a-f]{40}', sha), 'local-record-identity')
    profile = record['verificationProfile']
    checks = required_checks(profile)
    require(record['skippedChecks'] == ([] if profile == 'full' else ['Full UI']), 'local-profile-mismatch')
    verification = record['localVerification']
    require(isinstance(verification, dict) and set(verification) == {'id', 'hostArchitecture', 'sourceTree',
            'toolDigest', 'checks'} and matches(r'[0-9a-f]{32}', verification['id'])
            and matches(r'[0-9a-f]{40}', verification['sourceTree'])
            and matches(r'sha256:[0-9a-f]{64}', verification['toolDigest'])
            and verification['hostArchitecture'] in ('amd64', 'arm64') and verification['checks'] == checks,
            'local-verification-incomplete')
    require(isinstance(record['platforms'], dict) and set(record['platforms']) == PLATFORMS, 'local-platforms-incomplete')
    for platform, checked in record['platforms'].items():
        require(isinstance(checked, dict) and set(checked) == {'digest', 'configDigest', 'revision', 'execution'}
                and matches(r'sha256:[0-9a-f]{64}', checked['digest'])
                and matches(r'sha256:[0-9a-f]{64}', checked['configDigest']) and checked['revision'] == sha
                and checked['execution'] == ('native' if platform == 'linux/' + verification['hostArchitecture'] else 'emulated'),
                'local-platform-identity')


def allowed_signer(public_key):
    path = Path(public_key)
    require(path.is_file() and not path.is_symlink() and path.stat().st_mode & 0o022 == 0, 'release-public-key-missing')
    fields = path.read_text().strip().split()
    require(len(fields) in (2, 3) and fields[0] == 'ssh-ed25519'
            and matches(r'[A-Za-z0-9+/]+=*', fields[1]), 'invalid-release-public-key')
    run(['ssh-keygen', '-l', '-f', str(path)])
    return PRINCIPAL + ' namespaces="' + NAMESPACE + '" ' + ' '.join(fields[:2]) + '\n'


def sign(record, public_key):
    require('signature' not in record, 'already-signed-local-record')
    signed = {**record, 'signature': ''}
    validate(signed, signed['tag'], signed['sourceSha'])
    allowed_signer(public_key)
    # A public key forces use of the loaded SSH identity; no private key is opened here.
    run(['ssh-add', '-T', str(public_key)])
    signed['signature'] = run(['ssh-keygen', '-Y', 'sign', '-f', str(public_key), '-n', NAMESPACE], input=payload(signed)).strip()
    return signed


def verify(record, tag, sha, signers=None):
    validate(record, tag, sha)
    signature = record['signature']
    require(isinstance(signature, str) and 0 < len(signature) <= 8192
            and signature.startswith('-----BEGIN SSH SIGNATURE-----\n')
            and signature.endswith('-----END SSH SIGNATURE-----'), 'invalid-local-signature')
    trusted = Path(signers) if signers is not None else SIGNERS
    require(trusted.is_file() and not trusted.is_symlink() and trusted.stat().st_uid == os.geteuid()
            and trusted.stat().st_mode & 0o022 == 0, 'release-signers-not-protected')
    with tempfile.TemporaryDirectory(prefix='wallpapers-signature-') as directory:
        path = Path(directory) / 'signature'
        path.write_text(signature + '\n')
        path.chmod(0o600)
        run(['ssh-keygen', '-Y', 'verify', '-f', str(trusted), '-I', PRINCIPAL, '-n', NAMESPACE,
             '-s', str(path)], input=payload(record))

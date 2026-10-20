#!/usr/bin/env python3
"""Verify, publish and resume a protected release locally without dispatching Actions."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, Store, atomic_json, matches, private_file, require, run
from local_evidence import allowed_signer, required_checks, sign
from local_release_runtime import Fixtures, backup_worker, execute, inspect, registry_auth, validate_ssh

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('local_release_contract', ROOT / 'scripts/ci-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
spec = importlib.util.spec_from_file_location('local_deploy_client', ROOT / 'scripts/deploy-client.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)
BUILD_KEYS = {'PUBLIC_FIREBASE_API_KEY', 'PUBLIC_FIREBASE_PROJECT_ID', 'PUBLIC_FIREBASE_APP_ID', 'PUBLIC_FIREBASE_MEASUREMENT_ID'}


def configuration(path):
    path = private_file(Path(path).expanduser())
    value = json.loads(path.read_text())
    require(isinstance(value, dict) and set(value) <= {'signingPublicKey', 'sshConfig', 'backupConfig', 'buildEnvironment'}
            and {'signingPublicKey', 'sshConfig', 'backupConfig'} <= set(value), 'invalid-local-release-config')
    for key in ('sshConfig', 'backupConfig'):
        value[key] = str(private_file(Path(value[key]).expanduser()))
    value['signingPublicKey'] = str(Path(value['signingPublicKey']).expanduser())
    require(value['signingPublicKey'].endswith('.pub'), 'public-signing-key-required')
    allowed_signer(value['signingPublicKey'])
    build = value.get('buildEnvironment', {})
    require(isinstance(build, dict) and set(build) <= BUILD_KEYS
            and all(isinstance(item, str) and '\x00' not in item for item in build.values()), 'invalid-public-build-environment')
    validate_ssh(value['sshConfig'])
    value['buildEnvironment'] = build
    return value


def git(source, *arguments):
    return run(['git', '-C', str(source), *arguments]).strip()


def host_architecture():
    architecture = {'arm64': 'arm64', 'aarch64': 'arm64', 'x86_64': 'amd64', 'amd64': 'amd64'}.get(platform.machine())
    require(platform.system() == 'Darwin' and architecture is not None, 'macos-release-host-required')
    return architecture


def tool_digest():
    digest = hashlib.sha256()
    for name in ('local-release.py', 'local_evidence.py', 'local_release_runtime.py', 'ci-release.py', 'deployment.py',
                 'deploy-client.py', 'backup-worker.py', 'test-container.py'):
        digest.update(name.encode())
        digest.update((ROOT / 'scripts' / name).read_bytes())
    return 'sha256:' + digest.hexdigest()


def verification_identity(source, sha, config):
    require(git(source, 'rev-parse', 'HEAD') == sha and not git(source, 'status', '--porcelain'), 'clean-tag-checkout-required')
    architecture = host_architecture()
    docker = json.loads(run(['docker', 'info', '--format', '{{json .}}']))
    actual = {'aarch64': 'arm64', 'arm64': 'arm64', 'x86_64': 'amd64', 'amd64': 'amd64'}.get(docker['Architecture'])
    require(docker['OSType'] == 'linux' and actual == architecture, 'local-linux-docker-required')
    versions = [run([tool, '--version']).strip() for tool in ('bun', 'rustc', 'cargo-audit')]
    require(versions[0] == '1.3.14' and versions[1].startswith('rustc 1.93.0')
            and versions[2] == 'cargo-audit 0.22.2', 'reviewed-local-toolchain-required')
    versions += [run([tool, '-version']).splitlines()[0] for tool in ('ffmpeg', 'ffprobe')]
    inputs = {'sourceSha': sha, 'sourceTree': git(source, 'rev-parse', 'HEAD^{tree}'), 'toolDigest': tool_digest(),
              'hostArchitecture': architecture, 'buildEnvironment': config['buildEnvironment'], 'versions': versions,
              'dockerVersion': docker['ServerVersion'], 'dockerContext': run(['docker', 'context', 'show']).strip()}
    checked_inputs = {key: value for key, value in inputs.items() if key != 'sourceSha'}
    fingerprint = hashlib.sha256(json.dumps(checked_inputs, sort_keys=True).encode()).hexdigest()
    return fingerprint, inputs


def load_state(directory, tag, sha, profile):
    path = directory / 'release.json'
    if path.exists():
        value = json.loads(private_file(path).read_text())
        require((value['tag'], value['verificationProfile']) == (tag, profile), 'local-release-intent-mismatch')
        if value['sourceSha'] != sha:
            require(not value['images'] and not value['platforms'] and not value.get('indexIntent'), 'local-release-source-already-bound')
            value['sourceSha'] = sha
        return value
    value = {'id': uuid.uuid4().hex, 'tag': tag, 'sourceSha': sha, 'verificationProfile': profile,
             'stages': [], 'images': {}, 'platforms': {}}
    atomic_json(path, value)
    return value


def save(directory, state):
    atomic_json(directory / 'release.json', state)


def image_config_digest(image):
    descriptor = image.get('Descriptor')
    if descriptor is None:
        return release.digest(image['Id'])
    # Containerd exposes a manifest ID; the checked filesystem belongs to its config.
    require(descriptor.get('digest') == image['Id'] and descriptor.get('mediaType') in
            ('application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.oci.image.manifest.v1+json'),
            'local-image-descriptor-mismatch')
    return release.digest(descriptor.get('annotations', {}).get('config.digest'))


def image_identity(reference, state, architecture):
    image = inspect('image', reference)
    require(image is not None and image['Os'] == 'linux' and image['Architecture'] == architecture
            and image['Config']['Labels'].get('org.opencontainers.image.revision') == state['sourceSha']
            and image['Config']['Labels'].get('foundation.want.wallpapers.local-release') == state['id'], 'local-image-identity-mismatch')
    return image_config_digest(image)


def prepare(source, directory, state, config, *, build_images=True):
    fingerprint, inputs = verification_identity(source, state['sourceSha'], config)
    require(state.get('inputFingerprint', fingerprint) == fingerprint, 'local-verification-inputs-changed')
    state.update(inputFingerprint=fingerprint, inputs=inputs)
    save(directory, state)
    require(os.statvfs(source).f_bavail * os.statvfs(source).f_frsize > 0, 'local-storage-unavailable')
    environment = {key: value for key, value in os.environ.items() if not key.startswith('GITHUB_') and key not in BUILD_KEYS}
    environment.update(config['buildEnvironment'])
    environment['ASTRO_TELEMETRY_DISABLED'] = '1'
    environment['BUN_OPTIONS'] = '--timeout=30000'
    environment['RUST_TEST_THREADS'] = '2'
    fixtures = Fixtures(directory / 'fixtures', state['id'])
    fixtures.cleanup()
    complete = set(required_checks(state['verificationProfile']) + ['Install'])
    if not build_images:
        complete -= {'Runtime (amd64)', 'Runtime (arm64)'}
    else:
        complete.update(('Build (arm64)', 'Build (amd64)'))
    if complete <= set(state['stages']):
        if build_images:
            require(set(state['images']) == {'arm64', 'amd64'}, 'local-images-incomplete')
        for architecture, checked in state['images'].items():
            require(image_identity(checked['reference'], state, architecture) == checked['configDigest'], 'checked-local-image-changed')
        return state
    try:
        environment = fixtures.start(source, environment)
        steps = [('Install', ['make', 'install']), ('Static', ['make', 'check']), ('Unit/API', ['make', 'test']),
                 ('Audit', ['make', 'audit']), ('Collection drafts', ['make', 'test-generation'])]
        if state['verificationProfile'] == 'full':
            steps.append(('Full UI', ['make', 'test-ui']))
        for label, arguments in steps:
            if label not in state['stages']:
                print(label, flush=True)
                execute(arguments, source, environment, directory / (label.replace('/', '-') + '.log'))
                state['stages'].append(label)
                save(directory, state)
        if not build_images:
            return state
        for architecture, nonce in zip(('arm64', 'amd64'), fixtures.nonces):
            reference = 'want-wallpapers-release:' + state['id'] + '-' + architecture
            build = 'Build (' + architecture + ')'
            if build not in state['stages']:
                arguments = ['docker', 'build', '--platform', 'linux/' + architecture, '--provenance=false', '--sbom=false',
                    '--build-arg', 'VCS_REF=' + state['sourceSha'], '--label', 'foundation.want.wallpapers.local-release=' + state['id'],
                    '--tag', reference]
                for key in sorted(BUILD_KEYS):
                    arguments += ['--build-arg', key]
                execute([*arguments, '.'], source, environment, directory / ('build-' + architecture + '.log'))
                state['images'][architecture] = {'reference': reference, 'configDigest': image_identity(reference, state, architecture)}
                state['stages'].append(build)
                save(directory, state)
            checked = state['images'][architecture]
            require(image_identity(checked['reference'], state, architecture) == checked['configDigest'], 'checked-local-image-changed')
            label = 'Runtime (' + architecture + ')'
            if label not in state['stages']:
                runtime = {**environment, 'TEST_APP_IMAGE': reference, 'TEST_RUNTIME_ID': nonce, 'TEST_SOURCE_ROOT': str(source)}
                execute(['python3', '-B', str(ROOT / 'scripts/test-container.py')], source, runtime, directory / ('runtime-' + architecture + '.log'))
                state['stages'].append(label)
                save(directory, state)
        require(verification_identity(source, state['sourceSha'], config)[0] == fingerprint, 'local-verification-inputs-changed')
    finally:
        fixtures.cleanup()
    return state


def remote_manifest(reference):
    result = subprocess.run(['docker', 'buildx', 'imagetools', 'inspect', reference, '--raw'],
                            capture_output=True, text=True, timeout=60)
    if result.returncode:
        require('not found' in result.stderr.lower() or 'manifest unknown' in result.stderr.lower(), 'registry-state-unavailable')
        return None
    return json.loads(result.stdout)


def publish(source, directory, state, config):
    Fixtures(directory / 'fixtures', state['id']).cleanup()
    require(verification_identity(source, state['sourceSha'], config)[0] == state['inputFingerprint'], 'local-verification-inputs-changed')
    require(set(required_checks(state['verificationProfile'])) <= set(state['stages']), 'local-verification-incomplete')
    trusted = directory / 'release-signers'
    trusted.write_text(allowed_signer(config['signingPublicKey']))
    trusted.chmod(0o600)
    with registry_auth() as (actor, token):
        for architecture in ('arm64', 'amd64'):
            checked = state['images'][architecture]
            reference = release.IMAGE + ':local-' + state['id'] + '-' + architecture
            state.setdefault('publicationIntents', {})[architecture] = reference
            save(directory, state)
            manifest = remote_manifest(reference)
            if manifest is None:
                require(image_identity(checked['reference'], state, architecture) == checked['configDigest'], 'checked-local-image-changed')
                run(['docker', 'tag', checked['reference'], reference])
                execute(['docker', 'push', reference], source, os.environ.copy(), directory / ('publish-' + architecture + '.log'))
                manifest = release.registry(reference)
            require(manifest.get('config', {}).get('digest') == checked['configDigest'], 'published-local-image-mismatch')
            digest = release.digest(release.registry(reference, '{{.Manifest.Digest}}'))
            state['platforms']['linux/' + architecture] = {'digest': digest, 'configDigest': checked['configDigest'],
                'revision': state['sourceSha'], 'execution': 'native' if architecture == state['inputs']['hostArchitecture'] else 'emulated'}
            save(directory, state)
        if 'signedRecord' not in state:
            state['signedRecord'] = sign({'schemaVersion': 3, 'repository': release.REPOSITORY,
                'sourceSha': state['sourceSha'], 'tag': state['tag'], 'platforms': state['platforms'],
                'verificationProfile': state['verificationProfile'], 'skippedChecks': release.PROFILES[state['verificationProfile']],
                'localVerification': {'id': state['id'], 'hostArchitecture': state['inputs']['hostArchitecture'],
                    'sourceTree': state['inputs']['sourceTree'], 'toolDigest': state['inputs']['toolDigest'],
                    'checks': required_checks(state['verificationProfile'])}}, config['signingPublicKey'])
            save(directory, state)
        reference = release.IMAGE + ':local-' + state['id']
        state['indexIntent'] = reference
        save(directory, state)
        manifest = remote_manifest(reference)
        if manifest is None:
            state['indexDigest'] = release.publish_oci_index(state['signedRecord'], 'local-' + state['id'], actor, token)
            save(directory, state)
        else:
            require(json.loads(manifest.get('annotations', {}).get(release.ANNOTATION, '{}')) == state['signedRecord'], 'local-index-intent-mismatch')
            state['indexDigest'] = release.digest(release.registry(reference, '{{.Manifest.Digest}}'))
            save(directory, state)
        resolved = release.resolve(argparse.Namespace(tag=state['tag'], digest=state['indexDigest'], timeout=0), local_signers=trusted)
        require(resolved['platforms'] == state['platforms'], 'published-local-platforms-changed')
        state['published'] = True
        save(directory, state)
    cleanup_images(state)
    state['localImagesRemoved'] = True
    save(directory, state)
    return state



def cleanup_images(state):
    for architecture, checked in state['images'].items():
        references = [checked['reference'], release.IMAGE + ':local-' + state['id'] + '-' + architecture]
        for reference in references:
            image = inspect('image', reference)
            if image is None:
                continue
            require(image_config_digest(image) == checked['configDigest']
                    and image['Config']['Labels'].get('foundation.want.wallpapers.local-release') == state['id'],
                    'local-image-cleanup-ownership')
            run(['docker', 'image', 'rm', reference])


def deploy(directory, state, config):
    require(state.get('published') and state.get('indexDigest'), 'verified-publication-required')
    resume = bool(state.get('deploymentIntent') or state.get('deployment'))
    state['deploymentIntent'] = True
    save(directory, state)
    with backup_worker(config['backupConfig'], directory / 'backup-worker.log'):
        state['deployment'] = client.deploy(config['sshConfig'], state['tag'], state['sourceSha'], state['indexDigest'], resume=resume)
        save(directory, state)
    require(state['deployment']['state'] == 'succeeded', 'production-deployment-not-successful')
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('check', 'prepare', 'publish', 'deploy', 'status'))
    parser.add_argument('--tag', required=True)
    parser.add_argument('--profile', choices=('full', 'fast'), default='full')
    parser.add_argument('--source-root', type=Path, default=ROOT)
    parser.add_argument('--config', type=Path, default=Path.home() / '.config/want-wallpapers/local-release/config.json')
    parser.add_argument('--state-root', type=Path, default=Path.home() / '.local/state/want-wallpapers/releases')
    parser.add_argument('--publish', action='store_true', help='Publish after successful prepare; never deploy implicitly')
    arguments = parser.parse_args()
    require(matches(r'v[0-9]+\.[0-9]+\.[0-9]+', arguments.tag), 'semantic-release-tag-required')
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    root = arguments.state_root.expanduser()
    directory = root / arguments.tag
    if arguments.mode == 'status':
        print(private_file(directory / 'release.json').read_text())
        return
    config = configuration(arguments.config)
    root_store = Store(root)
    directory_store = Store(directory)
    with root_store.lock('deployment', blocking=False):
        sha = git(arguments.source_root, 'rev-parse', 'HEAD') if arguments.mode == 'check' else release.tag_commit(arguments.tag)
        state = load_state(directory_store.root, arguments.tag, sha, arguments.profile)
        if arguments.mode == 'check':
            require(not arguments.publish, 'check-cannot-publish')
            prepare(arguments.source_root.resolve(), directory, state, config, build_images=False)
        elif arguments.mode == 'prepare':
            if state.get('published'):
                Fixtures(directory / 'fixtures', state['id']).cleanup()
                release.resolve(argparse.Namespace(tag=state['tag'], digest=state['indexDigest'], timeout=0),
                                local_signers=directory / 'release-signers')
                cleanup_images(state)
            else:
                prepare(arguments.source_root.resolve(), directory, state, config)
                if arguments.publish:
                    publish(arguments.source_root.resolve(), directory, state, config)
        elif arguments.mode == 'publish':
            publish(arguments.source_root.resolve(), directory, state, config)
        else:
            deploy(directory, state, config)
        print(json.dumps({key: state[key] for key in ('tag', 'sourceSha', 'verificationProfile', 'indexDigest', 'published', 'deployment') if key in state}, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except (DeployError, release.ReleaseError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, (DeployError, release.ReleaseError)) else 'local-release-failed'}))
        sys.exit(1)

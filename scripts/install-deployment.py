#!/usr/bin/env python3
"""Operator-only installation of a reviewed fixed-profile deployment mechanism."""
import argparse
import os
from pathlib import Path
import pwd
import hashlib
import json
import uuid
import subprocess
import signal
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, Store, TERMINAL, atomic_bytes, atomic_json, matches, require, run
from local_evidence import SIGNERS, allowed_signer

SOURCE = Path(__file__).resolve().parent.parent
DESTINATION = Path('/usr/local/lib/wallpapers-deploy')
FILES = ('scripts/deployment.py', 'scripts/ci-release.py', 'scripts/ssh-deploy.py', 'scripts/deploy-server.py',
         'deploy/backup-state.sql', 'deploy/runtime-grants.sql', 'deploy/verify-runtime-grants.sql', '.github/release-policy.json')
FILES += ('deploy/migrate-override.yaml', 'scripts/local_evidence.py')
FILES += ('scripts/distribution-export.py', 'scripts/distribution-run.py', 'deploy/distribution-grants.sql', 'deploy/verify-distribution-grants.sql')


def directory(path, mode=0o755):
    path.mkdir(parents=True, mode=mode, exist_ok=True)
    require(not path.is_symlink() and path.stat().st_uid == 0 and path.stat().st_mode & 0o022 == 0,
            'installation-directory-not-protected')


def public_key(path):
    value = Path(path).read_text().strip().split()
    require(len(value) >= 2 and value[0] == 'ssh-ed25519' and matches(r'[A-Za-z0-9+/]+=*', value[1]), 'invalid-public-key')
    run(['/usr/bin/ssh-keygen', '-l', '-f', str(path)])
    return 'restrict ' + ' '.join(value[:2]) + '\n'


def ssh_configuration():
    blocks = []
    for account, actor in (('wallpapers-deploy', 'ci'), ('wallpapers-backup', 'worker')):
        blocks.append(f'Match User {account}\n'
                      f'    AllowUsers {account}\n'
                      '    AuthenticationMethods publickey\n    PasswordAuthentication no\n'
                      '    KbdInteractiveAuthentication no\n    PermitTTY no\n    DisableForwarding yes\n'
                      '    PermitUserRC no\n    AuthorizedKeysFile /etc/ssh/wallpapers-keys/%u\n'
                      f'    ForceCommand /usr/bin/python3 -I {DESTINATION}/scripts/ssh-deploy.py {actor}\n')
    return ('\n'.join(blocks) + '\nMatch all\n').encode()



STATE = Path('/var/lib/want-deploy/wallpapers')
OPERATIONAL = Path('/opt/want/apps/wallpapers-v1.1.0/deploy')


def app_identity():
    return run(['/usr/bin/docker', 'inspect', 'want-wallpapers-app-1', '--format',
                '{{.Id}} {{.Image}} {{.State.Health.Status}}']).strip()


def update_validator(contents, release_key, source):
    require(DESTINATION.is_dir() and STATE.is_dir(), 'existing-validator-required')
    signer = allowed_signer(release_key).encode()
    files = {DESTINATION / name: body for name, body in contents.items()}
    files[SIGNERS] = signer
    store = Store(STATE / 'requests')
    with store.lock('deployment', blocking=False), store.lock(blocking=False):
        require(all(record['state'] in TERMINAL and record['state'] != 'recovery-required'
                    for record in store.records()), 'active-deployment-blocks-installation')
        directory(DESTINATION)
        directory(SIGNERS.parent)
        preserved = {path: path.read_bytes() for path in (OPERATIONAL / '.env', OPERATIONAL / 'compose.yaml')}
        identity = app_identity()
        require(identity.split()[-1:] == ['healthy'], 'current-app-unhealthy')
        previous = {}
        for path in files:
            require(not path.is_symlink(), 'installation-target-symlink')
            if path.exists():
                stat = path.stat()
                require(stat.st_uid == os.geteuid() and stat.st_mode & 0o022 == 0, 'installation-target-not-protected')
                previous[path] = (path.read_bytes(), stat.st_mode & 0o777)
            else:
                previous[path] = None
        backup = STATE / 'installations' / uuid.uuid4().hex
        backup.mkdir(mode=0o700, parents=True)
        manifest = []
        for number, (path, value) in enumerate(previous.items()):
            entry = {'path': str(path), 'existed': value is not None}
            if value is not None:
                body, mode = value
                filename = str(number)
                atomic_bytes(backup / filename, body)
                entry.update(file=filename, mode=mode, sha256=hashlib.sha256(body).hexdigest())
            manifest.append(entry)
        atomic_json(backup / 'manifest.json', {'sourceSha': source, 'files': manifest})
        try:
            # Add the new dependency before atomically replacing any existing consumer.
            ordered = sorted(files, key=lambda path: path.name != 'local_evidence.py')
            for path in ordered:
                directory(path.parent)
                atomic_bytes(path, files[path])
                path.chmod(0o644)
            for path, body in files.items():
                require(path.read_bytes() == body, 'installed-file-mismatch')
                if path.suffix == '.py':
                    compile(body, str(path), 'exec')
            run(['/usr/bin/ssh-keygen', '-Y', 'match-principals', '-I', 'wallpapers-release', '-f', str(SIGNERS)])
            require(app_identity() == identity and all(path.read_bytes() == body for path, body in preserved.items()),
                    'operational-state-changed')
        except BaseException:
            for path, value in previous.items():
                if value is None:
                    path.unlink(missing_ok=True)
                else:
                    atomic_bytes(path, value[0])
                    path.chmod(value[1])
            raise
        return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Exact reviewed and published source commit')
    parser.add_argument('--ci-key', help='CI public key file; never the private key')
    parser.add_argument('--worker-key', help='Mac worker public key file')
    parser.add_argument('--release-key', help='Dedicated local release public key')
    parser.add_argument('--update-only', action='store_true', help='Update the existing validator without changing SSH or operational configuration')
    arguments = parser.parse_args()
    require(os.geteuid() == 0 and matches(r'[0-9a-f]{40}', arguments.source), 'reviewed-root-installation-required')
    for number in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(number, lambda received, _: sys.exit(128 + received))
    environment = {'PATH': '/usr/bin:/bin', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null'}
    git = ['/usr/bin/git', '-c', 'safe.directory=' + str(SOURCE), '-C', str(SOURCE)]
    require(run([*git, 'rev-parse', 'HEAD'], env=environment).strip() == arguments.source, 'installation-source-mismatch')
    contents = {name: run([*git, 'show', arguments.source + ':' + name], env=environment).encode() for name in FILES}
    if arguments.update_only:
        require(arguments.release_key and not arguments.ci_key and not arguments.worker_key, 'validator-update-arguments')
        snapshot = update_validator(contents, arguments.release_key, arguments.source)
        print(json.dumps({'status': 'installed', 'sourceSha': arguments.source, 'snapshot': str(snapshot)}))
        return
    require(not arguments.release_key, 'release-key-requires-update-only')
    require(arguments.ci_key and arguments.worker_key, 'initial-ssh-public-keys-required')
    keys = {'wallpapers-deploy': public_key(arguments.ci_key), 'wallpapers-backup': public_key(arguments.worker_key)}
    require(keys['wallpapers-deploy'] != keys['wallpapers-backup'], 'separate-ssh-keys-required')
    run(['/usr/bin/psql', '--version'])
    run(['/usr/bin/docker', 'compose', 'version'])
    require('sshd_config.d' in Path('/etc/ssh/sshd_config').read_text(), 'sshd-dropin-include-required')
    directory(DESTINATION)
    for name, body in contents.items():
        path = DESTINATION / name
        directory(path.parent)
        atomic_bytes(path, body)
        path.chmod(0o644)
    for account in keys:
        home = '/var/empty/' + account
        try:
            entry = pwd.getpwnam(account)
            require(entry.pw_dir == home and entry.pw_shell == '/bin/sh', 'existing-account-profile-mismatch')
        except KeyError:
            run(['/usr/sbin/useradd', '--system', '--home-dir', home, '--shell', '/bin/sh', account])
        directory(Path(home))
        directory(Path('/etc/ssh/wallpapers-keys'))
        path = Path('/etc/ssh/wallpapers-keys') / account
        atomic_bytes(path, keys[account].encode())
        path.chmod(0o644)
    launcher = b'#!/bin/sh\nexec /usr/bin/python3 -I /usr/local/lib/wallpapers-deploy/scripts/deploy-server.py "$@"\n'
    atomic_bytes(Path('/usr/local/sbin/wallpapers-deploy'), launcher)
    Path('/usr/local/sbin/wallpapers-deploy').chmod(0o755)
    sudoers = ('wallpapers-deploy ALL=(root) NOPASSWD: /usr/local/sbin/wallpapers-deploy ci *\n'
               'wallpapers-backup ALL=(root) NOPASSWD: /usr/local/sbin/wallpapers-deploy worker *\n')
    candidate = DESTINATION / 'sudoers.candidate'
    atomic_bytes(candidate, sudoers.encode())
    run(['/usr/sbin/visudo', '-c', '-f', str(candidate)])
    atomic_bytes(Path('/etc/sudoers.d/wallpapers-deploy'), sudoers.encode())
    Path('/etc/sudoers.d/wallpapers-deploy').chmod(0o440)
    configuration = Path('/etc/ssh/sshd_config.d/60-wallpapers-deploy.conf')
    previous = configuration.read_bytes() if configuration.exists() else None
    atomic_bytes(configuration, ssh_configuration())
    try:
        run(['/usr/sbin/sshd', '-t'])
        for account, actor in (('wallpapers-deploy', 'ci'), ('wallpapers-backup', 'worker')):
            effective = run(['/usr/sbin/sshd', '-T', '-C', 'user=' + account + ',host=localhost,addr=127.0.0.1'])
            require('\nallowusers ' + account + '\n' in '\n' + effective, 'restricted-account-not-allowed')
            require('forcecommand /usr/bin/python3 -I ' + str(DESTINATION) + '/scripts/ssh-deploy.py ' + actor in effective,
                    'forced-command-not-effective')
        # Existing operational Compose bytes and application container remain untouched.
        for path in (Path('/opt/want/apps/wallpapers-v1.1.0/deploy/.env'), Path('/opt/want/apps/wallpapers-v1.1.0/deploy/compose.yaml')):
            require(not path.is_symlink(), 'operational-profile-symlink')
            os.chown(path, 0, 0)
            path.chmod(0o600)
        directory(Path('/var/lib/want-deploy/wallpapers'), 0o700)
        run(['/usr/bin/systemctl', 'reload', 'ssh'])
    except Exception:
        if previous is None:
            configuration.unlink()
        else:
            atomic_bytes(configuration, previous)
        raise
    print('Restricted deployment installed. Application, database and proxy unchanged.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, DeployError) else 'Deployment installation failed; operator review required.')
        sys.exit(1)

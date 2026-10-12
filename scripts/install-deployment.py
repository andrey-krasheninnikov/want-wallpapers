#!/usr/bin/env python3
"""Operator-only installation of a reviewed fixed-profile deployment mechanism."""
import argparse
import os
from pathlib import Path
import pwd
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, atomic_bytes, matches, require, run

SOURCE = Path(__file__).resolve().parent.parent
DESTINATION = Path('/usr/local/lib/wallpapers-deploy')
FILES = ('scripts/deployment.py', 'scripts/ci-release.py', 'scripts/ssh-deploy.py', 'scripts/deploy-server.py',
         'deploy/backup-state.sql', 'deploy/runtime-grants.sql', 'deploy/verify-runtime-grants.sql', '.github/release-policy.json')
FILES += ('deploy/migrate-override.yaml',)


def directory(path, mode=0o755):
    path.mkdir(parents=True, mode=mode, exist_ok=True)
    require(not path.is_symlink() and path.stat().st_uid == 0 and path.stat().st_mode & 0o022 == 0,
            'installation-directory-not-protected')


def public_key(path):
    value = Path(path).read_text().strip().split()
    require(len(value) >= 2 and value[0] == 'ssh-ed25519' and matches(r'[A-Za-z0-9+/]+=*', value[1]), 'invalid-public-key')
    run(['/usr/bin/ssh-keygen', '-l', '-f', str(path)])
    return 'restrict ' + ' '.join(value[:2]) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Exact reviewed and published source commit')
    parser.add_argument('--ci-key', required=True, help='CI public key file; never the private key')
    parser.add_argument('--worker-key', required=True, help='Mac worker public key file')
    arguments = parser.parse_args()
    require(os.geteuid() == 0 and matches(r'[0-9a-f]{40}', arguments.source), 'reviewed-root-installation-required')
    environment = {'PATH': '/usr/bin:/bin', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null'}
    git = ['/usr/bin/git', '-c', 'safe.directory=' + str(SOURCE), '-C', str(SOURCE)]
    require(run([*git, 'rev-parse', 'HEAD'], env=environment).strip() == arguments.source, 'installation-source-mismatch')
    contents = {name: run([*git, 'show', arguments.source + ':' + name], env=environment).encode() for name in FILES}
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
    blocks = []
    for account, actor in (('wallpapers-deploy', 'ci'), ('wallpapers-backup', 'worker')):
        blocks.append(f'Match User {account}\n'
                      '    AuthenticationMethods publickey\n    PasswordAuthentication no\n'
                      '    KbdInteractiveAuthentication no\n    PermitTTY no\n    DisableForwarding yes\n'
                      '    PermitUserRC no\n    AuthorizedKeysFile /etc/ssh/wallpapers-keys/%u\n'
                      f'    ForceCommand /usr/bin/python3 -I {DESTINATION}/scripts/ssh-deploy.py {actor}\n')
    configuration = Path('/etc/ssh/sshd_config.d/60-wallpapers-deploy.conf')
    previous = configuration.read_bytes() if configuration.exists() else None
    atomic_bytes(configuration, ('\n'.join(blocks) + '\nMatch all\n').encode())
    try:
        run(['/usr/sbin/sshd', '-t'])
        for account, actor in (('wallpapers-deploy', 'ci'), ('wallpapers-backup', 'worker')):
            effective = run(['/usr/sbin/sshd', '-T', '-C', 'user=' + account + ',host=localhost,addr=127.0.0.1'])
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

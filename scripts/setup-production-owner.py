#!/usr/bin/env python3
"""Private terminal provisioning for the production SSH keys and Mac backup worker."""
import argparse
import configparser
import getpass
import json
import netrc
import os
from pathlib import Path
import sys
import subprocess
import warnings

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, atomic_bytes, matches, require, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--postgres-host', required=True)
    parser.add_argument('--postgres-ca', required=True)
    arguments = parser.parse_args()
    require(sys.stdin.isatty() and os.geteuid() != 0, 'private-owner-terminal-required')
    warnings.filterwarnings('error', category=getpass.GetPassWarning)
    require(matches(r'[A-Za-z0-9.:-]+', arguments.postgres_host), 'invalid-postgresql-host')
    root = Path.home() / '.config/want-wallpapers/backup-worker'
    root.mkdir(parents=True, mode=0o700, exist_ok=True)
    require(not root.is_symlink() and root.stat().st_uid == os.getuid() and root.stat().st_mode & 0o077 == 0,
            'private-owner-directory-required')
    for name in ('production-ci', 'backup-ssh'):
        key = root / name
        if not key.exists():
            run(['ssh-keygen', '-t', 'ed25519', '-N', '', '-C', 'want-wallpapers-' + name, '-f', str(key)])
        require(key.stat().st_uid == os.getuid() and key.stat().st_mode & 0o077 == 0, 'private-key-permissions')
    identity = root / 'age-identity'
    if not identity.exists():
        run(['age-keygen', '-o', str(identity)])
        identity.chmod(0o600)
    recipient = run(['age-keygen', '-y', str(identity)]).strip()
    settings = {}
    for line in run(['ssh', '-G', 'wf-landings']).splitlines():
        key, _, value = line.partition(' ')
        settings[key] = value
    host, port = settings['hostname'], settings['port']
    require(matches(r'[A-Za-z0-9.:-]+', host) and port == '14444', 'production-ssh-profile-mismatch')
    entry = run(['ssh-keygen', '-F', '[' + host + ']:' + port,
                 '-f', str(Path.home() / '.ssh/known_hosts')])
    trusted = '\n'.join(line for line in entry.splitlines() if not line.startswith('#')) + '\n'
    require(trusted.strip(), 'trusted-host-key-missing')
    atomic_bytes(root / 'known_hosts', trusted.encode())
    atomic_bytes(root / 'postgres_ca.pem', Path(arguments.postgres_ca).expanduser().read_bytes())
    credential_path = root / 'pgpass'
    if not credential_path.exists():
        password = getpass.getpass('PostgreSQL password for wallpapers-backup (private terminal): ')
        require(password and '\n' not in password and '\r' not in password, 'invalid-postgresql-password')
        escaped = password.replace('\\', '\\\\').replace(':', '\\:')
        atomic_bytes(credential_path, (arguments.postgres_host + ':5432:wallpapers:wallpapers-backup:' + escaped + '\n').encode())
        del password, escaped
    service = ('[wallpapers-backup]\nhost=' + arguments.postgres_host + '\nport=5432\ndbname=wallpapers\n'
               'user=wallpapers-backup\nsslmode=verify-full\nsslrootcert=/run/secrets/postgres_ca\nconnect_timeout=10\n')
    atomic_bytes(root / 'pg_service.conf', service.encode())
    ssh_configuration = (f'Host wallpapers-backup\n  HostName {host}\n  Port {port}\n  User wallpapers-backup\n'
                         f'  IdentityFile {root}/backup-ssh\n  IdentitiesOnly yes\n'
                         f'  UserKnownHostsFile {root}/known_hosts\n  StrictHostKeyChecking yes\n')
    atomic_bytes(root / 'ssh_config', ssh_configuration.encode())
    credentials_file = Path.home() / '.aws/credentials'
    credentials = configparser.ConfigParser(interpolation=None)
    credentials.read(credentials_file)
    profile = 'timeweb-wallpapers-backup'
    if profile not in credentials:
        access = getpass.getpass('Restricted Timeweb S3 Access Key (private terminal): ')
        secret = getpass.getpass('Restricted Timeweb S3 Secret Key (private terminal): ')
        require(access and secret and '\n' not in access + secret, 'invalid-s3-credentials')
        credentials[profile] = {'aws_access_key_id': access, 'aws_secret_access_key': secret}
        previous = credentials_file.read_bytes() if credentials_file.exists() else b''
        section = ('\n[' + profile + ']\naws_access_key_id = ' + access + '\naws_secret_access_key = ' + secret + '\n')
        atomic_bytes(credentials_file, previous + section.encode())
        del access, secret
    config = {'sshConfig': str(root / 'ssh_config'), 'pgServiceFile': str(root / 'pg_service.conf'),
              'pgPassFile': str(root / 'pgpass'), 'postgresCa': str(root / 'postgres_ca.pem'),
              'ageIdentity': str(identity), 'ageRecipient': recipient, 'awsProfile': profile}
    atomic_bytes(root / 'config.json', json.dumps(config, indent=2).encode())
    account = netrc.netrc().authenticators('github.com')
    require(account and account[2], 'github-owner-authentication-required')
    environment = os.environ.copy()
    environment['GH_TOKEN'] = account[2]
    api = ['gh', 'api', 'repos/andrey-krasheninnikov/want-wallpapers/environments/production']
    existing = subprocess.run(api, env=environment, capture_output=True, text=True, timeout=30)
    if existing.returncode:
        require('(HTTP 404)' in existing.stderr, 'production-environment-read-failed')
        run([*api, '--method', 'PUT', '--input', '-'], env=environment,
            input=json.dumps({'deployment_branch_policy': {'protected_branches': False, 'custom_branch_policies': True}}))
    else:
        require(json.loads(existing.stdout)['deployment_branch_policy'] ==
                {'protected_branches': False, 'custom_branch_policies': True},
                'existing-production-environment-requires-review')
    rules = json.loads(run(['gh', 'api',
        'repos/andrey-krasheninnikov/want-wallpapers/environments/production/deployment-branch-policies'], env=environment))
    require(all(rule['type'] == 'tag' and rule['name'] == 'v*' for rule in rules['branch_policies']),
            'existing-production-environment-rules-require-review')
    if not rules['branch_policies']:
        run(['gh', 'api', 'repos/andrey-krasheninnikov/want-wallpapers/environments/production/deployment-branch-policies',
             '--method', 'POST', '--input', '-'], env=environment, input=json.dumps({'name': 'v*', 'type': 'tag'}))
    for key, value in {'PRODUCTION_SSH_HOST': host, 'PRODUCTION_SSH_PORT': port,
                       'PRODUCTION_SSH_USER': 'wallpapers-deploy', 'PRODUCTION_SSH_KNOWN_HOSTS': trusted}.items():
        run(['gh', 'variable', 'set', key, '--env', 'production', '--repo', 'andrey-krasheninnikov/want-wallpapers'],
            input=value, env=environment)
    run(['gh', 'secret', 'set', 'PRODUCTION_SSH_PRIVATE_KEY', '--env', 'production', '--repo',
         'andrey-krasheninnikov/want-wallpapers'], input=(root / 'production-ci').read_text(), env=environment)
    print('Private worker configuration and production GitHub environment prepared.')
    print('Upload only production-ci.pub and backup-ssh.pub to the VPS for the reviewed root installation.')
    print('Save a separate private recovery copy of age-identity before using production backups.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, DeployError) else 'Owner provisioning failed; credentials were not printed.')
        sys.exit(1)

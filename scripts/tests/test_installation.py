import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('install_deployment', ROOT / 'scripts/install-deployment.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallationSshPolicyTests(unittest.TestCase):
    def test_migration_override_removes_legacy_runtime_settings_without_changing_app(self):
        legacy = """services:
  app:
    image: example.invalid/wallpapers@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    user: '10001:10001'
    read_only: true
    mem_limit: 512m
    memswap_limit: 512m
    environment:
      APP_ENV: production
      DATABASE_URL_FILE: /run/secrets/database_url
      PGSSLROOTCERT: /run/secrets/postgres_ca
      ADMIN_PASSWORD_HASH_FILE: /run/secrets/admin_password_hash
    secrets: [database_url, postgres_ca, admin_password_hash]
    networks: [traefik, egress]
  migrate:
    extends: app
    profiles: [operations]
    command: [migrate]
    environment:
      DATABASE_URL_FILE: /run/secrets/migration_database_url
    secrets: [migration_database_url]
networks:
  traefik: {}
  egress: {}
secrets:
  database_url:
    file: /unused/database_url
  migration_database_url:
    file: /unused/migration_database_url
  postgres_ca:
    file: /unused/postgres_ca.pem
  admin_password_hash:
    file: /unused/admin_password_hash
"""
        with tempfile.TemporaryDirectory(prefix='wallpapers-migration-profile-') as directory:
            profile = Path(directory) / 'compose.yaml'
            profile.write_text(legacy)
            command = ['docker', 'compose', '--project-name', 'wallpapers-profile-test',
                       '--profile', 'operations', '-f', str(profile)]
            before = json.loads(subprocess.run([*command, 'config', '--format', 'json'],
                                check=True, capture_output=True, text=True).stdout)
            after = json.loads(subprocess.run([*command, '-f', str(ROOT / 'deploy/migrate-override.yaml'),
                               'config', '--format', 'json'], check=True, capture_output=True, text=True).stdout)
            self.assertEqual(after['services']['app'], before['services']['app'])
            migration = after['services']['migrate']
            self.assertEqual(set(migration['networks']), {'egress'})
            self.assertEqual(migration['environment'], {'APP_ENV': 'production',
                             'DATABASE_URL_FILE': '/run/secrets/migration_database_url',
                             'PGSSLROOTCERT': '/run/secrets/postgres_ca'})
            self.assertEqual({secret['source']: secret['target'] for secret in migration['secrets']},
                             {'migration_database_url': '/run/secrets/migration_database_url',
                              'postgres_ca': '/run/secrets/postgres_ca'})
            self.assertEqual(int(migration['mem_limit']), 128 * 1024 ** 2)
            self.assertEqual(int(migration['memswap_limit']), 128 * 1024 ** 2)
            self.assertEqual(migration['user'], '10001:10001')
            self.assertTrue(migration['read_only'])

    def test_restricted_actors_override_global_allowusers_without_allowing_other_accounts(self):
        sshd = shutil.which('sshd') or '/usr/sbin/sshd'
        self.assertTrue(Path(sshd).is_file(), 'OpenSSH server is required for installation policy tests')
        with tempfile.TemporaryDirectory(prefix='wallpapers-sshd-policy-') as directory:
            key = Path(directory) / 'host_key'
            subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', str(key)], check=True)
            configuration = Path(directory) / 'sshd_config'
            configuration.write_bytes(('HostKey ' + str(key) + '\nAllowUsers krasheninnikov\n').encode()
                                      + installer.ssh_configuration())
            for account, actor in (('wallpapers-deploy', 'ci'), ('wallpapers-backup', 'worker')):
                result = subprocess.run([sshd, '-T', '-f', str(configuration), '-C',
                    'user=' + account + ',host=localhost,addr=127.0.0.1'], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                values = dict(line.split(' ', 1) for line in result.stdout.splitlines())
                self.assertEqual(values['allowusers'], account)
                self.assertEqual(values['authenticationmethods'], 'publickey')
                self.assertEqual(values['passwordauthentication'], 'no')
                self.assertEqual(values['kbdinteractiveauthentication'], 'no')
                self.assertEqual(values['permittty'], 'no')
                self.assertEqual(values['disableforwarding'], 'yes')
                self.assertEqual(values['permituserrc'], 'no')
                self.assertEqual(values['forcecommand'], '/usr/bin/python3 -I ' + str(installer.DESTINATION)
                                 + '/scripts/ssh-deploy.py ' + actor)
            for account in ('krasheninnikov', 'unrelated-user'):
                result = subprocess.run([sshd, '-T', '-f', str(configuration), '-C',
                    'user=' + account + ',host=localhost,addr=127.0.0.1'], capture_output=True, text=True, check=True)
                values = dict(line.split(' ', 1) for line in result.stdout.splitlines())
                self.assertEqual(values['allowusers'], 'krasheninnikov')
                self.assertEqual(values['forcecommand'], 'none')


if __name__ == '__main__':
    unittest.main()

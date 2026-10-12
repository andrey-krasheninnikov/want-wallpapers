import importlib.util
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

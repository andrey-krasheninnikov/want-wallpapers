"""Exercise private snapshots through the state command and Docker boundary."""
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest

COMMAND = Path(__file__).resolve().parents[1] / 'n8n-state.py'
REPOSITORY = COMMAND.parent.parent
IMAGE = 'docker.n8n.io/n8nio/n8n:2.41.7@sha256:bcef56dd44014e09774219536a3f8cb07f1b553fcba94044bd9fc0f21f8676a3'

DOCKER = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
root = pathlib.Path(os.environ['DOCKER_FIXTURE'])
state_path = root / 'state.json'
state = json.loads(state_path.read_text())
args = sys.argv[1:]
if state.get('fail') == 'run' and args[0] == 'run':
    sys.stderr.write('private-value-must-stay-private')
    sys.exit(1)
if args[0] == 'compose':
    if 'config' in args:
        print(json.dumps({'services': {'n8n': {'image': os.environ['N8N_FIXTURE_IMAGE']}},
            'volumes': {'data': {'name': 'want-wallpapers-n8n-data'}}}))
    elif 'ps' in args:
        print('local-container')
    elif 'stop' in args:
        state['running'] = False
    elif 'up' in args:
        state['running'] = True
elif args[0] == 'inspect':
    if '.Mounts' in args[-1]:
        print(json.dumps([{'Type': 'volume', 'Name': 'want-wallpapers-n8n-data', 'Destination': '/home/node/.n8n'}]))
    elif '.State.Running' in args[-1]:
        print(json.dumps(state['running']))
elif args[0] == 'ps':
    print('local-container' if state['running'] else '')
elif args[0] == 'volume':
    if args[1] == 'ls':
        print('\n'.join(state['volumes']))
    if args[1] == 'inspect' and '--format' in args:
        print(state.get('labels', {}).get(args[2], ''))
    if args[1] == 'create':
        state['volumes'].append(args[-1])
        state.setdefault('labels', {})[args[-1]] = args[args.index('--label') + 1].split('=', 1)[1]
        print(args[-1])
elif args[0] == 'run':
    if '-czf' in args:
        sys.stdout.buffer.write((root / 'snapshot.tar.gz').read_bytes())
    else:
        (root / 'restored.tar.gz').write_bytes(sys.stdin.buffer.read())
state_path.write_text(json.dumps(state))
'''


def snapshot(path, names=None):
    files = names or {
        '.n8n/config': b'{"encryptionKey":"synthetic-local-key-value"}',
        '.n8n/database.sqlite': b'SQLite format 3\x00fixture',
    }
    with tarfile.open(path, 'w:gz') as archive:
        for name, content in files.items():
            member = tarfile.TarInfo(name)
            member.uid = member.gid = 1000
            member.mode = 0o600
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    path.chmod(0o600)


class PrivateSnapshots(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        executable = self.root / 'docker'
        executable.write_text(DOCKER)
        executable.chmod(0o700)
        self.state_path = self.root / 'state.json'
        self.state_path.write_text(json.dumps({'running': True, 'volumes': ['want-wallpapers-n8n-data']}))
        snapshot(self.root / 'snapshot.tar.gz')
        self.environment = {**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'],
            'DOCKER_FIXTURE': str(self.root), 'N8N_FIXTURE_IMAGE': IMAGE}

    def command(self, *arguments):
        return subprocess.run([sys.executable, str(COMMAND), *arguments],
            capture_output=True, text=True, env=self.environment)

    def test_backup_is_private_and_resumes_the_running_service(self):
        directory = self.root / 'backups'
        result = self.command('backup', '--directory', str(directory))
        self.assertEqual(result.returncode, 0, result.stderr)
        archive = Path(result.stdout.strip())
        self.assertEqual(archive.parent, directory.resolve())
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(archive.stat().st_mode), 0o600)
        with tarfile.open(archive) as contents:
            self.assertEqual(contents.getnames(), ['.n8n/config', '.n8n/database.sqlite'])
        self.assertTrue(json.loads(self.state_path.read_text())['running'])
        self.assertNotIn('synthetic-local-key-value', result.stdout + result.stderr)

    def test_recovery_creates_a_new_volume_and_keeps_the_source(self):
        original = self.root / 'snapshot.tar.gz'
        result = self.command('restore', str(original), '--volume', 'want-wallpapers-n8n-recovery')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'want-wallpapers-n8n-recovery')
        state = json.loads(self.state_path.read_text())
        self.assertEqual(state['volumes'], ['want-wallpapers-n8n-data', 'want-wallpapers-n8n-recovery'])
        self.assertTrue(state['running'])
        self.assertEqual((self.root / 'restored.tar.gz').read_bytes(), original.read_bytes())

    def test_snapshot_without_the_original_encryption_key_is_rejected(self):
        original = self.root / 'snapshot.tar.gz'
        snapshot(original, {'.n8n/config': b'{}', '.n8n/database.sqlite': b'SQLite format 3\x00fixture'})
        result = self.command('restore', str(original), '--volume', 'want-wallpapers-n8n-recovery')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(self.state_path.read_text())['volumes'], ['want-wallpapers-n8n-data'])

    def test_corrupt_gzip_trailer_is_rejected_before_creating_a_volume(self):
        original = self.root / 'snapshot.tar.gz'
        content = bytearray(original.read_bytes())
        content[-8] ^= 1
        original.write_bytes(content)
        result = self.command('restore', str(original), '--volume', 'want-wallpapers-n8n-recovery')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(self.state_path.read_text())['volumes'], ['want-wallpapers-n8n-data'])

    def test_existing_volume_and_public_archive_are_never_restored(self):
        original = self.root / 'snapshot.tar.gz'
        existing = self.command('restore', str(original), '--volume', 'want-wallpapers-n8n-data')
        self.assertNotEqual(existing.returncode, 0)
        original.chmod(0o644)
        public = self.command('restore', str(original), '--volume', 'want-wallpapers-n8n-recovery')
        self.assertNotEqual(public.returncode, 0)
        self.assertFalse((self.root / 'restored.tar.gz').exists())
        self.assertEqual(json.loads(self.state_path.read_text())['volumes'], ['want-wallpapers-n8n-data'])

    def test_checkout_and_public_snapshot_directory_are_rejected(self):
        checkout = self.command('backup', '--directory', str(REPOSITORY))
        self.assertNotEqual(checkout.returncode, 0)
        directory = self.root / 'public'
        directory.mkdir(mode=0o755)
        public = self.command('backup', '--directory', str(directory))
        self.assertNotEqual(public.returncode, 0)
        self.assertTrue(json.loads(self.state_path.read_text())['running'])
        self.assertEqual(list(directory.iterdir()), [])

    def test_helper_failure_resumes_service_without_disclosing_output(self):
        state = json.loads(self.state_path.read_text())
        state['fail'] = 'run'
        self.state_path.write_text(json.dumps(state))
        result = self.command('backup', '--directory', str(self.root / 'backups'))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(json.loads(self.state_path.read_text())['running'])
        self.assertNotIn('private-value-must-stay-private', result.stdout + result.stderr)
        self.assertEqual(list((self.root / 'backups').glob('*.tar.gz')), [])

    def test_snapshot_does_not_start_a_stopped_service(self):
        state = json.loads(self.state_path.read_text())
        state['running'] = False
        self.state_path.write_text(json.dumps(state))
        result = self.command('backup', '--directory', str(self.root / 'backups'))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(self.state_path.read_text())['running'])

    def test_unsafe_paths_and_links_are_rejected_before_volume_creation(self):
        original = self.root / 'snapshot.tar.gz'
        for name in ['/etc/passwd', '.n8n/../../outside']:
            snapshot(original, {name: b'fixture'})
            self.assertNotEqual(self.command('restore', str(original),
                '--volume', 'want-wallpapers-n8n-recovery').returncode, 0)
        with tarfile.open(original, 'w:gz') as archive:
            link = tarfile.TarInfo('.n8n/config')
            link.type = tarfile.SYMTYPE
            link.linkname = '/outside'
            archive.addfile(link)
        self.assertNotEqual(self.command('restore', str(original),
            '--volume', 'want-wallpapers-n8n-recovery').returncode, 0)
        self.assertEqual(json.loads(self.state_path.read_text())['volumes'], ['want-wallpapers-n8n-data'])


if __name__ == '__main__':
    unittest.main()

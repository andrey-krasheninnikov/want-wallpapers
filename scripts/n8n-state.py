#!/usr/bin/env python3
"""Keep local n8n snapshots private and never replace an existing volume."""
import argparse
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import subprocess
import sys
import tarfile

REPOSITORY = Path(__file__).resolve().parent.parent
COMPOSE = REPOSITORY / 'automation/n8n/compose.yaml'


class SnapshotError(Exception):
    pass


def docker(*arguments, **options):
    try:
        return subprocess.run(['docker', *arguments], check=True, stderr=subprocess.PIPE,
            stdout=options.pop('stdout', subprocess.PIPE), timeout=210, **options)
    except (OSError, subprocess.SubprocessError):
        raise SnapshotError(f'Docker {arguments[0]} failed; check Docker and the local n8n status.') from None


def compose(project, *arguments):
    return docker('compose', '--project-name', project, '-f', str(COMPOSE), *arguments)


def configuration(project):
    if not re.fullmatch(r'want-wallpapers-n8n(?:-[a-z0-9]+)*', project):
        raise SnapshotError('Use the local n8n project name or a test project with its prefix.')
    config = json.loads(compose(project, 'config', '--format', 'json').stdout)
    return config['services']['n8n']['image'], config['volumes']['data']['name']


def outside_checkout(value):
    path = Path(value).expanduser().resolve()
    if any((parent / '.git').exists() for parent in [path, *path.parents]):
        raise SnapshotError('Snapshots must stay outside every source checkout.')
    return path


def private_directory(value):
    directory = outside_checkout(value)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    status = directory.stat()
    if status.st_uid != os.getuid() or status.st_mode & 0o077:
        raise SnapshotError('Snapshot directory must belong to the current user with mode 0700.')
    return directory


def validate_archive(source):
    source.seek(0)
    with gzip.GzipFile(fileobj=source) as compressed:
        while compressed.read(1048576):
            pass
    source.seek(0)
    names = set()
    with tarfile.open(fileobj=source, mode='r:gz') as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] != '.n8n':
                raise SnapshotError('Snapshot contains an unsafe path.')
            if not member.isfile() and not member.isdir():
                raise SnapshotError('Snapshot contains a link or special file.')
            if str(name) in names:
                raise SnapshotError('Snapshot contains a repeated path.')
            names.add(str(name))
            if member.uid != 1000 or member.gid != 1000:
                raise SnapshotError('Snapshot ownership must match the n8n user.')
            if str(name) == '.n8n/config':
                if not member.isfile() or member.mode & 0o077 or member.size > 1048576:
                    raise SnapshotError('Snapshot settings must be a private file.')
                settings = json.load(archive.extractfile(member))
                if not isinstance(settings.get('encryptionKey'), str) or not settings['encryptionKey']:
                    raise SnapshotError('Snapshot has no original encryption key.')
            if str(name) == '.n8n/database.sqlite':
                if not member.isfile() or archive.extractfile(member).read(16) != b'SQLite format 3\x00':
                    raise SnapshotError('Snapshot has no valid SQLite header.')
    if not {'.n8n/config', '.n8n/database.sqlite'} <= names:
        raise SnapshotError('Snapshot must contain both the n8n settings and SQLite database.')


def volume_command(image, volume, readonly, *command, **options):
    mount = f'type=volume,src={volume},dst=/home/node/.n8n' + (',readonly' if readonly else '')
    return docker('run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges:true', '--user', '1000:1000', '--mount', mount,
        '--entrypoint', '/bin/busybox', image, *command, **options)


def backup(project, directory):
    directory = private_directory(directory)
    image, volume = configuration(project)
    container = compose(project, 'ps', '--all', '--quiet', 'n8n').stdout.decode().strip()
    if not container or len(container.splitlines()) != 1:
        raise SnapshotError('Create the local n8n container before taking a snapshot.')
    mounts = json.loads(docker('inspect', container, '--format', '{{json .Mounts}}').stdout)
    if not any(mount.get('Type') == 'volume' and mount.get('Name') == volume
        and mount.get('Destination') == '/home/node/.n8n' for mount in mounts):
        raise SnapshotError('Container does not use the configured n8n data volume.')
    running = json.loads(docker('inspect', container, '--format', '{{json .State.Running}}').stdout)
    users = docker('ps', '--no-trunc', '--filter', f'volume={volume}', '--format', '{{.ID}}').stdout.decode().split()
    if any(user != container for user in users):
        raise SnapshotError('Another running container uses the n8n data volume; stop it privately first.')
    name = 'n8n-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + secrets.token_hex(4) + '.tar.gz'
    destination = directory / name
    partial = directory / (name + '.partial')
    try:
        if running:
            compose(project, 'stop', '--timeout', '90', 'n8n')
        descriptor = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'wb') as output:
            volume_command(image, volume, True, 'tar', '-czf', '-', '-C', '/home/node', '.n8n', stdout=output)
        with partial.open('rb') as source:
            validate_archive(source)
        os.link(partial, destination)
        partial.unlink()
    finally:
        if running:
            compose(project, 'up', '--detach', '--wait', '--wait-timeout', '180', 'n8n')
    return destination


def restore(project, archive, volume):
    if not re.fullmatch(r'want-wallpapers-n8n-[a-z0-9]+(?:-[a-z0-9]+)*', volume):
        raise SnapshotError('Use a new volume with the want-wallpapers-n8n- prefix.')
    image, _ = configuration(project)
    path = outside_checkout(archive)
    with path.open('rb') as source:
        status = os.fstat(source.fileno())
        if status.st_uid != os.getuid() or status.st_mode & 0o077:
            raise SnapshotError('Snapshot must belong to the current user with mode 0600.')
        validate_archive(source)
        existing = docker('volume', 'ls', '--format', '{{.Name}}').stdout.decode().split()
        if volume in existing:
            raise SnapshotError('Recovery only creates a new volume; existing volumes are never replaced.')
        marker = secrets.token_hex(16)
        docker('volume', 'create', '--label', f'foundation.want.n8n.restore={marker}', volume)
        label = docker('volume', 'inspect', volume, '--format', '{{ index .Labels "foundation.want.n8n.restore" }}').stdout.decode().strip()
        if label != marker:
            raise SnapshotError('Recovery volume was created by another operation; no data copied.')
        source.seek(0)
        volume_command(image, volume, False, 'tar', '-xzf', '-', '-C', '/home/node', stdin=source)
    return volume


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default='want-wallpapers-n8n')
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('backup', help='Stop n8n, snapshot its whole volume, and resume it.')
    create.add_argument('--directory', default='~/.local/share/want-wallpapers/n8n/backups')
    recover = commands.add_parser('restore', help='Restore a private snapshot into a new volume only.')
    recover.add_argument('archive')
    recover.add_argument('--volume', required=True)
    arguments = parser.parse_args()
    os.umask(0o077)
    try:
        if arguments.command == 'backup':
            print(backup(arguments.project, arguments.directory))
        else:
            print(restore(arguments.project, arguments.archive, arguments.volume))
    except SnapshotError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (ValueError, OSError, KeyError, TypeError, AttributeError, EOFError, tarfile.TarError):
        print('Snapshot failed. Check private paths, archive integrity, and local n8n status.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

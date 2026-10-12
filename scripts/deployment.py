"""Restricted deployment commands, private records and backup verification."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.parse

REPOSITORY = 'andrey-krasheninnikov/want-wallpapers'
IMAGE = 'ghcr.io/' + REPOSITORY
PREFIX = 'wallpapers-backups/'
TERMINAL = {'succeeded', 'failed', 'rolled-back', 'recovery-required'}


class DeployError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise DeployError(code)


def matches(pattern, value):
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


def request_command(value, actor):
    require(isinstance(value, str) and len(value) <= 256, 'invalid-command')
    words = tuple(value.split(' '))
    if actor == 'ci':
        if len(words) == 4 and words[0] == 'deploy':
            require(matches(r'v[A-Za-z0-9][A-Za-z0-9._-]{0,99}', words[1])
                    and matches(r'[0-9a-f]{40}', words[2])
                    and matches(r'sha256:[0-9a-f]{64}', words[3]), 'invalid-release')
            return words
        if len(words) == 2 and words[0] == 'deploy-status' and matches(r'[0-9a-f]{32}', words[1]):
            return words
        if len(words) == 4 and words[0] == 'deploy-status':
            request_command('deploy ' + ' '.join(words[1:]), actor)
            return words
    if actor == 'worker':
        if words == ('backup-next',):
            return words
        if len(words) == 2 and words[0] == 'backup-result' and matches(r'[0-9a-f]{32}', words[1]):
            return words
    raise DeployError('invalid-command')


def run(arguments, *, input=None, env=None, timeout=60):
    try:
        result = subprocess.run(arguments, input=input, env=env, capture_output=True,
                                text=isinstance(input, str) or input is None, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise DeployError('command-unavailable') from error
    require(result.returncode == 0, 'command-failed')
    return result.stdout


def private_file(path):
    path = Path(path)
    require(not path.is_symlink() and path.is_file(), 'private-file-required')
    details = path.stat()
    require(details.st_uid == os.geteuid() and details.st_mode & 0o077 == 0, 'private-file-permissions')
    return path


def atomic_json(path, value):
    atomic_bytes(path, json.dumps(value, sort_keys=True).encode())


def atomic_bytes(path, value):
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix='.record-')
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, 'wb') as output:
            output.write(value)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        require(not self.root.is_symlink() and self.root.stat().st_uid == os.geteuid()
                and self.root.stat().st_mode & 0o077 == 0, 'state-permissions')

    def path(self, request_id):
        require(matches(r'[0-9a-f]{32}', request_id), 'invalid-request-id')
        return self.root / (request_id + '.json')

    def read(self, request_id):
        return json.loads(private_file(self.path(request_id)).read_text())

    def write(self, record):
        atomic_json(self.path(record['requestId']), record)

    def records(self):
        return [self.read(path.stem) for path in self.root.glob('*.json')]

    @contextlib.contextmanager
    def lock(self, name='requests', blocking=True):
        require(name in ('requests', 'deployment'), 'invalid-lock')
        descriptor = os.open(self.root / (name + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB))
            except BlockingIOError as error:
                raise DeployError('deployment-busy') from error
            yield
        finally:
            os.close(descriptor)


def verify_receipt(request, receipt, now=None):
    now = int(time.time()) if now is None else now
    require(isinstance(receipt, dict), 'invalid-backup-receipt')
    for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'databaseId'):
        require(receipt.get(key) == request[key], 'backup-request-mismatch')
    require(receipt.get('status') == 'verified' and receipt.get('restored') == request['before'],
            'restore-not-verified')
    verified = receipt.get('verifiedAt')
    require(type(verified) is int and 0 <= now - verified <= 300 and now <= request['backupDeadline'],
            'stale-backup-receipt')
    require(matches(r'[0-9a-f]{64}', receipt.get('ciphertextSha256'))
            and receipt.get('objectKey') == PREFIX + request['requestId'] + '.dump.age',
            'invalid-backup-object')


def database_environment(secret, role, ca):
    secret = Path(secret)
    require(not secret.is_symlink() and secret.is_file() and secret.stat().st_uid in (os.geteuid(), 10001)
            and secret.stat().st_mode & 0o077 == 0, 'database-secret-permissions')
    url = urllib.parse.urlsplit(secret.read_text().strip())
    require(url.scheme in ('postgres', 'postgresql') and url.hostname
            and urllib.parse.parse_qs(url.query).get('sslmode') == ['verify-full']
            and urllib.parse.unquote(url.username or '') == role
            and urllib.parse.unquote(url.path) == '/wallpapers', 'database-profile-mismatch')
    environment = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'PGHOST': url.hostname,
                   'PGPORT': str(url.port or 5432), 'PGUSER': role, 'PGDATABASE': 'wallpapers',
                   'PGPASSWORD': urllib.parse.unquote(url.password or ''), 'PGSSLMODE': 'verify-full',
                   'PGSSLROOTCERT': str(ca), 'PGCONNECT_TIMEOUT': '10',
                   'PGOPTIONS': '-c statement_timeout=10000 -c timezone=UTC'}
    identity = json.dumps([environment[key] for key in ('PGHOST', 'PGPORT', 'PGDATABASE', 'PGSSLMODE')])
    identity += hashlib.sha256(Path(ca).read_bytes()).hexdigest()
    return environment, hashlib.sha256(identity.encode()).hexdigest()


def update_image(content, image):
    require(matches(r'ghcr\.io/andrey-krasheninnikov/want-wallpapers@sha256:[0-9a-f]{64}', image),
            'invalid-image')
    lines = list(re.finditer(rb'^APP_IMAGE=([^\r\n]+)', content, re.M))
    require(len(lines) == 1, 'invalid-app-image-config')
    line = lines[0]
    return content[:line.start(1)] + image.encode() + content[line.end(1):]


def image_matches(metadata, record):
    platform = record['platforms']['linux/amd64']
    ids = {record['indexDigest'], platform['digest'], platform['configDigest']}
    require(metadata.get('Id') in ids and metadata.get('Os') == 'linux'
            and metadata.get('Architecture') == 'amd64'
            and metadata.get('Config', {}).get('Labels', {}).get('org.opencontainers.image.revision') == record['sourceSha'],
            'image-evidence-mismatch')


def public_record(record):
    keys = ('schemaVersion', 'requestId', 'tag', 'sourceSha', 'indexDigest', 'state', 'stage',
            'errorCode', 'verificationRun', 'actualImageId', 'architecture', 'revision', 'backupVerified')
    return {key: record[key] for key in keys if key in record}


def deployment_event(event, ref, repository, tag=None, digest=None):
    if repository != REPOSITORY:
        return False
    if event == 'push':
        return ref.startswith('refs/tags/') and matches(r'v[A-Za-z0-9][A-Za-z0-9._-]{0,99}', ref[10:])
    return (event == 'workflow_dispatch' and ref == 'refs/tags/' + (tag or '')
            and matches(r'v[A-Za-z0-9][A-Za-z0-9._-]{0,99}', tag)
            and matches(r'sha256:[0-9a-f]{64}', digest))

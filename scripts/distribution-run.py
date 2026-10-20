#!/usr/bin/env python3
"""Run the private distribution command in the verified application image."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from deployment import DeployError, Store, TERMINAL, require

spec = importlib.util.spec_from_file_location('distribution_export', Path(__file__).with_name('distribution-export.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
NAME = 'want-wallpapers-distribution-worker'
LABEL = 'foundation.want.wallpapers.distribution'
SECRETS = Path('/etc/want-wallpapers/distribution')
CREDENTIALS = Path('/var/lib/want-wallpapers/distribution-credentials')
NETWORK = 'wallpapers-distribution-egress'


def worker():
    names = subprocess.run(['/usr/bin/docker', 'ps', '--all', '--filter', 'name=^/' + NAME + '$', '--format', '{{.Names}}'], capture_output=True, timeout=15)
    require(names.returncode == 0, 'distribution-container-inspection-failed')
    if not names.stdout.strip():
        return None
    require(names.stdout.decode().strip() == NAME, 'distribution-container-identity-mismatch')
    value = exporter.docker('inspect', '--format', '{"id":{{json .Id}},"owned":{{json (index .Config.Labels "foundation.want.wallpapers.distribution")}},"user":{{json .Config.User}},"running":{{json .State.Running}},"launcherPid":{{json (index .Config.Labels "foundation.want.wallpapers.distribution.pid")}}}', NAME)
    require(value['owned'] == 'true' and value['user'] == '10002:10002', 'distribution-container-ownership-mismatch')
    return value


def cleanup(identifier):
    current = worker()
    if current is not None:
        require(current['id'] == identifier, 'distribution-container-changed')
        subprocess.run(['/usr/bin/docker', 'rm', '--force', '--volumes', identifier], capture_output=True, timeout=20, check=True)
    require(worker() is None, 'distribution-container-cleanup-failed')


def profile():
    for path, owner, mode in ((SECRETS, 0, 0o700), (CREDENTIALS, 10002, 0o700), (exporter.OUTBOX, 0, 0o750)):
        metadata = path.stat()
        require(not path.is_symlink() and path.resolve() == path and path.is_dir()
                and metadata.st_uid == owner and metadata.st_mode & 0o777 == mode, 'distribution-private-profile-required')
    require(exporter.OUTBOX.stat().st_gid == 10002, 'distribution-private-profile-required')
    for name in ('distribution_database_url', 'postgres_ca.pem'):
        path = SECRETS / name
        metadata = path.stat()
        require(not path.is_symlink() and path.is_file() and metadata.st_uid == 10002
                and metadata.st_gid == 10002 and metadata.st_mode & 0o777 == 0o400, 'distribution-secret-permissions')
    network = exporter.docker('network', 'inspect', '--format', '{"internal":{{json .Internal}},"owned":{{json (index .Labels "foundation.want.wallpapers.distribution")}}}', NETWORK)
    require(not network['internal'] and network['owned'] == 'true', 'distribution-egress-required')


def command(arguments):
    require(arguments in (['--once'], ['status']) or (len(arguments) == 3 and arguments[0] == 'select')
            or (len(arguments) == 7 and arguments[0] == 'resolve'), 'invalid-distribution-command')
    require(all(len(value) <= 160 and __import__('re').fullmatch(r'[a-zA-Z0-9/_.-]+', value) for value in arguments), 'invalid-distribution-command')
    return arguments


def run(arguments):
    arguments = command(arguments)
    profile()
    store = Store(exporter.STATE)
    identifier = None
    launch_attempted = False
    try:
        with store.lock(blocking=False):
            require(all(record['state'] in TERMINAL and record['state'] != 'recovery-required' for record in store.records()), 'deployment-blocks-distribution')
            require(worker() is None, 'distribution-already-running')
            active = exporter.container()
            image = exporter.docker('image', 'inspect', '--format', '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}}}', active['imageId'])
            exporter.evidence(active, store.records(), image)
            mounts = [f'type=bind,src={exporter.OUTBOX},dst=/run/publications,readonly', f'type=bind,src={CREDENTIALS},dst=/run/distribution']
            mounts += [f'type=bind,src={SECRETS / name},dst=/run/secrets/{target},readonly' for name, target in
                       (('distribution_database_url', 'distribution_database_url'), ('postgres_ca.pem', 'postgres_ca'))]
            docker = ['/usr/bin/docker', 'run', '--detach', '--pull=never', '--name', NAME, '--label', LABEL + '=true',
                      '--label', LABEL + '.pid=' + str(os.getpid()), '--user', '10002:10002', '--no-healthcheck', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
                      '--memory=128m', '--memory-swap=128m', '--cpus=0.2', '--pids-limit=64', '--network', NETWORK,
                      '--tmpfs', '/tmp:size=1m,mode=1777,noexec,nosuid,nodev', '--log-driver=local', '--log-opt=max-size=100k', '--log-opt=max-file=1',
                      '--env', 'PGSSLROOTCERT=/run/secrets/postgres_ca', '--env', 'RUST_LOG=off', '--env', 'TOKIO_WORKER_THREADS=1']
            for mount in mounts:
                docker += ['--mount', mount]
            launch_attempted = True
            result = subprocess.run([*docker, active['image'], 'distribute', *arguments], capture_output=True, timeout=30)
            require(result.returncode == 0, 'distribution-start-failed')
            identifier = result.stdout.decode().strip()
            require(__import__('re').fullmatch('[0-9a-f]{64}', identifier), 'distribution-container-identity-mismatch')
        result = subprocess.run(['/usr/bin/docker', 'wait', identifier], capture_output=True, timeout=220)
        require(result.returncode == 0 and result.stdout.strip() == b'0', 'distribution-command-failed')
        output = subprocess.run(['/usr/bin/docker', 'logs', identifier], capture_output=True, timeout=15)
        require(output.returncode == 0 and len(output.stdout) <= 256 * 1024, 'distribution-output-invalid')
        value = json.loads(output.stdout.splitlines()[-1])
        fields = {'processed', 'memoryPeakBytes', 'selected', 'resolved'}
        if isinstance(value, dict) and set(value) == {'deliveries', 'publicationConflicts'}:
            delivery_fields = {'collectionId', 'destination', 'item', 'state', 'attempts', 'payloadHash', 'nextAttemptAt', 'errorCode'}
            require(isinstance(value['deliveries'], list) and all(isinstance(row, dict) and set(row) <= delivery_fields for row in value['deliveries']), 'distribution-output-invalid')
            require(isinstance(value['publicationConflicts'], list) and all(isinstance(row, dict) and set(row) == {'requestId', 'conflicts'}
                    and isinstance(row['conflicts'], list) and all(isinstance(conflict, dict) and set(conflict) == {'collectionId', 'expectedPayloadHash', 'incomingPayloadHash'} for conflict in row['conflicts']) for row in value['publicationConflicts']), 'distribution-output-invalid')
        else:
            require(isinstance(value, dict) and set(value) <= fields, 'distribution-output-invalid')
        print(json.dumps(value))
    finally:
        # A lost docker-run response is reconciled by the fixed name and ownership label.
        current = worker() if launch_attempted else None
        if current is not None and (identifier is None or current['id'] == identifier):
            require(current.get('launcherPid') == str(os.getpid()), 'distribution-container-changed')
            cleanup(current['id'])


def main():
    require(os.geteuid() == 0, 'distribution-root-launcher-required')
    for number in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(number, lambda received, _: sys.exit(128 + received))
    if sys.argv[1:] == ['cleanup']:
        current = worker()
        if current:
            pid = exporter.docker('inspect', '--format', '{{json (index .Config.Labels "foundation.want.wallpapers.distribution.pid")}}', NAME)
            require(isinstance(pid, str) and pid.isdigit() and not Path('/proc', pid).exists(), 'distribution-launcher-still-running')
            cleanup(current['id'])
        return
    run(sys.argv[1:])


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, DeployError) else 'distribution-launch-failed'}))
        sys.exit(1)

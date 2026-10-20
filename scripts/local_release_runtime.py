"""Bound local verification processes, disposable fixtures and backup worker lifetime."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time

from deployment import DeployError, atomic_json, private_file, require, run

ROOT = Path(__file__).resolve().parent.parent


def inspect(kind, reference):
    result = subprocess.run(['docker', kind, 'inspect', reference], capture_output=True, text=True, timeout=30)
    if result.returncode:
        require('no such' in result.stderr.lower() or 'not found' in result.stderr.lower(), 'docker-inspection-failed')
        return None
    return json.loads(result.stdout)[0]


def execute(arguments, source, environment, log):
    with Path(log).open('w') as output:
        os.chmod(log, 0o600)
        process = subprocess.Popen(arguments, cwd=source, env=environment, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True, umask=0o022)
        try:
            require(process.wait() == 0, 'local-step-failed:' + Path(log).stem)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


class Fixtures:
    def __init__(self, directory, identity):
        self.directory = Path(directory)
        self.identity = identity
        self.database = 'wallpapers-release-' + identity + '-pg'
        self.nonces = [identity[:16], identity[16:]]
        self.journal = self.directory / 'fixtures.json'
        self.environment = None

    def start(self, source, environment):
        if self.journal.exists():
            self.cleanup()
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        require(inspect('container', self.database) is None, 'local-fixture-name-in-use')
        for nonce in self.nonces:
            require(inspect('container', 'wallpapers-runtime-' + nonce + '-app-1') is None
                    and inspect('network', 'wallpapers-egress-' + nonce) is None
                    and inspect('network', 'wallpapers-proxy-' + nonce) is None, 'local-fixture-name-in-use')
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        self.environment = {**environment, 'TEST_DB_CONTAINER': self.database, 'TEST_DB_PORT': str(port),
                            'TEST_SECRETS_DIR': str(self.directory / 'secrets')}
        atomic_json(self.journal, {'identity': self.identity, 'database': self.database})
        execute(['make', 'test-db'], source, self.environment, self.directory / 'database.log')
        return self.environment

    def cleanup(self):
        if not self.journal.exists():
            return
        require(json.loads(private_file(self.journal).read_text()) == {'identity': self.identity, 'database': self.database},
                'local-fixture-journal-mismatch')
        for nonce in self.nonces:
            name = 'wallpapers-runtime-' + nonce + '-app-1'
            container = inspect('container', name)
            if container:
                require(container['Config'].get('Labels', {}).get('com.docker.compose.project') == 'wallpapers-runtime-' + nonce,
                        'local-fixture-ownership-mismatch')
                run(['docker', 'container', 'rm', '--force', '--volumes', container['Id']])
        database = inspect('container', self.database)
        volumes = []
        if database:
            require(database['Config'].get('Labels', {}).get('foundation.want.wallpapers.test') == 'true'
                    and any(mount.get('Source') == str(self.directory / 'secrets/postgres_password')
                            for mount in database['Mounts']), 'local-fixture-ownership-mismatch')
            volumes = [mount['Name'] for mount in database['Mounts'] if mount['Type'] == 'volume']
            run(['docker', 'container', 'rm', '--force', '--volumes', database['Id']])
        for nonce in self.nonces:
            for prefix in ('wallpapers-proxy-', 'wallpapers-egress-'):
                network = inspect('network', prefix + nonce)
                if network:
                    require(network.get('Labels', {}).get('foundation.want.wallpapers.test') == 'true'
                            and not network.get('Containers'), 'local-fixture-network-in-use')
                    run(['docker', 'network', 'rm', network['Id']])
        require(inspect('container', self.database) is None and all(inspect('volume', name) is None for name in volumes),
                'local-fixture-cleanup-incomplete')
        secrets = self.directory / 'secrets'
        if secrets.exists():
            require(not secrets.is_symlink(), 'local-fixture-symlink')
            shutil.rmtree(secrets)
        self.journal.unlink()


@contextlib.contextmanager
def backup_worker(config_path, log):
    spec = importlib.util.spec_from_file_location('local_backup_worker', ROOT / 'scripts/backup-worker.py')
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    config = worker.configuration(config_path)
    status = worker.worker_status(config)
    if status.get('ready'):
        yield
        return
    process = None
    with Path(log).open('w') as output:
        os.chmod(log, 0o600)
        try:
            process = subprocess.Popen(['python3', '-B', str(ROOT / 'scripts/backup-worker.py'), 'serve',
                                        '--config', str(config_path)], stdout=output, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            deadline = time.monotonic() + 120
            while True:
                status = worker.worker_status(config)
                if status.get('ready') and status.get('pid') == process.pid:
                    break
                require(process.poll() is None and time.monotonic() < deadline, 'backup-worker-unavailable')
                time.sleep(1)
            yield
        finally:
            if process is not None and process.poll() is None:
                deadline = time.monotonic() + 1800
                while worker.worker_status(config).get('stage') == 'working':
                    if time.monotonic() >= deadline:
                        break
                    time.sleep(2)
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


@contextlib.contextmanager
def registry_auth():
    import base64
    import tempfile
    actor = run(['gh', 'api', 'user', '--jq', '.login']).strip()
    token = os.environ.get('GHCR_TOKEN') or run(['gh', 'auth', 'token']).strip()
    require(actor and token, 'registry-authentication-required')
    context = json.loads(run(['docker', 'context', 'inspect']))[0]
    endpoint = context['Endpoints']['docker']['Host']
    require(endpoint.startswith('unix://'), 'local-docker-endpoint-required')
    with tempfile.TemporaryDirectory(prefix='wallpapers-registry-') as directory:
        original = Path(os.environ.get('DOCKER_CONFIG', str(Path.home() / '.docker'))) / 'config.json'
        settings = json.loads(original.read_text()) if original.exists() else {}
        configuration = {'auths': {'ghcr.io': {'auth': base64.b64encode((actor + ':' + token).encode()).decode()}}}
        if 'cliPluginsExtraDirs' in settings:
            configuration['cliPluginsExtraDirs'] = settings['cliPluginsExtraDirs']
        atomic_json(Path(directory) / 'config.json', configuration)
        previous = {key: os.environ.get(key) for key in ('DOCKER_CONFIG', 'DOCKER_HOST', 'DOCKER_CONTEXT')}
        os.environ.update(DOCKER_CONFIG=directory, DOCKER_HOST=endpoint)
        os.environ.pop('DOCKER_CONTEXT', None)
        try:
            yield actor, token
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

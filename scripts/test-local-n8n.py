#!/usr/bin/env python3
"""Check restart and snapshot recovery in an isolated local n8n project."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
from threading import Thread
import time
from urllib.request import urlopen

REPOSITORY = Path(__file__).resolve().parent.parent
COMPOSE = REPOSITORY / 'automation/n8n/compose.yaml'
STATE_COMMAND = REPOSITORY / 'scripts/n8n-state.py'
TABLE = 'local_recovery_journal'
CREDENTIAL_ID = 'LocalRecoveryCredential'


class LocalEndpoint(BaseHTTPRequestHandler):
    def do_GET(self):
        accepted = self.path in ('/check', '/resume') and self.headers.get('X-Local-Check') == 'not-a-service-secret'
        if accepted and self.path == '/resume':
            self.server.deliveries.append('resumed')
        self.send_response(200 if accepted else 403)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'credentialAccepted': accepted}).encode())

    def log_message(self, *arguments):
        pass


def workflow(identifier, nodes, response_mode='lastNode'):
    trigger = {'id': 'start', 'name': 'Start', 'type': 'n8n-nodes-base.webhook',
        'typeVersion': 2, 'position': [0, 0], 'webhookId': identifier,
        'parameters': {'httpMethod': 'GET', 'path': identifier, 'responseMode': response_mode,
            'responseData': 'allEntries', 'options': {}}}
    sequence = [trigger, *nodes]
    connections = {before['name']: {'main': [[{'node': after['name'], 'type': 'main', 'index': 0}]]}
        for before, after in zip(sequence, sequence[1:])}
    return {'id': identifier, 'name': identifier, 'active': False, 'nodes': sequence,
        'connections': connections, 'settings': {'executionOrder': 'v1', 'saveExecutionProgress': True}}


def data_node(name, parameters):
    return {'id': name, 'name': name, 'type': 'n8n-nodes-base.dataTable', 'typeVersion': 1.1,
        'position': [300, 0], 'parameters': parameters}


def insert_node(phase):
    return data_node('Record ' + phase, {'resource': 'row', 'operation': 'insert',
        'dataTableId': {'__rl': True, 'mode': 'name', 'value': TABLE},
        'columns': {'mappingMode': 'defineBelow', 'value': {'runId': 'persistence-check', 'phase': phase}},
        'options': {}})


def http_node(name, url):
    return {'id': name, 'name': name, 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2,
        'position': [300, 0], 'parameters': {'url': url, 'authentication': 'genericCredentialType',
            'genericAuthType': 'httpHeaderAuth', 'options': {'timeout': 15000}},
        'credentials': {'httpHeaderAuth': {'id': CREDENTIAL_ID, 'name': 'Local recovery fixture'}}}


def main():
    suffix = secrets.token_hex(4)
    project = 'want-wallpapers-n8n-check-' + suffix
    original_volume = project + '-data'
    restored_volume = project + '-recovery'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    environment = {**os.environ, 'N8N_DATA_VOLUME': original_volume, 'N8N_PORT': str(port)}

    def run(*command):
        try:
            return subprocess.run(command, check=True, capture_output=True, text=True,
                env=environment, timeout=210).stdout
        except (OSError, subprocess.SubprocessError):
            raise RuntimeError('Local n8n check command failed; inspect only the isolated test project.') from None

    def compose(*arguments):
        return run('docker', 'compose', '--project-name', project, '-f', str(COMPOSE), *arguments)

    server = ThreadingHTTPServer(('127.0.0.1', 0), LocalEndpoint)
    server.deliveries = []
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix='wallpapers-n8n-check-') as temporary:
            fixtures = Path(temporary)
            ready = workflow('LocalRecoveryReady', [], response_mode='onReceived')
            initialize = workflow('LocalRecoveryInit', [data_node('Create journal', {
                'resource': 'table', 'operation': 'create', 'tableName': TABLE,
                'columns': {'column': [{'name': 'runId', 'type': 'string'}, {'name': 'phase', 'type': 'string'}]},
                'options': {'createIfNotExists': True}}), insert_node('started')])
            pause = workflow('LocalRecoveryWait', [insert_node('waiting'), {'id': 'wait', 'name': 'Wait', 'type': 'n8n-nodes-base.wait',
                'typeVersion': 1.1, 'position': [300, 0], 'parameters': {'resume': 'timeInterval', 'amount': 90, 'unit': 'seconds'}},
                http_node('Resume checkpoint', f'http://host.docker.internal:{server.server_port}/resume')],
                response_mode='onReceived')
            read = workflow('LocalRecoveryRead', [data_node('Read journal', {'resource': 'row', 'operation': 'get',
                'dataTableId': {'__rl': True, 'mode': 'name', 'value': TABLE}, 'returnAll': True,
                'filters': {'conditions': []}, 'matchType': 'allConditions'})])
            credential_check = workflow('LocalRecoveryCredentialCheck', [http_node('Check credential',
                f'http://host.docker.internal:{server.server_port}/check')])
            (fixtures / 'workflows.json').write_text(json.dumps([ready, initialize, pause, read, credential_check]))
            (fixtures / 'credential.json').write_text(json.dumps([{'id': CREDENTIAL_ID,
                'name': 'Local recovery fixture', 'type': 'httpHeaderAuth',
                'data': {'name': 'X-Local-Check', 'value': 'not-a-service-secret'}}]))

            def cli(command, *arguments):
                return compose('run', '--rm', '--no-deps', '-T', '--volume', str(fixtures) + ':/fixtures:ro',
                    '--entrypoint', 'n8n', 'n8n', command, *arguments)

            def execute(identifier):
                try:
                    with urlopen(f'http://127.0.0.1:{port}/webhook/{identifier}', timeout=30) as response:
                        return json.load(response)
                except (OSError, ValueError):
                    raise RuntimeError(f'Local fixture endpoint failed: {identifier}.') from None

            def check_journal():
                return sorted((row['runId'], row['phase']) for row in execute('LocalRecoveryRead'))

            def wait_for(check, expected, timeout, message):
                deadline = time.monotonic() + timeout
                while True:
                    try:
                        if check() == expected:
                            return
                    except RuntimeError:
                        pass
                    if time.monotonic() >= deadline:
                        raise RuntimeError(message)
                    time.sleep(1)

            expected = [('persistence-check', phase) for phase in ('started', 'waiting')]
            compose('up', '--detach', '--wait', '--wait-timeout', '180')
            print(f'Isolated n8n ready on loopback: {project}.', flush=True)
            compose('stop', '--timeout', '90', 'n8n')
            cli('import:workflow', '--input', '/fixtures/workflows.json')
            cli('import:credentials', '--input', '/fixtures/credential.json')
            for item in (ready, initialize, pause, read, credential_check):
                cli('publish:workflow', '--id', item['id'])
            compose('up', '--detach', '--wait', '--wait-timeout', '180')
            wait_for(lambda: execute('LocalRecoveryReady'), {'message': 'Workflow was started'},
                90, 'The local fixture endpoint did not become ready.')
            execute('LocalRecoveryInit')
            execute('LocalRecoveryWait')
            wait_for(check_journal, [('persistence-check', 'started'), ('persistence-check', 'waiting')],
                30, 'The local Wait workflow did not reach its checkpoint.')
            resume_at = time.monotonic() + 92
            compose('stop', '--timeout', '90', 'n8n')
            print('90-second Wait entered; test instance stopped before its deadline.', flush=True)
            archive = run(sys.executable, '-B', str(STATE_COMMAND), '--project', project,
                'backup', '--directory', str(fixtures / 'backups')).strip()
            run(sys.executable, '-B', str(STATE_COMMAND), '--project', project,
                'restore', archive, '--volume', restored_volume)
            while time.monotonic() < resume_at:
                time.sleep(1)
            compose('up', '--detach', '--wait', '--wait-timeout', '180')
            wait_for(lambda: len(server.deliveries), 1, 90, 'The original Wait did not resume exactly once.')
            wait_for(check_journal, expected, 90, 'The original journal did not survive restart.')
            compose('stop', '--timeout', '90', 'n8n')
            if len(server.deliveries) != 1:
                raise RuntimeError('The original Wait delivered more than once before shutdown.')
            print('Restart resumed the overdue Wait once; journal survived.', flush=True)
            environment['N8N_DATA_VOLUME'] = restored_volume
            compose('up', '--detach', '--force-recreate', '--wait', '--wait-timeout', '180')
            wait_for(lambda: len(server.deliveries), 2, 90, 'The restored Wait did not resume exactly once.')
            wait_for(check_journal, expected, 90, 'The restored journal did not match its saved checkpoint.')
            accepted = execute('LocalRecoveryCredentialCheck')
            if accepted != [{'credentialAccepted': True}]:
                raise RuntimeError('The restored key did not decrypt the synthetic credential.')
            compose('stop', '--timeout', '90', 'n8n')
            if len(server.deliveries) != 2:
                raise RuntimeError('The restored Wait did not deliver exactly once before shutdown.')
            print('Recovery preserved workflows, waiting execution, journal, and credential decryption.', flush=True)
            print(f'PASS. Preserved test volumes: {original_volume}, {restored_volume}', flush=True)
    finally:
        server.shutdown()
        server.server_close()
        compose('stop', '--timeout', '90', 'n8n')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, TypeError, OSError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Local n8n check failed.', file=sys.stderr)
        sys.exit(1)

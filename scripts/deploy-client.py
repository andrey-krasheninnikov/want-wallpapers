#!/usr/bin/env python3
"""Invoke the restricted production protocol and reconcile ambiguous SSH outcomes."""
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, TERMINAL, deployment_event, matches, request_command, require, run


def transport(config, command):
    response = run(['ssh', '-F', str(config), '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
        'wallpapers-production', command], timeout=120)
    value = json.loads(response)
    require(isinstance(value, dict) and 'requestId' in value and 'state' in value, 'invalid-deployment-response')
    return value


def deploy(config, tag, sha, digest, timeout=2700):
    intent = ' '.join((tag, sha, digest))
    request_command('deploy ' + intent, 'ci')
    try:
        record = transport(config, 'deploy ' + intent)
    except (DeployError, ValueError):
        # Query the existing intent; never repeat a write after a lost response.
        record = transport(config, 'deploy-status ' + intent)
    deadline = time.monotonic() + timeout
    while record['state'] not in TERMINAL:
        require(time.monotonic() < deadline, 'deployment-status-timeout')
        require(matches(r'[0-9a-f]{32}', record['requestId']), 'invalid-request-id')
        time.sleep(15)
        record = transport(config, 'deploy-status ' + record['requestId'])
    require((record.get('tag'), record.get('sourceSha'), record.get('indexDigest')) == (tag, sha, digest),
            'deployment-intent-mismatch')
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('guard', 'deploy'))
    parser.add_argument('--tag')
    parser.add_argument('--source')
    parser.add_argument('--digest')
    arguments = parser.parse_args()
    if arguments.mode == 'guard':
        require(deployment_event(os.environ.get('GITHUB_EVENT_NAME'), os.environ.get('GITHUB_REF', ''),
                os.environ.get('GITHUB_REPOSITORY'), arguments.tag, arguments.digest), 'deployment-event-rejected')
        return
    host = os.environ['PRODUCTION_SSH_HOST']
    port = os.environ['PRODUCTION_SSH_PORT']
    user = os.environ['PRODUCTION_SSH_USER']
    require(matches(r'[A-Za-z0-9.:-]{1,253}', host) and port == '14444' and user == 'wallpapers-deploy',
            'invalid-production-ssh-profile')
    with tempfile.TemporaryDirectory(prefix='wallpapers-ssh-', dir=os.environ.get('RUNNER_TEMP')) as directory:
        root = Path(directory)
        root.chmod(0o700)
        key, known, config = root / 'key', root / 'known_hosts', root / 'config'
        key.write_text(os.environ.pop('PRODUCTION_SSH_PRIVATE_KEY'))
        key.chmod(0o600)
        known.write_text(os.environ['PRODUCTION_SSH_KNOWN_HOSTS'])
        known.chmod(0o600)
        require(run(['ssh-keygen', '-F', '[' + host + ']:' + port, '-f', str(known)]).strip(), 'trusted-host-key-missing')
        config.write_text(f'Host wallpapers-production\n  HostName {host}\n  Port {port}\n  User {user}\n'
                          f'  IdentityFile {key}\n  IdentitiesOnly yes\n  UserKnownHostsFile {known}\n'
                          '  StrictHostKeyChecking yes\n  LogLevel ERROR\n')
        config.chmod(0o600)
        record = deploy(config, arguments.tag, arguments.source, arguments.digest)
        print(json.dumps(record, sort_keys=True))
        if record['state'] != 'succeeded':
            sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, DeployError) else 'deployment-client-failed'}))
        sys.exit(1)

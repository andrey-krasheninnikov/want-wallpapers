#!/usr/bin/env python3
"""Close the reviewed backup prefix without changing other public object paths."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, PREFIX, require, run

BUCKET = 'want-foundation'
ENDPOINT = 'https://s3.twcstorage.ru'
ARN = 'arn:aws:s3:::' + BUCKET + '/' + PREFIX + '*'


def command(*arguments):
    return ['aws', '--profile', 'timeweb-admin', '--endpoint-url', ENDPOINT, '--no-cli-pager',
            '--cli-connect-timeout', '10', '--cli-read-timeout', '30', 's3api', *arguments]


def policy():
    return json.loads(json.loads(run(command('get-bucket-policy', '--bucket', BUCKET)))['Policy'])


def restricted(previous):
    value = json.loads(json.dumps(previous))
    entries = [entry for entry in value['Statement'] if entry.get('Sid') == 'PublicReadGetObject_v1']
    require(len(entries) == 1 and entries[0].get('Effect') == 'Allow'
            and entries[0].get('Action') == 's3:GetObject'
            and entries[0].get('Principal') == {'AWS': '*'}
            and isinstance(entries[0].get('NotResource'), list), 'public-policy-requires-review')
    require('arn:aws:s3:::want-foundation/axentra/*' in entries[0]['NotResource'], 'existing-isolation-missing')
    if ARN not in entries[0]['NotResource']:
        entries[0]['NotResource'].append(ARN)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    arguments = parser.parse_args()
    original = policy()
    target = restricted(original)
    if not arguments.apply:
        print(json.dumps(target, sort_keys=True))
        return
    with tempfile.TemporaryDirectory(prefix='wallpapers-s3-policy-') as directory:
        root = Path(directory)
        previous, candidate = root / 'previous.json', root / 'candidate.json'
        previous.write_text(json.dumps(original, sort_keys=True)); previous.chmod(0o600)
        candidate.write_text(json.dumps(target, sort_keys=True)); candidate.chmod(0o600)
        require(policy() == original, 'bucket-policy-changed')
        if target != original:
            run(command('put-bucket-policy', '--bucket', BUCKET, '--policy', 'file://' + str(candidate)))
        require(policy() == target, 'bucket-policy-readback-mismatch')
        key = PREFIX + 'privacy-check-' + uuid.uuid4().hex
        marker = root / 'marker'
        marker.write_text('Private backup prefix verification.'); marker.chmod(0o600)
        run(command('put-object', '--bucket', BUCKET, '--key', key, '--body', str(marker), '--acl', 'private'))
        try:
            for address in (ENDPOINT + '/' + BUCKET + '/' + key, 'https://' + BUCKET + '.s3.twcstorage.ru/' + key):
                for method in ('GET', 'HEAD'):
                    arguments = ['curl', '-q', '--noproxy', '*', '--silent', '--show-error', '--max-time', '20']
                    if method == 'HEAD':
                        arguments.append('--head')
                    status = run([*arguments, '--output', '/dev/null', '--write-out', '%{http_code}', address])
                    require(status.strip() == '403', 'backup-prefix-is-public')
            print(json.dumps({'status': 'success', 'prefix': PREFIX, 'anonymousReadDenied': True,
                              'existingExclusionsPreserved': True}))
        finally:
            # Remove only the synthetic object created by this exact invocation.
            run(command('delete-object', '--bucket', BUCKET, '--key', key))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, DeployError) else 'prefix-provisioning-failed'}))
        sys.exit(1)

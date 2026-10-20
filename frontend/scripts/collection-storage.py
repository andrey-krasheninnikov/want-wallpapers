"""Conditional collection object operations through the installed AWS CLI SDK."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys


def require(value):
    if not value:
        raise ValueError("invalid-storage-request")


def private_file(path):
    value = Path(path)
    details = value.lstat()
    require(value.resolve() == value and stat.S_ISREG(details.st_mode))
    require(details.st_uid == os.getuid() and not details.st_mode & 0o077)
    return value


def operation(client, value):
    prefix, key = value['prefix'], value['key']
    require(re.fullmatch(r'wallpapers/assets/collections/\d+-[a-z0-9]+(?:-[a-z0-9]+)*/', prefix))
    require(key.startswith(prefix) and re.fullmatch(r'[a-z0-9][a-z0-9.-]*', key[len(prefix):]))
    require(type(value['size']) is int and 0 < value['size'] <= 64 * 1024 * 1024)
    if value['action'] == 'read':
        target = private_file(value['path'])
        metadata = client.head_object(Bucket='want-foundation', Key=key)
        if metadata['ContentLength'] != value['size']:
            return {'status': 409}
        response = client.get_object(Bucket='want-foundation', Key=key, IfMatch=metadata['ETag'])
        body, count = response['Body'], 0
        try:
            with target.open('wb') as output:
                while True:
                    chunk = body.read(1024 * 1024)
                    if not chunk:
                        break
                    count += len(chunk)
                    require(count <= value['size'])
                    output.write(chunk)
            require(count == value['size'])
        finally:
            body.close()
        return {'status': 200}
    require(value['action'] == 'create')
    source = private_file(value['path'])
    require(source.stat().st_size == value['size'])
    require(re.fullmatch(r'[a-f0-9]{64}', value['sha256']))
    require(hashlib.sha256(source.read_bytes()).hexdigest() == value['sha256'])
    require(value['contentType'] in ('image/png', 'image/webp', 'image/jpeg', 'application/json'))
    with source.open('rb') as body:
        response = client.put_object(Bucket='want-foundation', Key=key, IfNoneMatch='*', Body=body,
                                     ContentType=value['contentType'], CacheControl='public,max-age=31536000,immutable',
                                     Metadata={'sha256': value['sha256']})
    return {'status': response['ResponseMetadata']['HTTPStatusCode']}


def main():
    os.umask(0o077)
    try:
        value = json.load(sys.stdin)
        require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}', value['profile']))
        require('backup' not in value['profile'].lower())
        from awscli.botocore.session import Session
        from awscli.botocore.config import Config
        client = Session(profile=value['profile']).create_client(
            's3', endpoint_url='https://s3.twcstorage.ru',
            config=Config(signature_version='s3v4', retries={'max_attempts': 1}, connect_timeout=10, read_timeout=30))
        result = operation(client, value)
    except Exception as error:
        response = getattr(error, 'response', {})
        status = response.get('ResponseMetadata', {}).get('HTTPStatusCode')
        result = {'status': status if isinstance(status, int) else 0}
    print(json.dumps(result))


if __name__ == '__main__':
    main()

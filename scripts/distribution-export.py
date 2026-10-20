#!/usr/bin/env python3
"""Export public collection evidence from the verified running production image."""
import io
import json
import os
from pathlib import Path
import re
import subprocess
import selectors
import tarfile
import tempfile
import time

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from deployment import DeployError, Store, require

STATE = Path('/var/lib/want-deploy/wallpapers/requests')
OUTBOX = Path('/var/lib/want-wallpapers/publications')
CONTAINER = 'want-wallpapers-app-1'
IMAGE = 'ghcr.io/andrey-krasheninnikov/want-wallpapers'
GROUP = 10002
LIMIT = 8 * 1024 * 1024


def docker(*arguments):
    result = subprocess.run(['/usr/bin/docker', *arguments], capture_output=True, timeout=30)
    require(result.returncode == 0 and len(result.stdout) <= LIMIT, 'distribution-docker-read-failed')
    return json.loads(result.stdout)


def container():
    return docker('inspect', '--format', '{"id":{{json .Id}},"image":{{json .Config.Image}},"imageId":{{json .Image}},"running":{{json .State.Running}},"health":{{json .State.Health.Status}}}', CONTAINER)


def copy_json(identifier, name, *, optional=False):
    process = subprocess.Popen(['/usr/bin/docker', 'cp', identifier + ':/app/frontend/' + name, '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        buffers = {'stdout': bytearray(), 'stderr': bytearray()}
        deadline = time.monotonic() + 30
        with selectors.DefaultSelector() as selector:
            for name in buffers:
                stream = getattr(process, name)
                os.set_blocking(stream.fileno(), False)
                selector.register(stream, selectors.EVENT_READ, name)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0, 'distribution-docker-read-timeout')
                for key, _ in selector.select(remaining):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    buffers[key.data].extend(chunk)
                    require(len(buffers[key.data]) <= (LIMIT + 16384 if key.data == 'stdout' else 8192), 'distribution-build-metadata-too-large')
        archive, error = bytes(buffers['stdout']), bytes(buffers['stderr'])
        status = process.wait(timeout=max(1, deadline - time.monotonic()))
        if status and optional and (b'Could not find' in error or b'no such file' in error.lower()):
            return None
        require(status == 0, 'distribution-build-metadata-missing')
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            members = source.getmembers()
            require(len(members) == 1 and members[0].isfile() and members[0].size <= LIMIT, 'distribution-build-metadata-invalid')
            return json.load(source.extractfile(members[0]))
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()


def evidence(active, records, image):
    require(active['running'] and active['health'] == 'healthy' and image['os'] == 'linux' and image['architecture'] == 'amd64'
            and image['id'] == active['imageId'], 'distribution-app-not-ready')
    matched = [record for record in records if record.get('state') == 'succeeded' and record.get('stage') == 'complete'
               and record.get('backupVerified') is True and record.get('actualImageId') == active['imageId']
               and active['image'] == IMAGE + '@' + record.get('indexDigest', '')
               and record.get('sourceSha') == record.get('revision') == image['revision']]
    require(matched, 'distribution-success-evidence-missing')
    record = max(matched, key=lambda value: value['createdAt'])
    require(re.fullmatch(r'[0-9a-f]{32}', record.get('requestId', ''))
            and re.fullmatch(r'[0-9a-f]{40}', record.get('sourceSha', ''))
            and re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', record.get('tag', ''))
            and re.fullmatch(r'sha256:[0-9a-f]{64}', record.get('indexDigest', ''))
            and record.get('architecture') == 'amd64', 'distribution-invalid-evidence')
    return {key: record[key] for key in ('requestId', 'tag', 'sourceSha', 'indexDigest', 'revision', 'architecture', 'state', 'stage', 'backupVerified')}


def publications(metadata, identities):
    require(isinstance(identities, list) and 0 < len(identities) <= 1000 and len(set(identities)) == len(identities)
            and all(isinstance(value, str) and re.fullmatch(r'[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*', value) for value in identities),
            'distribution-invalid-catalogue')
    require(isinstance(metadata, dict) and metadata.get('schemaVersion') == 1 and isinstance(metadata.get('collections'), list), 'distribution-invalid-build-metadata')
    packages = {}
    for value in metadata['collections']:
        require(isinstance(value, dict) and set(value) == {'schemaVersion', 'revision', 'packageHash', 'manifest', 'stories', 'copy', 'assets'}
                and value.get('schemaVersion') == 1 and re.fullmatch(r'[0-9a-f]{64}', value.get('packageHash', '')), 'distribution-invalid-package')
        require(isinstance(value['copy'], dict) and set(value['copy']) <= {'telegram', 'pinterest', 'tumblr', 'deviantart', 'flickr'}
                and all(isinstance(posts, list) and all(isinstance(post, dict) and set(post) == {'title', 'description'}
                    and all(isinstance(text, str) for text in post.values()) for post in posts) for posts in value['copy'].values()), 'distribution-private-copy-field')
        require(isinstance(value['assets'], list) and all(isinstance(asset, dict)
                and set(asset) <= {'role', 'design', 'variant', 'sha256', 'width', 'height', 'name', 'emoji', 'file', 'url'}
                and asset.get('role') in ('final', 'preview', 'social', 'emoji') for asset in value['assets']), 'distribution-private-asset-field')
        manifest = value['manifest']
        require(isinstance(manifest, dict) and set(manifest) == {'collection', 'wallpapers'}
                and set(manifest['collection']) <= {'id', 'slug', 'count', 'title', 'description', 'videoCover'}
                and all(set(item) == {'id', 'slug', 'collection', 'collectionId', 's3Folder', 'fileStem', 'number', 'category', 'tags', 'title', 'description'} for item in manifest['wallpapers']), 'distribution-private-manifest-field')
        localized = [manifest['collection'].get(field, {}) for field in ('title', 'description')]
        localized += [item.get(field, {}) for item in manifest['wallpapers'] for field in ('title', 'description')]
        require(all(isinstance(texts, dict) and set(texts) <= {'en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar'}
                    and all(isinstance(text, str) for text in texts.values()) for texts in localized), 'distribution-private-localized-field')
        require(isinstance(value['stories'], dict) and set(value['stories']) <= {'en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar'}
                and all(isinstance(paragraphs, list) and all(isinstance(text, str) for text in paragraphs)
                    for paragraphs in value['stories'].values()), 'distribution-private-story-field')
        cover = manifest['collection'].get('videoCover')
        require(cover is None or (isinstance(cover, dict) and set(cover) == {'src', 'poster'}
                and all(isinstance(url, str) for url in cover.values())), 'distribution-private-cover-field')
        identifier = value['manifest']['collection']['id']
        require(identifier in identities and identifier not in packages, 'distribution-package-catalogue-mismatch')
        packages[identifier] = value
    return [{'collectionId': identifier, 'package': packages.get(identifier)} for identifier in sorted(identities)]


def save(outbox, value):
    outbox.mkdir(parents=True, exist_ok=True, mode=0o750)
    require(not outbox.is_symlink() and outbox.resolve() == outbox and outbox.stat().st_uid == 0, 'distribution-private-outbox-required')
    os.chown(outbox, 0, GROUP)
    outbox.chmod(0o750)
    path = outbox / (value['receipt']['requestId'] + '.json')
    if path.exists():
        require(not path.is_symlink() and path.stat().st_uid == 0 and path.stat().st_size <= LIMIT, 'distribution-invalid-outbox-file')
        existing = json.loads(path.read_text())
        require({key: existing[key] for key in ('schemaVersion', 'receipt', 'publications')}
                == {key: value[key] for key in ('schemaVersion', 'receipt', 'publications')}, 'distribution-outbox-conflict')
        return False
    payload = (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    require(len(payload) <= LIMIT, 'distribution-build-metadata-too-large')
    descriptor, temporary = tempfile.mkstemp(prefix='.publication-', dir=outbox)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            os.fchown(output.fileno(), 0, GROUP)
            os.fchmod(output.fileno(), 0o640)
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        os.rename(temporary, path)
        directory = os.open(outbox, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True


def main():
    require(os.geteuid() == 0 and len(__import__('sys').argv) == 1 and STATE.is_dir(), 'distribution-root-exporter-required')
    store = Store(STATE)
    with store.lock(blocking=False):
        active = container()
        image = docker('image', 'inspect', '--format', '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}}}', active['imageId'])
        receipt = evidence(active, store.records(), image)
        metadata = copy_json(active['id'], 'runtime-publications.json', optional=True)
        identities = metadata.get('catalogueIds') if isinstance(metadata, dict) else None
        if identities is None:
            catalogue = copy_json(active['id'], 'runtime-catalog.json')
            identities = [value['id'] for value in catalogue['collections']]
        if metadata is None:
            metadata = {'schemaVersion': 1, 'collections': []}
        batch = {'schemaVersion': 1, 'verifiedAt': int(time.time()), 'receipt': receipt, 'publications': publications(metadata, identities)}
        require(container() == active, 'distribution-app-changed')
        created = save(OUTBOX, batch)
        print(json.dumps({'requestId': receipt['requestId'], 'collections': len(batch['publications']), 'created': created}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorCode': str(error) if isinstance(error, DeployError) else 'distribution-export-failed'}))
        raise SystemExit(1)

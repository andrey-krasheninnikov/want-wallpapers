#!/usr/bin/env python3
"""Select CI checks and resolve the immutable evidence for a release tag."""
import argparse
from datetime import datetime
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import tempfile
import urllib.request
import urllib.parse

REPOSITORY = 'andrey-krasheninnikov/want-wallpapers'
IMAGE = 'ghcr.io/' + REPOSITORY
WORKFLOW = '.github/workflows/checks.yml'
RELEASE_WORKFLOW = '.github/workflows/deploy-production.yml'
PROFILES = {'full': []}
ANNOTATION = 'foundation.want.wallpapers.release.v1'
PLATFORMS = {'linux/amd64', 'linux/arm64'}


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def command(arguments, input=None):
    result = subprocess.run(arguments, input=input, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, f'{arguments[0]} {arguments[1]} failed; release evidence unavailable')
    return result.stdout.strip()


def document(value):
    try:
        return json.loads(value)
    except (ValueError, TypeError) as error:
        raise ReleaseError('Invalid JSON release evidence') from error


def api(path, pages=False):
    if os.environ.get('WANT_RELEASE_PUBLIC_API') == '1':
        url = 'https://api.github.com/repos/' + REPOSITORY + '/' + path
        results = []
        while url:
            require(url.startswith('https://api.github.com/repos/' + REPOSITORY + '/'), 'Invalid GitHub evidence URL')
            try:
                request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json',
                    'User-Agent': 'want-wallpapers-release'})
                with urllib.request.urlopen(request, timeout=30) as response:
                    body = response.read(2 * 1024 ** 2 + 1)
                    require(len(body) <= 2 * 1024 ** 2, 'GitHub evidence response is too large')
                    results.append(document(body.decode()))
                    links = response.headers.get('Link', '')
            except Exception as error:
                raise ReleaseError('Public GitHub release evidence unavailable') from error
            following = re.search(r'<([^>]+)>; rel="next"', links)
            url = following.group(1) if pages and following else None
            require(len(results) <= 100, 'GitHub evidence pagination exceeded')
        return results if pages else results[0]
    arguments = ['gh', 'api', 'repos/' + REPOSITORY + '/' + path]
    if pages:
        arguments += ['--paginate', '--slurp']
    return document(command(arguments))


def registry(reference, output='--raw'):
    if os.environ.get('WANT_RELEASE_PUBLIC_API') == '1':
        return public_registry(reference, output)
    arguments = ['docker', 'buildx', 'imagetools', 'inspect', reference]
    arguments += ['--raw'] if output == '--raw' else ['--format', output]
    value = command(arguments)
    return value if output == '{{.Manifest.Digest}}' else document(value)


def public_registry(reference, output):
    require(reference.startswith(IMAGE + '@') or reference.startswith(IMAGE + ':'), 'Invalid release registry reference')
    name = reference[len(IMAGE) + 1:]
    require(re.fullmatch(r'(sha256:[0-9a-f]{64}|[0-9a-f]{40}-[0-9]+-[0-9]+)', name), 'Invalid release registry reference')
    def fetch(url, headers=None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=30) as response:
                body = response.read(2 * 1024 ** 2 + 1)
            require(len(body) <= 2 * 1024 ** 2, 'Release registry response is too large')
            return body
        except ReleaseError:
            raise
        except Exception as error:
            raise ReleaseError('Public registry release evidence unavailable') from error
    query = urllib.parse.urlencode({'service': 'ghcr.io', 'scope': 'repository:' + REPOSITORY + ':pull'})
    token = document(fetch('https://ghcr.io/token?' + query).decode())['token']
    require(isinstance(token, str) and re.fullmatch(r'[A-Za-z0-9._~+/\-]+=*', token), 'Invalid registry authorization response')
    headers = {'Authorization': 'Bearer ' + token,
               'Accept': 'application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'}
    body = fetch('https://ghcr.io/v2/' + REPOSITORY + '/manifests/' + name, headers)
    actual = 'sha256:' + hashlib.sha256(body).hexdigest()
    require(not name.startswith('sha256:') or name == actual, 'Registry manifest checksum mismatch')
    if output == '{{.Manifest.Digest}}':
        return actual
    manifest = document(body.decode())
    if output == '--raw':
        return manifest
    require(output == '{{json .Image}}', 'Unsupported release registry output')
    config_digest = digest(manifest['config']['digest'])
    config = fetch('https://ghcr.io/v2/' + REPOSITORY + '/blobs/' + config_digest, headers)
    require('sha256:' + hashlib.sha256(config).hexdigest() == config_digest, 'Registry config checksum mismatch')
    return document(config.decode())


def digest(value):
    require(isinstance(value, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', value), 'Invalid image digest')
    return value


def source_sha(value):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value), 'Invalid source commit')
    return value


def timestamp(value):
    parsed = datetime.fromisoformat(value[:-1] + '+00:00' if value.endswith('Z') else value)
    require(parsed.tzinfo is not None, 'Release protection timestamp needs a timezone')
    return parsed


def profile():
    value = os.environ.get('VERIFICATION_PROFILE', 'full')
    require(value in PROFILES, 'Unknown verification profile')
    return value


def plan():
    event = os.environ.get('GITHUB_EVENT_NAME')
    ref = os.environ.get('GITHUB_REF', '')
    tag = os.environ.get('RELEASE_TAG', '')
    manual = event == 'workflow_dispatch'
    canonical = os.environ.get('GITHUB_REPOSITORY') == REPOSITORY
    publish = (manual and canonical and bool(tag) and ref == 'refs/tags/' + tag
               and os.environ.get('GITHUB_WORKFLOW_REF') == REPOSITORY + '/' + RELEASE_WORKFLOW + '@' + ref)
    checks = manual and (ref.startswith('refs/heads/') or publish)
    full = checks and canonical and (ref == 'refs/heads/main' or publish)
    return {'checks': checks, 'full': full, 'publish': publish, 'ui': full and profile() == 'full'}


def release_request(tag, expected_digest=None):
    require(plan()['publish'] and os.environ.get('RELEASE_TAG') == tag, 'Expected a manual release on its tag ref')
    if expected_digest:
        digest(expected_digest)
    sha = tag_commit(tag)
    require(sha == source_sha(os.environ['GITHUB_SHA']), 'Workflow source differs from release tag')
    return {'sourceSha': sha, 'verificationProfile': profile(), 'skippedChecks': PROFILES[profile()]}


def record_profile(record):
    require(type(record['schemaVersion']) is int, 'Invalid release record version')
    if record['schemaVersion'] == 1:
        require('verificationProfile' not in record and 'skippedChecks' not in record, 'Legacy evidence cannot select a profile')
        return 'full'
    require(record['schemaVersion'] == 2 and record['verificationProfile'] in PROFILES, 'Unknown verification profile')
    selected = record['verificationProfile']
    require(record['skippedChecks'] == PROFILES[selected], 'Verification profile and skipped checks differ')
    return selected


def tag_commit(tag):
    require(re.fullmatch(r'v[A-Za-z0-9][A-Za-z0-9._-]*', tag), 'Expected a v* release tag')
    reference = api('git/ref/tags/' + tag)['object']
    require(reference['type'] == 'tag', 'Release tag must be annotated')
    tagged = api('git/tags/' + source_sha(reference['sha']))['object']
    require(tagged['type'] == 'commit', 'Release tag must reference a commit directly')
    sha = source_sha(tagged['sha'])
    require(api('compare/' + sha + '...main')['status'] in ['ahead', 'identical'], 'Release commit is outside main history')
    policy = document((Path(__file__).resolve().parent.parent / '.github/release-policy.json').read_text())['tagRuleset']
    require(policy['bypassActors'] == [], 'Release policy must forbid bypass')
    rules = set()
    for page in api('rulesets?per_page=100', pages=True):
        for summary in page:
            if summary['id'] != policy['id'] or summary['target'] != 'tag' or summary['enforcement'] != 'active':
                continue
            ruleset = api('rulesets/' + str(summary['id']))
            require(ruleset['id'] == policy['id'] and timestamp(ruleset['updated_at']) == timestamp(policy['updatedAt']), 'Tag protection changed; review and refresh release-policy.json')
            require(ruleset.get('bypass_actors', policy['bypassActors']) == [], 'Release tag protection permits bypass')
            names = ruleset['conditions']['ref_name']
            matches = lambda pattern: pattern == '~ALL' or fnmatch.fnmatchcase('refs/tags/' + tag, pattern)
            if any(map(matches, names['include'])) and not any(map(matches, names['exclude'])):
                rules.update(rule['type'] for rule in ruleset['rules'])
    require({'update', 'deletion'} <= rules, 'Release tag needs active immutable protection without bypass')
    return sha


def main_run(run, sha):
    return (run.get('head_sha') == sha and run.get('head_branch') == 'main'
        and run.get('event') in ['push', 'workflow_dispatch'] and run.get('path') == WORKFLOW
        and run.get('head_repository', {}).get('full_name') == REPOSITORY)


def release_record(reference, sha, run, expected_digest=None):
    index_digest = digest(registry(reference, '{{.Manifest.Digest}}'))
    require(expected_digest is None or index_digest == expected_digest, 'Published index digest differs from the requested release')
    index = registry(IMAGE + '@' + index_digest)
    require(index['schemaVersion'] == 2 and index['mediaType'] == 'application/vnd.oci.image.index.v1+json', 'Expected an OCI image index')
    record = document(index['annotations'][ANNOTATION])
    require(record['repository'] == REPOSITORY and record['sourceSha'] == sha, 'Release record source mismatch')
    record_profile(record)
    workflow = WORKFLOW if record['schemaVersion'] == 1 else RELEASE_WORKFLOW
    verification = record['verificationRun']
    require(verification == {'id': run['id'], 'attempt': run['run_attempt'], 'workflow': workflow}, 'Release record run mismatch')
    require(type(verification['id']) is int and verification['id'] > 0 and type(verification['attempt']) is int and verification['attempt'] > 0, 'Invalid verification run identity')
    require(set(record['platforms']) == PLATFORMS and len(index['manifests']) == 2, 'Release requires exactly amd64 and arm64')
    descriptors = {entry['platform']['os'] + '/' + entry['platform']['architecture']: entry for entry in index['manifests']}
    require(set(descriptors) == PLATFORMS, 'Published platforms differ from the release record')
    for platform, checked in record['platforms'].items():
        platform_digest = digest(checked['digest'])
        require(descriptors[platform]['digest'] == platform_digest and checked['revision'] == sha, 'Platform digest or revision mismatch')
        reference = IMAGE + '@' + platform_digest
        manifest = registry(reference)
        require(manifest['config']['digest'] == digest(checked['configDigest']), 'Published platform differs from the tested image ID')
        config = registry(reference, '{{json .Image}}')
        require(config['os'] + '/' + config['architecture'] == platform and config['config']['Labels']['org.opencontainers.image.revision'] == sha, 'Platform OCI revision or architecture mismatch')
    return {**record, 'image': IMAGE + '@' + index_digest, 'indexDigest': index_digest}


def successful_attempt(sha, run_id, attempt_number, record=None, tag=None):
    require(type(run_id) is int and run_id > 0 and type(attempt_number) is int and attempt_number > 0,
            'Invalid verification run identity')
    attempt = api(f'actions/runs/{run_id}/attempts/{attempt_number}')
    require(attempt['id'] == run_id and attempt['run_attempt'] == attempt_number, 'Verification attempt mismatch')
    legacy = record is None or record['schemaVersion'] == 1
    selected = record_profile(record) if record is not None else 'full'
    if legacy:
        require(main_run(attempt, sha) and attempt['status'] == 'completed' and attempt['conclusion'] == 'success',
                'Verification attempt is not successful main evidence')
        prefix = ''
    else:
        require(attempt.get('head_sha') == sha and attempt.get('head_branch') == tag
                and attempt.get('event') == 'workflow_dispatch' and attempt.get('path') == RELEASE_WORKFLOW
                and attempt.get('head_repository', {}).get('full_name') == REPOSITORY
                and attempt['status'] in ['in_progress', 'completed'] and attempt.get('conclusion') != 'cancelled',
                'Verification attempt is not canonical manual release evidence')
        prefix = 'checks / '
    jobs = [job for page in api(f'actions/runs/{run_id}/attempts/{attempt_number}/jobs?per_page=100', pages=True)
            for job in page['jobs']]
    required = {'verify', 'Full UI', 'Runtime (amd64)', 'Runtime (arm64)', 'Publish (amd64)', 'Publish (arm64)', 'publish'}
    if not legacy:
        required.update({'Collection drafts', 'Release profile (' + selected + ')'})
    for name in required:
        matching = [job for job in jobs if job['name'] == prefix + name]
        require(len(matching) == 1 and matching[0]['conclusion'] == 'success',
                'Required verification/publication job did not succeed: ' + name)
    return attempt


def resolve(arguments):
    require(os.environ.get('GITHUB_REPOSITORY', REPOSITORY) == REPOSITORY, 'Forks cannot authorize releases')
    require(0 <= arguments.timeout <= 5400, 'Release timeout must be between 0 and 5400 seconds')
    if arguments.digest:
        digest(arguments.digest)
    sha = tag_commit(arguments.tag)
    if arguments.digest:
        reference = IMAGE + '@' + arguments.digest
        index = registry(reference)
        recorded = document(index['annotations'][ANNOTATION])
        require(recorded['repository'] == REPOSITORY and recorded['sourceSha'] == sha, 'Release record source mismatch')
        verification = recorded['verificationRun']
        record_profile(recorded)
        workflow = WORKFLOW if recorded['schemaVersion'] == 1 else RELEASE_WORKFLOW
        require(verification['workflow'] == workflow, 'Release record workflow mismatch')
        attempt = successful_attempt(sha, verification['id'], verification['attempt'], recorded, arguments.tag)
        record = release_record(reference, sha, attempt, arguments.digest)
        require(tag_commit(arguments.tag) == sha, 'Release tag changed during verification')
        return {**record, 'tag': arguments.tag}
    deadline = time.monotonic() + arguments.timeout
    while True:
        pages = api('actions/workflows/checks.yml/runs?head_sha=' + sha + '&branch=main&per_page=100', pages=True)
        candidates = [run for page in pages for run in page['workflow_runs'] if main_run(run, sha)]
        if candidates:
            run = max(candidates, key=lambda run: run['id'])
            if run['status'] == 'completed':
                require(run['conclusion'] == 'success', 'Matching main verification failed')
                successful_attempt(sha, run['id'], run['run_attempt'])
                reference = f"{IMAGE}:{sha}-{run['id']}-{run['run_attempt']}"
                record = release_record(reference, sha, run, arguments.digest)
                require(tag_commit(arguments.tag) == sha, 'Release tag changed during verification')
                return {**record, 'tag': arguments.tag}
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'Timed out waiting for matching successful main publication')
        time.sleep(min(30, remaining))



def checked_image(arguments):
    checked = document(Path(arguments.checked).read_text())
    loaded = document(command(['docker', 'image', 'inspect', 'want-wallpapers:local', '--format', '{{json .}}']))
    sha = source_sha(os.environ['GITHUB_SHA'])
    for image in [checked, loaded]:
        require(image['Id'] == checked['Id'] and image['Os'] == 'linux' and image['Architecture'] == arguments.arch,
            'Loaded image differs from the tested image ID or platform')
        require(image['Config']['Labels']['org.opencontainers.image.revision'] == sha, 'Tested image revision differs from the source commit')
    result = {'configDigest': digest(checked['Id']), 'revision': sha}
    if arguments.reference:
        result['digest'] = digest(registry(arguments.reference, '{{.Manifest.Digest}}'))
        manifest = registry(IMAGE + '@' + result['digest'])
        require(manifest['config']['digest'] == result['configDigest'], 'Published image differs from the tested image ID')
    return result



def create_record(arguments):
    release_request(os.environ.get('RELEASE_TAG', ''))
    sha = source_sha(os.environ['GITHUB_SHA'])
    platforms = {}
    for arch in ['amd64', 'arm64']:
        checked = document((Path(arguments.platform_directory) / (arch + '.json')).read_text())
        require(checked['revision'] == sha, 'Tested platform revision differs from the source commit')
        digest(checked['digest'])
        digest(checked['configDigest'])
        platforms['linux/' + arch] = checked
    run_id, attempt = int(os.environ['GITHUB_RUN_ID']), int(os.environ['GITHUB_RUN_ATTEMPT'])
    require(run_id > 0 and attempt > 0, 'Invalid verification run identity')
    return {'schemaVersion': 2, 'repository': REPOSITORY, 'sourceSha': sha, 'platforms': platforms,
        'verificationProfile': profile(), 'skippedChecks': PROFILES[profile()],
        'verificationRun': {'id': run_id, 'attempt': attempt, 'workflow': RELEASE_WORKFLOW}}


def publish_index(arguments):
    release_request(os.environ.get('RELEASE_TAG', ''))
    record = document(Path(arguments.record).read_text())
    sha = source_sha(os.environ['GITHUB_SHA'])
    run = {'id': int(os.environ['GITHUB_RUN_ID']), 'run_attempt': int(os.environ['GITHUB_RUN_ATTEMPT'])}
    require(record['schemaVersion'] == 2 and record_profile(record) == profile()
        and record['repository'] == REPOSITORY and record['sourceSha'] == sha
        and record['verificationRun'] == {'id': run['id'], 'attempt': run['run_attempt'], 'workflow': RELEASE_WORKFLOW}, 'Release publication identity mismatch')
    require(set(record['platforms']) == PLATFORMS, 'Release requires exactly amd64 and arm64')
    references = [IMAGE + '@' + digest(record['platforms'][platform]['digest']) for platform in sorted(PLATFORMS)]
    index = document(command(['docker', 'buildx', 'imagetools', 'create', '--dry-run', *references]))
    descriptors = {entry['platform']['os'] + '/' + entry['platform']['architecture']: entry['digest'] for entry in index['manifests']}
    require(index['schemaVersion'] == 2 and len(index['manifests']) == 2
        and descriptors == {platform: checked['digest'] for platform, checked in record['platforms'].items()}, 'OCI index sources differ from the tested platforms')
    index['mediaType'] = 'application/vnd.oci.image.index.v1+json'
    index['annotations'] = {ANNOTATION: json.dumps(record, sort_keys=True),
        'org.opencontainers.image.source': 'https://github.com/' + REPOSITORY, 'org.opencontainers.image.revision': sha}
    body = json.dumps(index, sort_keys=True).encode()
    expected_digest = 'sha256:' + hashlib.sha256(body).hexdigest()
    reference = f"{sha}-{run['id']}-{run['run_attempt']}"
    curl = ['curl', '-q', '--fail', '--silent', '--show-error', '--max-time', '60', '--config', '-']
    credentials = os.environ['GITHUB_ACTOR'] + ':' + os.environ['GHCR_TOKEN']
    authorization = document(command([*curl, 'https://ghcr.io/token?service=ghcr.io&scope=repository:' + REPOSITORY + ':pull,push'],
        input='user = ' + json.dumps(credentials) + '\n'))['token']
    require(isinstance(authorization, str) and re.fullmatch(r'[A-Za-z0-9._~+/\-]+=*', authorization), 'Invalid registry authorization response')
    headers = 'header = ' + json.dumps('Authorization: Bearer ' + authorization) + '\n'
    headers += 'header = ' + json.dumps('Content-Type: ' + index['mediaType']) + '\n'
    with tempfile.TemporaryDirectory() as directory:
        manifest = Path(directory) / 'index.json'
        manifest.write_bytes(body)
        command([*curl, '--request', 'PUT', '--data-binary', '@' + str(manifest),
            'https://ghcr.io/v2/' + REPOSITORY + '/manifests/' + reference], input=headers)
    return release_record(IMAGE + ':' + reference, sha, run, expected_digest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('plan')
    guard = commands.add_parser('guard')
    guard.add_argument('--tag', required=True)
    guard.add_argument('--digest')
    publication = commands.add_parser('publish-index')
    publication.add_argument('--record', required=True)
    record = commands.add_parser('record')
    record.add_argument('--platform-directory', required=True)
    image = commands.add_parser('image')
    image.add_argument('--checked', required=True)
    image.add_argument('--arch', required=True, choices=['amd64', 'arm64'])
    image.add_argument('--reference')
    resolver = commands.add_parser('resolve')
    resolver.add_argument('--tag', required=True)
    resolver.add_argument('--timeout', type=int, default=5400)
    resolver.add_argument('--digest', help='Require the original index digest when repeating a release')
    arguments = parser.parse_args()
    try:
        operations = {'guard': lambda: release_request(arguments.tag, arguments.digest), 'plan': lambda: plan(), 'resolve': lambda: resolve(arguments), 'image': lambda: checked_image(arguments), 'record': lambda: create_record(arguments), 'publish-index': lambda: publish_index(arguments)}
        value = operations[arguments.command]()
        print(json.dumps(value, sort_keys=True))
    except (ReleaseError, KeyError, TypeError, ValueError, AttributeError, IndexError, OSError, subprocess.TimeoutExpired) as error:
        message = str(error) if isinstance(error, ReleaseError) else 'Malformed or unavailable release evidence'
        print(message, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

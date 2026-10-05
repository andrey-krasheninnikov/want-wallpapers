#!/usr/bin/env python3
"""Select CI checks and resolve the immutable evidence for a release tag."""
import argparse
import fnmatch
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

REPOSITORY = 'andrey-krasheninnikov/want-wallpapers'
IMAGE = 'ghcr.io/' + REPOSITORY
WORKFLOW = '.github/workflows/checks.yml'
ANNOTATION = 'foundation.want.wallpapers.release.v1'
PLATFORMS = {'linux/amd64', 'linux/arm64'}


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def command(arguments):
    result = subprocess.run(arguments, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, f'{arguments[0]} {arguments[1]} failed; release evidence unavailable')
    return result.stdout.strip()


def document(value):
    try:
        return json.loads(value)
    except (ValueError, TypeError) as error:
        raise ReleaseError('Invalid JSON release evidence') from error


def api(path, pages=False):
    arguments = ['gh', 'api', 'repos/' + REPOSITORY + '/' + path]
    if pages:
        arguments += ['--paginate', '--slurp']
    return document(command(arguments))


def registry(reference, output='--raw'):
    arguments = ['docker', 'buildx', 'imagetools', 'inspect', reference]
    arguments += ['--raw'] if output == '--raw' else ['--format', output]
    value = command(arguments)
    return value if output == '{{.Manifest.Digest}}' else document(value)


def digest(value):
    require(isinstance(value, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', value), 'Invalid image digest')
    return value


def source_sha(value):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value), 'Invalid source commit')
    return value


def plan():
    event = os.environ.get('GITHUB_EVENT_NAME')
    ref = os.environ.get('GITHUB_REF', '')
    checks = event == 'pull_request' or (event in ['push', 'workflow_dispatch'] and ref.startswith('refs/heads/'))
    full = checks and event != 'pull_request' and ref == 'refs/heads/main' and os.environ.get('GITHUB_REPOSITORY') == REPOSITORY
    return {'checks': checks, 'full': full}


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
            require(ruleset['id'] == policy['id'] and ruleset['updated_at'] == policy['updatedAt'], 'Tag protection changed; review and refresh release-policy.json')
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
    require(record['schemaVersion'] == 1 and record['repository'] == REPOSITORY and record['sourceSha'] == sha, 'Release record source mismatch')
    verification = record['verificationRun']
    require(verification == {'id': run['id'], 'attempt': run['run_attempt'], 'workflow': WORKFLOW}, 'Release record run mismatch')
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


def resolve(arguments):
    require(os.environ.get('GITHUB_REPOSITORY', REPOSITORY) == REPOSITORY, 'Forks cannot authorize releases')
    require(0 <= arguments.timeout <= 5400, 'Release timeout must be between 0 and 5400 seconds')
    if arguments.digest:
        digest(arguments.digest)
    sha = tag_commit(arguments.tag)
    deadline = time.monotonic() + arguments.timeout
    while True:
        pages = api('actions/workflows/checks.yml/runs?head_sha=' + sha + '&branch=main&per_page=100', pages=True)
        candidates = [run for page in pages for run in page['workflow_runs'] if main_run(run, sha)]
        if candidates:
            run = max(candidates, key=lambda run: run['id'])
            if run['status'] == 'completed':
                require(run['conclusion'] == 'success', 'Matching main verification failed')
                attempt = api(f"actions/runs/{run['id']}/attempts/{run['run_attempt']}")
                require(main_run(attempt, sha) and attempt['status'] == 'completed' and attempt['conclusion'] == 'success', 'Verification attempt is not successful main evidence')
                jobs = [job for page in api(f"actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs?per_page=100", pages=True) for job in page['jobs']]
                required = {'verify', 'Full UI', 'Runtime (amd64)', 'Runtime (arm64)', 'Publish (amd64)', 'Publish (arm64)', 'publish'}
                require(required <= {job['name'] for job in jobs if job['conclusion'] == 'success'}, 'Full main verification/publication jobs did not all succeed')
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
    require(plan()['full'], 'Only canonical main verification can publish release records')
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
    return {'schemaVersion': 1, 'repository': REPOSITORY, 'sourceSha': sha, 'platforms': platforms,
        'verificationRun': {'id': run_id, 'attempt': attempt, 'workflow': WORKFLOW}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('plan')
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
        operations = {'plan': lambda: plan(), 'resolve': lambda: resolve(arguments), 'image': lambda: checked_image(arguments), 'record': lambda: create_record(arguments)}
        value = operations[arguments.command]()
        print(json.dumps(value, sort_keys=True))
    except (ReleaseError, KeyError, TypeError, ValueError, AttributeError, IndexError, OSError, subprocess.TimeoutExpired) as error:
        message = str(error) if isinstance(error, ReleaseError) else 'Malformed or unavailable release evidence'
        print(message, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

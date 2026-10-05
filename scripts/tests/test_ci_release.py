"""Exercise the CI command's public event and release contracts."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

COMMAND = Path(__file__).resolve().parents[1] / 'ci-release.py'
REPOSITORY = 'andrey-krasheninnikov/want-wallpapers'


class EventSelection(unittest.TestCase):
    def plan(self, event, ref, repository=REPOSITORY):
        result = subprocess.run([sys.executable, str(COMMAND), 'plan'], capture_output=True, text=True,
            env={**os.environ, 'GITHUB_EVENT_NAME': event, 'GITHUB_REF': ref, 'GITHUB_REPOSITORY': repository})
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_feature_push_has_only_lightweight_checks(self):
        self.assertEqual(self.plan('push', 'refs/heads/feature/example'),
            {'checks': True, 'full': False})

    def test_event_matrix_never_runs_full_checks_for_prs_forks_or_tags(self):
        for event, ref, repository, expected in [
            ('push', 'refs/heads/development', REPOSITORY, {'checks': True, 'full': False}),
            ('push', 'refs/heads/release/v1.4.0', REPOSITORY, {'checks': True, 'full': False}),
            ('push', 'refs/heads/main', REPOSITORY, {'checks': True, 'full': True}),
            ('workflow_dispatch', 'refs/heads/main', REPOSITORY, {'checks': True, 'full': True}),
            ('workflow_dispatch', 'refs/heads/feature/example', REPOSITORY, {'checks': True, 'full': False}),
            ('pull_request', 'refs/pull/4/merge', REPOSITORY, {'checks': True, 'full': False}),
            ('push', 'refs/heads/main', 'visitor/wallpapers', {'checks': True, 'full': False}),
            ('push', 'refs/tags/v1.4.0', REPOSITORY, {'checks': False, 'full': False}),
            ('workflow_dispatch', 'refs/tags/v1.4.0', REPOSITORY, {'checks': False, 'full': False}),
        ]:
            with self.subTest(event=event, ref=ref, repository=repository):
                self.assertEqual(self.plan(event, ref, repository), expected)


class ReleaseResolution(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.sha = '1' * 40
        self.digest = 'sha256:' + '2' * 64
        self.record = {
            'schemaVersion': 1, 'repository': REPOSITORY, 'sourceSha': self.sha,
            'verificationRun': {'id': 73, 'attempt': 1, 'workflow': '.github/workflows/checks.yml'},
            'platforms': {
                'linux/amd64': {'digest': 'sha256:' + '3' * 64, 'configDigest': 'sha256:' + '5' * 64, 'revision': self.sha},
                'linux/arm64': {'digest': 'sha256:' + '4' * 64, 'configDigest': 'sha256:' + '6' * 64, 'revision': self.sha},
            },
        }
        self.run = {'id': 73, 'run_attempt': 1, 'workflow_id': 374816820,
            'path': '.github/workflows/checks.yml', 'event': 'push', 'head_branch': 'main',
            'head_sha': self.sha, 'head_repository': {'full_name': REPOSITORY},
            'status': 'completed', 'conclusion': 'success'}
        self.actual_platforms = json.loads(json.dumps(self.record['platforms']))
        self.loaded_image = {'Id': 'sha256:' + '5' * 64, 'Os': 'linux', 'Architecture': 'amd64',
            'Config': {'Labels': {'org.opencontainers.image.revision': self.sha}}}
        self.responses = {
            'git/ref/tags/v1.4.0': {'object': {'type': 'tag', 'sha': '7' * 40}},
            'git/tags/' + '7' * 40: {'object': {'type': 'commit', 'sha': self.sha}},
            'compare/' + self.sha + '...main': {'status': 'ahead'},
            'rulesets?per_page=100': [[{'id': 24392512, 'target': 'tag', 'enforcement': 'active'}]],
            'rulesets/24392512': {'id': 24392512, 'updated_at': '2026-10-03T00:38:23.060+03:00', 'target': 'tag', 'enforcement': 'active', 'bypass_actors': [],
                'conditions': {'ref_name': {'include': ['refs/tags/v*'], 'exclude': []}},
                'rules': [{'type': 'update'}, {'type': 'deletion'}]},
            'actions/workflows/checks.yml/runs?head_sha=' + self.sha + '&branch=main&per_page=100': [{'workflow_runs': [self.run]}],
            'actions/runs/73/attempts/1': self.run,
            'actions/runs/73/attempts/1/jobs?per_page=100': [{'jobs': [
                {'name': name, 'conclusion': 'success'} for name in
                ['verify', 'Full UI', 'Runtime (amd64)', 'Runtime (arm64)', 'Publish (amd64)', 'Publish (arm64)', 'publish']]}],
        }
        stub = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
fixture = json.loads(Path(os.environ['RELEASE_FIXTURE']).read_text())
if Path(sys.argv[0]).name == 'gh':
    prefix = 'repos/' + fixture['repository'] + '/'
    key = next(value[len(prefix):] for value in sys.argv if value.startswith(prefix))
    if key not in fixture['responses']: sys.exit(4)
    response = fixture['responses'][key]
    if key == fixture.get('pendingOnce'):
        state = Path(os.environ['RELEASE_FIXTURE'] + '.pending')
        if not state.exists():
            state.touch()
            response = [{'workflow_runs': []}]
    print(json.dumps(response))
else:
    if sys.argv[1:3] == ['image', 'inspect']:
        print(json.dumps(fixture['loadedImage']))
        sys.exit(0)
    reference = sys.argv[4]
    if '--raw' in sys.argv:
        if reference.endswith(fixture['digest']) or reference.endswith('-73-1'):
            print(json.dumps(fixture['index']))
        else:
            platform = next(value for value in fixture['actualPlatforms'].values() if reference.endswith(value['digest']))
            print(json.dumps({'schemaVersion': 2, 'config': {'digest': platform['configDigest']}}))
    elif '{{json .Image}}' in sys.argv:
        name = next(name for name, value in fixture['actualPlatforms'].items() if reference.endswith(value['digest']))
        print(json.dumps({'architecture': name.split('/')[1], 'os': 'linux',
            'config': {'Labels': {'org.opencontainers.image.revision': fixture['actualPlatforms'][name]['revision']}}}))
    else:
        print(fixture['digest'])
'''
        for name in ['gh', 'docker']:
            executable = self.root / name
            executable.write_text(stub)
            executable.chmod(0o700)

    def execute(self, arguments):
        index = {'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json',
            'annotations': {'foundation.want.wallpapers.release.v1': json.dumps(self.record)},
            'manifests': [{'digest': value['digest'], 'platform': {'os': 'linux', 'architecture': name.split('/')[1]}}
                for name, value in self.record['platforms'].items()]}
        fixture = self.root / 'fixture.json'
        fixture.write_text(json.dumps({'repository': REPOSITORY, 'responses': self.responses,
            'record': self.record, 'pendingOnce': getattr(self, 'pending_once', None), 'actualPlatforms': self.actual_platforms, 'loadedImage': self.loaded_image, 'index': index, 'digest': self.digest}))
        return subprocess.run([sys.executable, str(COMMAND), *arguments],
            capture_output=True, text=True, env={**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'],
                'RELEASE_FIXTURE': str(fixture), 'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_SHA': self.sha, 'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main',
                'GITHUB_RUN_ID': '73', 'GITHUB_RUN_ATTEMPT': '1'})

    def resolve(self, *arguments):
        return self.execute(['resolve', '--tag', 'v1.4.0', '--timeout', '0', *arguments])

    def test_protected_annotated_tag_resolves_exact_verified_digest(self):
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output['sourceSha'], self.sha)
        self.assertEqual(output['image'], 'ghcr.io/' + REPOSITORY + '@' + self.digest)
        self.assertEqual(output['verificationRun'], self.record['verificationRun'])

    def test_readonly_token_can_verify_the_pinned_ruleset_version(self):
        del self.responses['rulesets/24392512']['bypass_actors']
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_successful_run_with_skipped_full_verification_is_rejected(self):
        self.responses['actions/runs/73/attempts/1/jobs?per_page=100'] = [{'jobs': [{'name': 'Full UI', 'conclusion': 'skipped'}]}]
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_changed_protection_version_is_rejected(self):
        self.responses['rulesets/24392512']['updated_at'] = '2026-10-05T01:00:00Z'
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_bypass_and_excluded_tag_are_rejected(self):
        for field, value in [('bypass_actors', [{'actor_type': 'User', 'actor_id': 9}]),
                             ('conditions', {'ref_name': {'include': ['refs/tags/v*'], 'exclude': ['refs/tags/v1*']}})]:
            original = self.responses['rulesets/24392512'][field]
            self.responses['rulesets/24392512'][field] = value
            self.assertNotEqual(self.resolve().returncode, 0)
            self.responses['rulesets/24392512'][field] = original

    def test_lightweight_tag_and_non_main_commit_are_rejected(self):
        self.responses['git/ref/tags/v1.4.0']['object']['type'] = 'commit'
        self.assertNotEqual(self.resolve().returncode, 0)
        self.responses['git/ref/tags/v1.4.0']['object']['type'] = 'tag'
        self.responses['compare/' + self.sha + '...main']['status'] = 'diverged'
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_pending_or_missing_main_verification_times_out(self):
        self.run['status'] = 'in_progress'
        self.assertNotEqual(self.resolve().returncode, 0)
        self.responses['actions/workflows/checks.yml/runs?head_sha=' + self.sha + '&branch=main&per_page=100'] = [{'workflow_runs': []}]
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_early_tag_waits_for_matching_main_publication(self):
        self.pending_once = 'actions/workflows/checks.yml/runs?head_sha=' + self.sha + '&branch=main&per_page=100'
        result = self.execute(['resolve', '--tag', 'v1.4.0', '--timeout', '1'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['indexDigest'], self.digest)

    def test_failed_main_and_wrong_attempt_are_rejected(self):
        self.run['conclusion'] = 'failure'
        self.assertNotEqual(self.resolve().returncode, 0)
        self.run['conclusion'] = 'success'
        self.record['verificationRun']['attempt'] = 2
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_revision_config_and_requested_digest_must_match(self):
        self.record['platforms']['linux/arm64']['revision'] = '0' * 40
        self.assertNotEqual(self.resolve().returncode, 0)
        self.record['platforms']['linux/arm64']['revision'] = self.sha
        self.record['platforms']['linux/arm64']['configDigest'] = 'sha256:' + '0' * 64
        self.assertNotEqual(self.resolve().returncode, 0)
        self.record['platforms']['linux/arm64']['configDigest'] = 'sha256:' + '6' * 64
        self.assertNotEqual(self.resolve('--digest', 'sha256:' + '0' * 64).returncode, 0)
        self.assertEqual(self.resolve('--digest', self.digest).returncode, 0)

    def test_wrong_source_and_incomplete_platform_record_are_rejected(self):
        self.record['sourceSha'] = '0' * 40
        self.assertNotEqual(self.resolve().returncode, 0)
        self.record['sourceSha'] = self.sha
        del self.record['platforms']['linux/arm64']
        self.assertNotEqual(self.resolve().returncode, 0)

    def test_loaded_image_must_equal_the_tested_image(self):
        checked = self.root / 'checked-image.json'
        checked.write_text(json.dumps(self.loaded_image))
        result = self.execute(['image', '--checked', str(checked), '--arch', 'amd64'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['configDigest'], 'sha256:' + '5' * 64)
        self.loaded_image['Id'] = 'sha256:' + '0' * 64
        self.assertNotEqual(self.execute(['image', '--checked', str(checked), '--arch', 'amd64']).returncode, 0)

    def test_release_record_preserves_tested_platform_and_run_identity(self):
        for platform, value in self.record['platforms'].items():
            (self.root / (platform.split('/')[1] + '.json')).write_text(json.dumps(value))
        result = self.execute(['record', '--platform-directory', str(self.root)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), self.record)


if __name__ == '__main__':
    unittest.main()

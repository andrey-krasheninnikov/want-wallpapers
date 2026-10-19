"""Exercise the CI command's public event and release contracts."""
import json
import os
import re
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

    def test_only_explicit_manual_events_select_checks(self):
        for event in ['push', 'pull_request', 'schedule', 'workflow_run']:
            for ref in ['refs/heads/main', 'refs/heads/development', 'refs/tags/v1.4.0']:
                with self.subTest(event=event, ref=ref):
                    self.assertEqual(self.plan(event, ref), {'checks': False, 'full': False, 'publish': False, 'ui': False})
        self.assertEqual(self.plan('workflow_dispatch', 'refs/heads/main'),
                         {'checks': True, 'full': True, 'publish': False, 'ui': True})
        self.assertEqual(self.plan('workflow_dispatch', 'refs/heads/feature/example'),
                         {'checks': True, 'full': False, 'publish': False, 'ui': False})
        self.assertEqual(self.plan('workflow_dispatch', 'refs/heads/main', 'visitor/wallpapers'),
                         {'checks': True, 'full': False, 'publish': False, 'ui': False})
        self.assertFalse(self.plan('workflow_dispatch', 'refs/tags/v1.4.0')['publish'])

    def test_workflows_have_no_automatic_entry_points(self):
        for path in (COMMAND.parent.parent / '.github/workflows').glob('*.yml'):
            header = path.read_text().split('\npermissions:', 1)[0]
            events = set(re.findall(r'^  ([a-z_]+):', header, re.M))
            with self.subTest(workflow=path.name):
                self.assertTrue(events)
                self.assertLessEqual(events, {'workflow_dispatch', 'workflow_call'})

    def test_release_chain_has_one_gate_and_publication_depends_on_all_checks(self):
        workflows = COMMAND.parent.parent / '.github/workflows'
        release = (workflows / 'deploy-production.yml').read_text()
        self.assertEqual(release.count('uses: ./.github/workflows/release-gate.yml'), 1)
        self.assertIn('uses: ./.github/workflows/checks.yml', release)
        self.assertIn("needs.guard.result == 'success'", release)
        self.assertIn("needs.eligibility.result == 'success'", release)
        checks = (workflows / 'checks.yml').read_text()
        verify = checks.split('\n  verify:\n')[1].split('\n  drafts:\n')[0]
        self.assertIn('needs: selection', verify)
        for job in ['publish-platforms', 'publish']:
            # Read only the job header before its first runner, not step content.
            header = checks.split('\n  ' + job + ':\n')[1].split('    runs-on:', 1)[0]
            for required in ['verify', 'drafts', 'ui', 'containers']:
                self.assertIn(required, header)
            self.assertIn("needs.selection.outputs.publish == 'true'", header)


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
import hashlib, json, os, sys
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
elif Path(sys.argv[0]).name == 'curl':
    configuration = sys.stdin.read()
    assert not any('test-only' in argument or 'test+registry/token==' in argument for argument in sys.argv)
    if '/token?' in sys.argv[-1]:
        print(json.dumps({'token': 'test+registry/token=='}))
    else:
        assert 'Content-Type: application/vnd.oci.image.index.v1+json' in configuration
        body = Path(sys.argv[sys.argv.index('--data-binary') + 1][1:]).read_bytes()
        Path(os.environ['RELEASE_FIXTURE'] + '.published').write_bytes(body)
else:
    published = Path(os.environ['RELEASE_FIXTURE'] + '.published')
    index_digest = 'sha256:' + hashlib.sha256(published.read_bytes()).hexdigest() if published.exists() else fixture['digest']
    if sys.argv[1:4] == ['buildx', 'imagetools', 'create']:
        index = fixture['index']
        index['mediaType'] = 'application/vnd.docker.distribution.manifest.list.v2+json'
        index.pop('annotations')
        for manifest in index['manifests']:
            manifest.update({'mediaType': 'application/vnd.docker.distribution.manifest.v2+json', 'size': 1000})
        print(json.dumps(index))
        sys.exit(0)
    if sys.argv[1:3] == ['image', 'inspect']:
        print(json.dumps(fixture['loadedImage']))
        sys.exit(0)
    reference = sys.argv[4]
    if '--raw' in sys.argv:
        if reference.endswith(index_digest) or reference.endswith('-73-1'):
            print(published.read_text() if published.exists() else json.dumps(fixture['index']))
        else:
            platform = next(value for value in fixture['actualPlatforms'].values() if reference.endswith(value['digest']))
            print(json.dumps({'schemaVersion': 2, 'config': {'digest': platform['configDigest']}}))
    elif '{{json .Image}}' in sys.argv:
        name = next(name for name, value in fixture['actualPlatforms'].items() if reference.endswith(value['digest']))
        print(json.dumps({'architecture': name.split('/')[1], 'os': 'linux',
            'config': {'Labels': {'org.opencontainers.image.revision': fixture['actualPlatforms'][name]['revision']}}}))
    else:
        print(index_digest)
'''
        for name in ['gh', 'docker', 'curl']:
            executable = self.root / name
            executable.write_text(stub)
            executable.chmod(0o700)

    def manual_release(self, profile='full'):
        self.selected_profile = profile
        self.record.update(schemaVersion=2, verificationProfile=profile, skippedChecks=[] if profile == 'full' else ['Full UI'])
        self.record['verificationRun']['workflow'] = '.github/workflows/deploy-production.yml'
        self.run.update(event='workflow_dispatch', head_branch='v1.4.0',
                        path='.github/workflows/deploy-production.yml', status='in_progress', conclusion=None)
        self.responses['actions/runs/73/attempts/1/jobs?per_page=100'] = [{'jobs': [
            {'name': 'checks / ' + name, 'conclusion': 'success'} for name in
            ['Release profile (' + profile + ')', 'verify', 'Collection drafts', 'Full UI', 'Runtime (amd64)',
             'Runtime (arm64)', 'Publish (amd64)', 'Publish (arm64)', 'publish']]}]
        if profile == 'fast':
            self.responses['actions/runs/73/attempts/1/jobs?per_page=100'][0]['jobs'][3]['conclusion'] = 'skipped'

    def execute(self, arguments, **environment):
        index = {'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json',
            'annotations': {'foundation.want.wallpapers.release.v1': json.dumps(self.record)},
            'manifests': [{'digest': value['digest'], 'platform': {'os': 'linux', 'architecture': name.split('/')[1]}}
                for name, value in self.record['platforms'].items()]}
        fixture = self.root / 'fixture.json'
        fixture.write_text(json.dumps({'repository': REPOSITORY, 'responses': self.responses,
            'record': self.record, 'pendingOnce': getattr(self, 'pending_once', None), 'actualPlatforms': self.actual_platforms, 'loadedImage': self.loaded_image, 'index': index, 'digest': self.digest}))
        return subprocess.run([sys.executable, str(COMMAND), *arguments],
            capture_output=True, text=True, env={**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'],
                'RELEASE_FIXTURE': str(fixture), 'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_SHA': self.sha, 'GITHUB_EVENT_NAME': 'workflow_dispatch',
                'GITHUB_REF': 'refs/tags/v1.4.0', 'RELEASE_TAG': 'v1.4.0',
                'VERIFICATION_PROFILE': getattr(self, 'selected_profile', 'full'),
                'GITHUB_WORKFLOW_REF': REPOSITORY + '/.github/workflows/deploy-production.yml@refs/tags/v1.4.0',
                'GITHUB_RUN_ID': '73', 'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_ACTOR': 'release-owner', 'GHCR_TOKEN': 'test-only', **environment})

    def resolve(self, *arguments):
        return self.execute(['resolve', '--tag', 'v1.4.0', '--timeout', '0', *arguments])

    def test_protected_annotated_tag_resolves_exact_verified_digest(self):
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output['sourceSha'], self.sha)
        self.assertEqual(output['image'], 'ghcr.io/' + REPOSITORY + '@' + self.digest)
        self.assertEqual(output['verificationRun'], self.record['verificationRun'])

    def test_exact_digest_retry_keeps_the_original_successful_run_after_a_new_publication(self):
        newer = {**self.run, 'id': 74, 'run_attempt': 2}
        self.responses['actions/workflows/checks.yml/runs?head_sha=' + self.sha + '&branch=main&per_page=100'] = [
            {'workflow_runs': [newer, self.run]}]
        result = self.resolve('--digest', self.digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['verificationRun'], self.record['verificationRun'])

    def test_release_guard_checks_manual_context_and_protected_main_tag(self):
        result = self.execute(['guard', '--tag', 'v1.4.0'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['verificationProfile'], 'full')
        for environment in [{'GITHUB_EVENT_NAME': 'push'}, {'GITHUB_REF': 'refs/heads/main'},
                            {'GITHUB_REPOSITORY': 'visitor/fork'}, {'GITHUB_SHA': '0' * 40},
                            {'GITHUB_WORKFLOW_REF': REPOSITORY + '/.github/workflows/checks.yml@refs/tags/v1.4.0'}]:
            with self.subTest(environment=environment):
                self.assertNotEqual(self.execute(['guard', '--tag', 'v1.4.0'], **environment).returncode, 0)
        self.responses['git/ref/tags/v1.4.0']['object']['type'] = 'commit'
        self.assertNotEqual(self.execute(['guard', '--tag', 'v1.4.0']).returncode, 0)

    def test_manual_full_chain_accepts_completed_jobs_while_deployment_is_running(self):
        self.manual_release()
        result = self.resolve('--digest', self.digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['verificationProfile'], 'full')

    def test_manual_evidence_cannot_skip_any_required_job(self):
        self.manual_release()
        jobs = self.responses['actions/runs/73/attempts/1/jobs?per_page=100'][0]['jobs']
        for job in jobs:
            job['conclusion'] = 'skipped'
            with self.subTest(job=job['name']):
                self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)
            job['conclusion'] = 'success'

    def test_fast_release_accepts_only_the_explicit_ui_skip_and_publishes_new_images(self):
        self.manual_release('fast')
        result = self.resolve('--digest', self.digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['skippedChecks'], ['Full UI'])
        for platform, value in self.record['platforms'].items():
            (self.root / (platform.split('/')[1] + '.json')).write_text(json.dumps(value))
        result = self.execute(['record', '--platform-directory', str(self.root)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), self.record)
        record = self.root / 'release-record.json'
        record.write_text(result.stdout)
        result = self.execute(['publish-index', '--record', str(record)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['verificationProfile'], 'fast')

    def test_fast_profile_cannot_skip_other_jobs_or_claim_full_profile(self):
        self.manual_release('fast')
        jobs = self.responses['actions/runs/73/attempts/1/jobs?per_page=100'][0]['jobs']
        for job in jobs:
            previous = job['conclusion']
            job['conclusion'] = 'failure'
            with self.subTest(job=job['name']):
                self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)
            job['conclusion'] = previous
        self.record.update(verificationProfile='full', skippedChecks=[])
        self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)

    def test_changed_or_missing_fast_profile_is_rejected(self):
        self.manual_release('fast')
        for key, value in [('verificationProfile', 'unknown'), ('verificationProfile', 'full'),
                           ('skippedChecks', []), ('skippedChecks', ['verify', 'Full UI']),
                           ('schemaVersion', 1), ('schemaVersion', None)]:
            old = self.record[key]
            self.record[key] = value
            with self.subTest(key=key, value=value):
                self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)
            self.record[key] = old
        del self.record['skippedChecks']
        self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)

    def test_manual_evidence_rejects_wrong_sources_and_profile_data(self):
        self.manual_release()
        for key, value in [('event', 'push'), ('head_branch', 'main'), ('head_sha', '0' * 40),
                           ('path', '.github/workflows/checks.yml'), ('conclusion', 'cancelled')]:
            old = self.run[key]
            self.run[key] = value
            with self.subTest(field=key):
                self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)
            self.run[key] = old
        for key, value in [('verificationProfile', None), ('verificationProfile', 'unknown'),
                           ('skippedChecks', ['Full UI'])]:
            old = self.record[key]
            self.record[key] = value
            with self.subTest(field=key, value=value):
                self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)
            self.record[key] = old
        del self.record['verificationProfile']
        self.assertNotEqual(self.resolve('--digest', self.digest).returncode, 0)

    def test_readonly_token_can_verify_the_pinned_ruleset_version(self):
        del self.responses['rulesets/24392512']['bypass_actors']
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_readonly_token_accepts_equivalent_utc_protection_timestamp(self):
        self.responses['rulesets/24392512']['updated_at'] = '2026-10-02T21:38:23.060Z'
        del self.responses['rulesets/24392512']['bypass_actors']
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_protection_timestamp_without_timezone_is_rejected(self):
        self.responses['rulesets/24392512']['updated_at'] = '2026-10-02T21:38:23.060'
        result = self.resolve()
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertIn('Release protection timestamp needs a timezone', result.stderr)

    def test_malformed_protection_timestamps_are_rejected(self):
        for value in ['not-a-timestamp', '2026-10-02T21:38:23.060z', '2026-10-02T21:38:23.060+00:00Z', None]:
            with self.subTest(value=value):
                self.responses['rulesets/24392512']['updated_at'] = value
                result = self.resolve()
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, '')
                self.assertIn('Malformed or unavailable release evidence', result.stderr)

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

    def test_docker_platform_manifests_publish_an_oci_index_with_durable_record(self):
        self.manual_release()
        record = self.root / 'release-record.json'
        record.write_text(json.dumps(self.record))
        result = self.execute(['publish-index', '--record', str(record)])
        self.assertEqual(result.returncode, 0, result.stderr)
        published = json.loads((self.root / 'fixture.json.published').read_text())
        self.assertEqual(published['mediaType'], 'application/vnd.oci.image.index.v1+json')
        self.assertEqual(json.loads(published['annotations']['foundation.want.wallpapers.release.v1']), self.record)
        self.assertEqual({entry['digest'] for entry in published['manifests']},
            {value['digest'] for value in self.record['platforms'].values()})
        self.assertEqual(json.loads(result.stdout)['sourceSha'], self.sha)
        self.assertEqual(json.loads(result.stdout)['platforms'], self.record['platforms'])

    def test_release_record_preserves_tested_platform_and_run_identity(self):
        self.manual_release()
        for platform, value in self.record['platforms'].items():
            (self.root / (platform.split('/')[1] + '.json')).write_text(json.dumps(value))
        result = self.execute(['record', '--platform-directory', str(self.root)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), self.record)


if __name__ == '__main__':
    unittest.main()

import copy
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from deployment import DeployError
spec = importlib.util.spec_from_file_location('worker', ROOT / 'scripts/backup-worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

PUBLIC = {'Sid': 'PublicReadGetObject_v1', 'Effect': 'Allow', 'Principal': {'AWS': '*'},
          'Action': 's3:GetObject', 'NotResource': ['arn:aws:s3:::want-foundation/axentra/*',
                                                  'arn:aws:s3:::want-foundation/wallpapers-backups/*']}
MEDIA = {'Sid': 'PrizmaxisPublicProductionMedia', 'Effect': 'Allow', 'Principal': '*',
         'Action': 's3:GetObject', 'Resource': 'arn:aws:s3:::want-foundation/prizmaxis/production/media/*'}


class BackupPolicy(unittest.TestCase):
    def test_original_public_read_keeps_backups_excluded(self):
        worker.verify_backup_policy({'Version': '2012-10-17', 'Statement': [copy.deepcopy(PUBLIC)]})

    def test_exact_isolated_public_media_rule_does_not_change_input(self):
        policy = {'Version': '2012-10-17', 'Statement': [copy.deepcopy(PUBLIC), copy.deepcopy(MEDIA)]}
        before = copy.deepcopy(policy)
        worker.verify_backup_policy(policy)
        self.assertEqual(policy, before)
        policy['Statement'].reverse()
        worker.verify_backup_policy(policy)

    def test_restrictive_rules_preserve_backup_privacy_and_input(self):
        deny = {'Sid': 'PrivateObjects', 'Effect': 'Deny', 'Principal': '*',
                'Action': 's3:*', 'Resource': 'arn:aws:s3:::want-foundation/prizmaxis/stage/*'}
        for statements in [[PUBLIC, deny], [PUBLIC, MEDIA, deny], [PUBLIC, {**MEDIA, 'Effect': 'Deny'}]]:
            policy = {'Statement': copy.deepcopy(statements)}
            before = copy.deepcopy(policy)
            worker.verify_backup_policy(policy)
            self.assertEqual(policy, before)
        with self.assertRaises(DeployError):
            worker.verify_backup_policy({'Statement': [PUBLIC, MEDIA, deny, {**MEDIA, 'Sid': 'UnknownAllow'}]})

    def test_unreviewed_or_broadened_media_rules_are_rejected(self):
        for field, value in [('Sid', 'Unreviewed'), ('Resource', 'arn:aws:s3:::want-foundation/*'),
                             ('Resource', 'arn:aws:s3:::want-foundation/wallpapers-backups/*'),
                             ('Action', 's3:*'), ('Principal', {'AWS': '*'})]:
            with self.subTest(field=field, value=value):
                media = {**MEDIA, field: value}
                with self.assertRaises(DeployError):
                    worker.verify_backup_policy({'Statement': [PUBLIC, media]})
        for statements in [[PUBLIC, MEDIA, MEDIA], [PUBLIC, PUBLIC], [MEDIA],
                           [PUBLIC, {**MEDIA, 'Condition': {}}]]:
            with self.assertRaises(DeployError):
                worker.verify_backup_policy({'Statement': statements})

    def test_malformed_policy_or_missing_backup_exclusion_is_rejected(self):
        invalid = [None, {}, {'Statement': None}, {'Statement': ['invalid']}, {'Statement': []}]
        for field, value in [('NotResource', []), ('NotResource', PUBLIC['NotResource'][1]),
                             ('Action', 's3:*'), ('Effect', 'Deny'), ('Principal', '*')]:
            invalid.append({'Statement': [{**PUBLIC, field: value}]})
        for policy in invalid:
            with self.subTest(policy=policy), self.assertRaises(DeployError):
                worker.verify_backup_policy(policy)


if __name__ == '__main__':
    unittest.main()

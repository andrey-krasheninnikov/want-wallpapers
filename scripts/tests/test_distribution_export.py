import copy
import importlib.util
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
spec = importlib.util.spec_from_file_location('distribution_export', Path(__file__).resolve().parent.parent / 'distribution-export.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.active = {'running': True, 'health': 'healthy', 'imageId': 'sha256:' + 'a' * 64, 'image': module.IMAGE + '@sha256:' + 'b' * 64}
        self.image = {'os': 'linux', 'architecture': 'amd64', 'id': self.active['imageId'], 'revision': 'c' * 40}
        self.record = {'state': 'succeeded', 'stage': 'complete', 'backupVerified': True, 'actualImageId': self.active['imageId'],
            'indexDigest': 'sha256:' + 'b' * 64, 'sourceSha': 'c' * 40, 'revision': 'c' * 40, 'requestId': 'd' * 32,
            'tag': 'v1.10.0', 'architecture': 'amd64', 'createdAt': 1, 'privateSecret': 'not-for-export'}

    def test_matching_actual_image_exports_only_public_receipt(self):
        receipt = module.evidence(self.active, [self.record], self.image)
        self.assertNotIn('privateSecret', receipt)
        self.assertEqual(receipt['requestId'], 'd' * 32)

    def test_failed_interrupted_or_other_image_never_becomes_publication(self):
        for field, value in [('state', 'failed'), ('stage', 'verifying'), ('backupVerified', False), ('revision', 'e' * 40), ('actualImageId', 'other')]:
            record = dict(self.record, **{field: value})
            with self.assertRaises(module.DeployError):
                module.evidence(self.active, [record], self.image)
        for field, value in [('running', False), ('health', 'starting'), ('image', module.IMAGE + ':latest')]:
            with self.assertRaises(module.DeployError):
                module.evidence(dict(self.active, **{field: value}), [self.record], self.image)

    def test_old_build_baseline_and_manual_missing_metadata_remain_discoverable(self):
        values = module.publications({'schemaVersion': 1, 'collections': []}, {'collections':[{'id':'0001-first'},{'id':'0002-second'}],'wallpapers':[]})
        self.assertEqual(values, [{'collectionId': '0001-first', 'package': None}, {'collectionId': '0002-second', 'package': None}])
        with self.assertRaises(module.DeployError):
            module.publications({'schemaVersion': 1, 'collections': []}, {'collections':[{'id':'0001-first'},{'id':'0001-first'}],'wallpapers':[]})

    def test_private_copy_assets_and_foreign_collections_are_rejected(self):
        package = {'schemaVersion': 1, 'revision': 1, 'packageHash': 'f' * 64,
            'manifest': {'collection': {'id': '0007-test'}, 'wallpapers': []}, 'stories': {}, 'copy': {'telegram': [{'title': 'Test', 'description': 'Text'}]}, 'assets': []}
        metadata = {'schemaVersion': 1, 'collections': [package]}
        catalogue = {'collections':[{'id':'0007-test'}],'wallpapers':[]}
        self.assertEqual(module.publications(metadata, catalogue)[0]['package']['packageHash'], 'f' * 64)
        for mutate in [lambda value: value['copy']['telegram'][0].update(privateNotes='private'),
                       lambda value: value['assets'].append({'role': 'native', 'path': 'private.png'}),
                       lambda value: value['manifest']['collection'].update(privateNotes='private'),
                       lambda value: value['manifest']['collection'].update(title={'en':'Stale title'}),
                       lambda value: value['manifest'].update(wallpapers=[['id','slug','collection','collectionId','s3Folder','fileStem','number','category','tags','title','description']])]:
            changed = copy.deepcopy(package)
            mutate(changed)
            self.assertIsNone(module.publications({'schemaVersion': 1, 'collections': [changed]}, catalogue)[0]['package'])
        self.assertIsNone(module.publications(metadata, {'collections':[{'id':'0008-other'}],'wallpapers':[]})[0]['package'])
        self.assertIsNone(module.publications(dict(metadata, catalogueIds=['0008-other']), catalogue)[0]['package'])
        fresh = copy.deepcopy(package)
        fresh['manifest']['collection']['id'] = '0008-fresh'
        catalogue['collections'] = [{'id':'0007-test','title':{'en':'Edited'}},{'id':'0008-fresh'}]
        values = module.publications({'schemaVersion':1,'collections':[package,fresh]},catalogue)
        self.assertIsNone(values[0]['package'])
        self.assertEqual(values[1]['package'],fresh)
        malformed = copy.deepcopy(package)
        malformed['manifest']['wallpapers'] = [['id','slug','collection','collectionId','s3Folder','fileStem','number','category','tags','title','description']]
        values = module.publications({'schemaVersion':1,'collections':[malformed,fresh]},catalogue)
        self.assertIsNone(values[0]['package'])
        self.assertEqual(values[1]['package'],fresh)


if __name__ == '__main__':
    unittest.main()

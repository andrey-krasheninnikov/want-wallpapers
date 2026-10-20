import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('collection_storage', Path(__file__).resolve().parents[1] / 'scripts/collection-storage.py')
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class Client:
    def __init__(self, body=b'abc', length=3):
        self.body, self.length, self.calls = body, length, []

    def head_object(self, **values):
        self.calls.append(('head', values))
        return {'ContentLength': self.length, 'ETag': 'fixed'}

    def get_object(self, **values):
        self.calls.append(('get', values))
        return {'Body': io.BytesIO(self.body)}

    def put_object(self, **values):
        self.calls.append(('put', {key: value for key, value in values.items() if key != 'Body'}))
        if values['Body'].read() != self.body:
            raise ValueError('wrong-body')
        return {'ResponseMetadata': {'HTTPStatusCode': 200}}


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='wallpapers-storage-')
        self.path = Path(self.directory.name).resolve() / 'object'
        self.path.write_bytes(b'abc')
        self.path.chmod(0o600)
        self.value = {'action': 'create', 'path': str(self.path), 'size': 3, 'sha256': hashlib.sha256(b'abc').hexdigest(),
                      'prefix': 'wallpapers/assets/collections/0999-test-light/',
                      'key': 'wallpapers/assets/collections/0999-test-light/test-light-desktop-1.png', 'contentType': 'image/png'}

    def tearDown(self):
        self.directory.cleanup()

    def test_create_is_conditional_and_uses_only_the_fixed_bucket(self):
        client = Client()
        self.assertEqual(storage.operation(client, self.value), {'status': 200})
        operation, request = client.calls[0]
        self.assertEqual(operation, 'put')
        self.assertEqual(request['Bucket'], 'want-foundation')
        self.assertEqual(request['IfNoneMatch'], '*')
        self.assertEqual(request['Metadata']['sha256'], self.value['sha256'])

    def test_foreign_keys_and_changed_bytes_fail_before_network(self):
        for change in [{'key': 'foreign/file.png'}, {'sha256': '0' * 64}]:
            client = Client()
            with self.assertRaises(ValueError):
                storage.operation(client, {**self.value, **change})
            self.assertEqual(client.calls, [])

    def test_read_binds_etag_and_bounds_the_body(self):
        client = Client()
        self.assertEqual(storage.operation(client, {**self.value, 'action': 'read'}), {'status': 200})
        self.assertEqual(client.calls[1][1]['IfMatch'], 'fixed')
        self.assertEqual(self.path.read_bytes(), b'abc')
        with self.assertRaises(ValueError):
            storage.operation(Client(body=b'abcd'), {**self.value, 'action': 'read'})
        client = Client(length=4)
        self.assertEqual(storage.operation(client, {**self.value, 'action': 'read'}), {'status': 409})
        self.assertEqual(len(client.calls), 1)

    def test_public_or_symlinked_files_are_rejected(self):
        self.path.chmod(0o644)
        with self.assertRaises(ValueError):
            storage.private_file(self.path)
        self.path.chmod(0o600)
        link = self.path.with_name('link')
        link.symlink_to(self.path)
        with self.assertRaises(ValueError):
            storage.private_file(link)


if __name__ == '__main__':
    unittest.main()

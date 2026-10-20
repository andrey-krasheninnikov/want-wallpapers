import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
spec=importlib.util.spec_from_file_location('distribution_run', Path(__file__).resolve().parent.parent/'distribution-run.py')
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

class LauncherTests(unittest.TestCase):
    def test_fixed_commands_and_existing_worker_are_preserved(self):
        with self.assertRaises(runner.DeployError):
            runner.command(['sh','-c','id'])
        self.assertEqual(runner.command(['status']),['status'])
        with tempfile.TemporaryDirectory() as root:
            with patch.object(runner,'profile'),patch.object(runner.exporter,'STATE',Path(root)/'requests'),patch.object(runner,'worker',return_value={'id':'existing'}),patch.object(runner,'cleanup') as cleanup:
                with self.assertRaisesRegex(runner.DeployError,'distribution-already-running'):
                    runner.run(['--once'])
                cleanup.assert_not_called()

    def test_success_limits_mounts_image_and_cleanup(self):
        with tempfile.TemporaryDirectory() as root:
            identifier='a'*64
            results=[types.SimpleNamespace(returncode=0,stdout=(identifier+'\n').encode()),types.SimpleNamespace(returncode=0,stdout=b'0\n'),types.SimpleNamespace(returncode=0,stdout=b'{"processed":0,"memoryPeakBytes":12000000}\n')]
            with patch.object(runner,'profile'),patch.object(runner.exporter,'STATE',Path(root)/'requests'),patch.object(runner,'worker',side_effect=[None,{'id':identifier,'launcherPid':str(os.getpid())}]),patch.object(runner.exporter,'container',return_value={'image':'fixed@sha256:'+'b'*64,'imageId':'sha256:'+'c'*64}),patch.object(runner.exporter,'docker',return_value={}),patch.object(runner.exporter,'evidence'),patch.object(runner.subprocess,'run',side_effect=results) as execute,patch.object(runner,'cleanup') as cleanup:
                runner.run(['--once'])
                arguments=execute.call_args_list[0].args[0]
                for value in ['--memory=128m','--memory-swap=128m','--cpus=0.2','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pull=never','--no-healthcheck']:
                    self.assertIn(value,arguments)
                self.assertFalse(any('docker.sock' in value or 'migration_database_url' in value or 'google_application' in value for value in arguments))
                self.assertEqual(arguments[-3:],['fixed@sha256:'+'b'*64,'distribute','--once'])
                cleanup.assert_called_once_with(identifier)

    def test_lost_launch_response_reconciles_only_owned_name(self):
        with tempfile.TemporaryDirectory() as root:
            with patch.object(runner,'profile'),patch.object(runner.exporter,'STATE',Path(root)/'requests'),patch.object(runner,'worker',side_effect=[None,{'id':'owned','launcherPid':str(os.getpid())}]),patch.object(runner.exporter,'container',return_value={'image':'fixed','imageId':'id'}),patch.object(runner.exporter,'docker',return_value={}),patch.object(runner.exporter,'evidence'),patch.object(runner.subprocess,'run',side_effect=TimeoutError),patch.object(runner,'cleanup') as cleanup:
                with self.assertRaises(TimeoutError):runner.run(['--once'])
                cleanup.assert_called_once_with('owned')

if __name__=='__main__':unittest.main()

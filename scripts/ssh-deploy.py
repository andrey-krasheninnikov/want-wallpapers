#!/usr/bin/env python3
"""Forced SSH entry point. Each account can invoke only its own protocol."""
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deployment import DeployError, request_command

try:
    if len(sys.argv) != 2:
        raise DeployError('invalid-actor')
    actor = sys.argv[1]
    command = request_command(os.environ.get('SSH_ORIGINAL_COMMAND', ''), actor)
    result = subprocess.run(['sudo', '-n', '--', '/usr/local/sbin/wallpapers-deploy', actor, *command])
    sys.exit(result.returncode)
except (DeployError, OSError):
    print(json.dumps({'errorCode': 'restricted-command-rejected'}))
    sys.exit(1)

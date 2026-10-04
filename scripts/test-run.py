#!/usr/bin/env python3
import os
from pathlib import Path
import subprocess
import sys
root = Path(os.environ.get('TEST_SECRETS_DIR', f'/tmp/want-wallpapers-test-{os.getuid()}'))
environment = os.environ.copy()
if not (root / 'database_url').exists(): raise SystemExit('Run make test-db first.')
environment['DATABASE_URL'] = (root / 'database_url').read_text().strip()
environment['DATABASE_URL_FILE'] = str(root / 'database_url')
environment['APP_ENV'] = 'development'
subprocess.run(sys.argv[1:], env=environment, check=True)

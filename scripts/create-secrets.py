#!/usr/bin/env python3
"""Prepare new secret files outside the repository; never overwrite existing files."""
import base64
import getpass
import os
from pathlib import Path
import secrets
import subprocess
import sys

repository = Path(__file__).resolve().parent.parent
directory = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) == 2 else None
if directory is None or directory == repository or repository in directory.parents:
    raise SystemExit('Usage: python3 scripts/create-secrets.py /absolute/path/outside-repository')
files = ['database_url', 'migration_database_url', 'admin_password_hash', 'admin_totp_secret', 'catalog_api_token']
if any((directory / name).exists() for name in files): raise SystemExit('Existing secrets found. No files changed.')
password = getpass.getpass('Administrator password (at least 16 characters): ')
if len(password) < 16 or password != getpass.getpass('Repeat password: '): raise SystemExit('Password is too short or differs.')
database_url = getpass.getpass('Application database URL: ')
migration_url = getpass.getpass('Migration database URL: ')
if not database_url or not migration_url: raise SystemExit('Both database URLs are required.')
password_hash = subprocess.run(['bun', str(repository / 'scripts/password-hash.ts')], input=password, text=True, capture_output=True, check=True).stdout.strip()
values = [database_url, migration_url, password_hash, base64.b32encode(secrets.token_bytes(20)).decode(), secrets.token_hex(32)]
directory.mkdir(mode=0o700, parents=True, exist_ok=True)
if directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o077: raise SystemExit('Secret directory must be owned by the current user with mode 0700.')
for name, value in zip(files, values):
    descriptor = os.open(directory / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as file: file.write(value + '\n')
print('Secret files created. Configure the authenticator from admin_totp_secret privately; keep the password in a password manager.')

#!/usr/bin/env python3
"""Fail on new findings or changed conditions for the bounded dependency review."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess

repository = Path(__file__).resolve().parent.parent
review_until = datetime.date(2026, 11, 4)
if datetime.datetime.now(datetime.timezone.utc).date() > review_until:
    raise SystemExit('Dependency review expired. Review docs/security.md before continuing.')
def execute(command):
    result = subprocess.run(command, cwd=repository, capture_output=True, text=True)
    return result

def require(condition, message):
    if not condition: raise SystemExit(message)

package = json.loads((repository / 'package.json').read_text())
require(package['overrides']['sharp'] == '0.35.5', 'The AVIF mitigation requires the reviewed Sharp version.')
require(package['overrides']['esbuild'] == '0.25.12', 'Review a changed esbuild override.')
require(package.get('trustedDependencies') == [], 'Dependency scripts require separate review.')
require("output: 'static'" in (repository / 'frontend/astro.config.mjs').read_text(), 'Astro server mode requires new dependency review.')
for path in (repository / 'frontend/src').rglob('*.astro'):
    source = path.read_text()
    require(not re.search(r'define:vars|transition:|server:defer|slot=\{|\{\.\.\.', source), f'{path.name}: newly used Astro feature needs security review.')

result = execute(['bun', 'audit', '--json'])
require(result.returncode in (0, 1), 'Bun audit could not complete.')
try: findings = json.loads(result.stdout)
except json.JSONDecodeError: raise SystemExit('Bun audit did not return valid JSON.')
reviewed = {
    'astro': {'GHSA-xr5h-phrj-8vxv', 'GHSA-j687-52p2-xcff', 'GHSA-jrpj-wcv7-9fh9', 'GHSA-f48w-9m4c-m7f5', 'GHSA-7pw4-f3q4-r2p2', 'GHSA-4g3v-8h47-v7g6', 'GHSA-2pvr-wf23-7pc7', 'GHSA-8hv8-536x-4wqp', 'GHSA-26w7-cxv4-gfx2', 'GHSA-376h-93r7-7g6f'},
    'esbuild': {'GHSA-g7r4-m6w7-qqqr', 'GHSA-gv7w-rqvm-qjhr'},
}
count = 0
for package_name, items in findings.items():
    for item in items:
        advisory = item['url'].rsplit('/', 1)[-1]
        require(advisory in reviewed.get(package_name, set()), f'Unreviewed dependency advisory: {package_name} {advisory}')
        count += 1
print(f'Bun audit: {count} bounded findings covered by docs/security.md; review expires {review_until}.')

# The optional SQLx MySQL dependency is present in the lockfile, but must not compile.
result = execute(['cargo', 'tree', '--locked', '--offline', '--workspace', '--target', 'x86_64-unknown-linux-gnu', '--prefix', 'none'])
require(result.returncode == 0, 'Cannot establish the production Rust dependency graph.')
require(not re.search(r'^rsa v', result.stdout, re.M), 'RSA is compiled: RUSTSEC-2023-0071 must be resolved.')
audit = os.environ.get('CARGO_AUDIT', 'cargo-audit')
try: result = execute([audit, 'audit', '--json'])
except FileNotFoundError: raise SystemExit('Install cargo-audit 0.22.2 (see docs/security.md).')
require(result.returncode in (0, 1), 'Cargo audit could not complete.')
try: report = json.loads(result.stdout)
except json.JSONDecodeError: raise SystemExit('Cargo audit did not return valid JSON.')
for item in report['vulnerabilities']['list']:
    require(item['advisory']['id'] == 'RUSTSEC-2023-0071', f"Unreviewed Rust advisory: {item['advisory']['id']}")
require(not any(report.get('warnings', {}).values()), 'Cargo audit has warnings that require review.')
print('Cargo audit: optional lockfile RSA finding is absent from the Linux build graph; no other findings.')

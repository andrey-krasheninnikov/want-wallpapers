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
def unreviewed_astro_features(source, path):
    if path == repository / 'frontend/src/layouts/Base.astro':
        for name in ('header', 'cookies', 'feedback-root'):
            source = source.replace(f'transition:persist="{name}"', '')
    return bool(re.search(r'define:vars|transition:|server:defer|slot=\{|\{\.\.\.', source))

base = repository / 'frontend/src/layouts/Base.astro'
assert not unreviewed_astro_features('transition:persist="header"', base)
for source in ('transition:persist={input}', 'transition:persist="unknown"', 'transition:animate={input}', 'define:vars={input}'):
    assert unreviewed_astro_features(source, base)
assert unreviewed_astro_features('transition:persist="header"', base.with_name('Other.astro'))
for path in (repository / 'frontend/src').rglob('*.astro'):
    require(not unreviewed_astro_features(path.read_text(), path), f'{path.name}: newly used Astro feature needs security review.')

def unreviewed_jsx_rendering(source, path):
    return (path.suffix.lower() == '.mdx'
            or bool(re.search(r'astro(?:/jsx(?:-dev)?-runtime|/runtime/server|:jsx)|@astrojs/mdx|@jsx(?:ImportSource|Runtime)?\b', source))
            or path.suffix.lower() in ('.tsx', '.jsx') and bool(re.search(r'<\s*(?:script|style)\b', source, re.I)))

compiler = json.loads((repository / 'frontend/tsconfig.json').read_text())['compilerOptions']
require(compiler.get('jsx') == 'react-jsx' and compiler.get('jsxImportSource') == 'react', 'Astro JSX rendering requires new security review.')
assert not unreviewed_jsx_rendering("import { jsx } from 'react/jsx-runtime'; <div>{value}</div>", Path('Card.tsx'))
for source, name in (("import { jsx } from 'astro/jsx-runtime'", 'Card.tsx'),
                     ("import { jsxDEV } from 'astro/jsx-dev-runtime'", 'Card.tsx'),
                     ("import { renderJSX } from 'astro/runtime/server/index.js'", 'Card.ts'),
                     ("import Component from 'astro:jsx'", 'Page.astro'),
                     ("import mdx from '@astrojs/mdx'", 'astro.config.mjs'),
                     ('/** @jsxImportSource astro */', 'Card.tsx'),
                     ('<script>{value}</script>', 'Card.tsx'),
                     ('<style>{value}</style>', 'Card.jsx'), ('', 'Page.mdx')):
    assert unreviewed_jsx_rendering(source, Path(name))
paths = [repository / 'frontend/astro.config.mjs', repository / 'frontend/package.json', *(repository / 'frontend/src').rglob('*')]
for path in paths:
    if path.is_file() and path.suffix.lower() in ('.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'):
        require(not unreviewed_jsx_rendering(path.read_text(), path), f'{path.name}: JSX/MDX usage requires new security review.')

def unreviewed_zod_usage(source):
    return bool(re.search(r"['\"`][^'\"`\n]*(?:\bzod\b|astro:(?:actions|content|schema|db))[^'\"`\n]*['\"`]", source))

def reviewed_zod_versions(locked):
    return ({name: version for name, version in locked.items() if version.startswith('zod@')} == {
        'zod': 'zod@4.6.7', 'astro/zod': 'zod@3.25.76', 'zod-to-ts/zod': 'zod@3.25.76',
    } and locked.get('astro') == 'astro@5.18.2' and locked.get('zod-to-ts') == 'zod-to-ts@1.2.0')

def reviewed_zod_consumers(lock):
    return dict(re.findall(r'^\s*"([^"]+)": \["([^"]+)", "[^"]*", \{[^\n]*"zod":', lock, re.M)) == {
        '@astrojs/sitemap': '@astrojs/sitemap@3.7.4', 'astro': 'astro@5.18.2',
        'zod-to-json-schema': 'zod-to-json-schema@3.25.2', 'zod-to-ts': 'zod-to-ts@1.2.0',
    }

assert not unreviewed_zod_usage("import { defineConfig } from 'astro/config';")
for name in ('zod', 'zod/v3', 'zod/v4', 'astro/zod', 'astro:actions', 'astro:content', 'astro:schema', 'astro:db'):
    assert unreviewed_zod_usage(f"import schema from '{name}';")
assert unreviewed_zod_usage('import("zod/v3")')
assert unreviewed_zod_usage('import(`zod/v3`)')
fixed_zod = {'zod': 'zod@4.6.7', 'astro/zod': 'zod@3.25.76', 'zod-to-ts/zod': 'zod@3.25.76',
             'astro': 'astro@5.18.2', 'zod-to-ts': 'zod-to-ts@1.2.0'}
assert reviewed_zod_versions(fixed_zod)
for changed in ({**fixed_zod, 'zod': 'zod@4.6.5'}, {**fixed_zod, 'astro/zod': 'zod@3.25.75'},
                {**fixed_zod, '@astrojs/sitemap/zod': 'zod@4.6.5'}, {**fixed_zod, 'astro': 'astro@6.0.0'},
                {key: value for key, value in fixed_zod.items() if key != 'zod-to-ts/zod'}):
    assert not reviewed_zod_versions(changed)
lock = (repository / 'bun.lock').read_text()
assert not reviewed_zod_consumers(lock + '\n"new-consumer": ["new-consumer@1.0.0", "", {"dependencies": {"zod": "^4"}}],')
require(reviewed_zod_consumers(lock), 'Zod consumers changed; review their input boundary.')
locked = dict(re.findall(r'^\s*"([^"]+)": \["([^"]+)"', lock, re.M))
require(reviewed_zod_versions(locked), 'Zod versions or consumers require a new security review.')
for path in [repository / 'package.json', *paths, *(repository / 'frontend/scripts').rglob('*'), *(repository / 'scripts').rglob('*')]:
    if path.is_file() and path.suffix.lower() in ('.astro', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'):
        require(not unreviewed_zod_usage(path.read_text()), f'{path.name}: new Zod/Actions/Content usage requires security review.')

result = execute(['bun', 'audit', '--json'])
require(result.returncode in (0, 1), 'Bun audit could not complete.')
try: findings = json.loads(result.stdout)
except json.JSONDecodeError: raise SystemExit('Bun audit did not return valid JSON.')
reviewed = {
    'astro': {'GHSA-xr5h-phrj-8vxv', 'GHSA-j687-52p2-xcff', 'GHSA-jrpj-wcv7-9fh9', 'GHSA-f48w-9m4c-m7f5', 'GHSA-7pw4-f3q4-r2p2', 'GHSA-4g3v-8h47-v7g6', 'GHSA-2pvr-wf23-7pc7', 'GHSA-8hv8-536x-4wqp', 'GHSA-26w7-cxv4-gfx2', 'GHSA-376h-93r7-7g6f', 'GHSA-98hj-9722-w3j8'},
    'esbuild': {'GHSA-g7r4-m6w7-qqqr', 'GHSA-gv7w-rqvm-qjhr'},
    'zod': {'GHSA-mrhx-c7xc-m3w5'},
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
def patched_root_shim(package, tree):
    return (package['name'] == 'webpki-roots' and package['version'] == '0.26.11'
            and tree == ['webpki-roots v0.26.11', 'webpki-roots v1.0.10'])

shim = {'name': 'webpki-roots', 'version': '0.26.11'}
fixed_tree = ['webpki-roots v0.26.11', 'webpki-roots v1.0.10']
assert patched_root_shim(shim, fixed_tree)
assert not patched_root_shim(shim, ['webpki-roots v0.26.11', 'webpki-roots v1.0.9'])
assert not patched_root_shim(shim, fixed_tree + ['unexpected v1.0.0'])
assert not patched_root_shim(shim, [fixed_tree[0], fixed_tree[1] + ' (/local)'])
assert not patched_root_shim({**shim, 'version': '0.26.10'}, fixed_tree)
assert not patched_root_shim({**shim, 'name': 'other'}, fixed_tree)
roots = execute(['cargo', 'tree', '--locked', '--offline', '-p', 'webpki-roots@0.26.11',
                 '--depth', '1', '--prefix', 'none'])
for item in report['vulnerabilities']['list']:
    advisory = item['advisory']['id']
    # The reviewed compatibility crate only re-exports the patched v1 root set.
    compatible_roots = (advisory == 'RUSTSEC-2026-0381' and roots.returncode == 0
                        and patched_root_shim(item['package'], roots.stdout.splitlines()))
    require(advisory == 'RUSTSEC-2023-0071' or compatible_roots,
            f'Unreviewed Rust advisory: {advisory}')
require(not any(report.get('warnings', {}).values()), 'Cargo audit has warnings that require review.')
print('Cargo audit: optional RSA is absent from the Linux build graph; the reviewed root shim uses patched certificates; no other findings.')

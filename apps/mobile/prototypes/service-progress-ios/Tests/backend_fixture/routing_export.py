#!/usr/bin/env python3
"""Build unchanged existing Expo reader into fresh manifest-owned output only."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

from routing_gateway import private_path
from routing_plan import RoutingArgumentParser, binding, digest, plan, require

HERE = Path(__file__).resolve().parent
MOBILE = HERE.parents[3]


def export_reader(root, toolchain_path):
    root = Path(root)
    private_path(root, directory=True)
    manifest_path = root / 'routing-manifest.json'
    private_path(manifest_path)
    manifest = json.loads(manifest_path.read_text())
    cfg = manifest['binding']
    expected = binding(cfg['origin'], cfg['backend'], cfg['gateway'], cfg['namespace'], cfg['database'], cfg['session_id'], cfg['part_ids'], cfg['client_sha'])
    require(cfg == expected and manifest['binding_sha256'] == digest(cfg), 'manifest_binding')
    require(isinstance(toolchain_path, str) and toolchain_path and all(p.startswith('/') and '..' not in Path(p).parts for p in toolchain_path.split(':')), 'explicit_toolchain_path')
    require(not (root / 'reader-export').exists() and not (root / 'reader-export-receipt.json').exists(), 'fresh_export')
    # Only explicitly selected toolchain paths, not caller HOME/.env/provider config.
    env = plan(cfg, str(root), '11111111-1111-4111-8111-111111111111')['build']['environment']
    env['PATH'] = toolchain_path
    env['HOME'] = str(root / 'home')
    home = root / 'home'
    home.mkdir(mode=0o700, exist_ok=True)
    private_path(home, directory=True)
    node = shutil.which('node', path=toolchain_path)
    git = '/usr/bin/git'
    require(node is not None, 'node_toolchain')
    sha = subprocess.check_output([git, 'rev-parse', 'HEAD'], cwd=MOBILE, env=env, timeout=5).decode().strip()
    require(sha == cfg['client_sha'], 'client_source_sha')
    # No source rewrite/export from a modified tracked application graph. Newly
    # added routing/provider packets do not change these existing UI/build inputs.
    subprocess.run([git, 'diff', '--quiet', 'HEAD', '--', 'app', 'components', 'features', 'design', 'app.json', 'app.config.js', 'package.json', 'package-lock.json', '../../packages'], cwd=MOBILE, env=env, check=True, timeout=5)
    command = [node, 'node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', str(root / 'reader-export')]
    log_path = root / 'export-build.log'
    with log_path.open('x', encoding='utf-8') as log:
        os.chmod(log_path, 0o600)
        subprocess.run(command, cwd=MOBILE, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=300)
    files = {}
    for path in sorted((root / 'reader-export').rglob('*')):
        require(not path.is_symlink(), 'export_symlink')
        if path.is_file():
            files[path.relative_to(root / 'reader-export').as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    # The existing readerConfig must have both selected endpoints inlined into
    # its production function, not merely somewhere in an unrelated asset.
    compiled_reader = False
    for path in (root / 'reader-export').rglob('*.js'):
        text = path.read_text()
        for function in re.findall(r'readerConfig=function\([^)]*\)\{[^}]{1,1024}\}', text):
            if json.dumps(cfg['origin']) in function and json.dumps(cfg['origin'].replace('https:', 'wss:') + '/cable') in function:
                compiled_reader = True
    require(compiled_reader, 'compiled_reader_binding')
    receipt = {'binding_sha256': digest(cfg), 'client_sha': cfg['client_sha'], 'export_tree_sha256': digest(files),
               'exact_build_environment': env, 'argv': command, 'file_count': len(files), 'trust_verified': False}
    path = root / 'reader-export-receipt.json'
    with path.open('x', encoding='utf-8') as output:
        os.chmod(path, 0o600)
        json.dump(receipt, output, indent=2, sort_keys=True)
    print(json.dumps({'status': 'exported', 'binding_sha256': digest(cfg), 'export_tree_sha256': receipt['export_tree_sha256'], 'file_count': len(files), 'tls_verified': False}))


def main(argv=None):
    parser = RoutingArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--execute-export', action='store_true')
    parser.add_argument('--root')
    parser.add_argument('--toolchain-path')
    args = parser.parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        require(args.execute_export, 'export_opt_in')
        export_reader(args.root, args.toolchain_path)
        return 0
    except (ValueError, TypeError, KeyError, OSError, subprocess.SubprocessError):
        print(json.dumps({'status': 'rejected', 'reason': 'routing_export'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

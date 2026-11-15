#!/usr/bin/env python3
"""Default-off, network-free route/build preparation. Never starts cloudflared."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

BACKEND_SHA = '46481161509155d04e3fcf60ce7928ea19f9614b'
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'


class RoutingArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        print(json.dumps({'status': 'rejected', 'reason': 'routing_arguments'}))
        self.exit(2)


def require(condition, code):
    if not condition:
        raise ValueError(code)


def https_origin(value):
    require(isinstance(value, str) and re.fullmatch(r'https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', value), 'https_origin')
    host = urlsplit(value).hostname
    require('.' in host and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', p) for p in host.split('.')), 'https_hostname')
    require(not re.fullmatch(r'[0-9.]+', host), 'https_hostname')
    return value


def loopback(value):
    match = re.fullmatch(r'http://127\.0\.0\.1:([1-9][0-9]{0,4})', value or '')
    require(match and int(match[1]) <= 65535, 'loopback_origin')
    return value


def binding(origin, backend, gateway, namespace, database, session_id, part_ids, source_sha):
    https_origin(origin)
    loopback(backend)
    loopback(gateway)
    require(backend != gateway, 'distinct_ports')
    require(isinstance(namespace, str) and re.fullmatch(r'sp277-[a-z0-9-]{1,48}', namespace), 'namespace')
    require(isinstance(database, str) and re.fullmatch(r'sp277_[a-z0-9_]{1,40}', database), 'database')
    # The unchanged server.rb creates exactly 42. Never silently route a new ID.
    require(type(session_id) is int and session_id == 42, 'existing_fixture_session')
    require(isinstance(part_ids, list) and part_ids and all(type(p) is int and 0 < p <= 9007199254740991 for p in part_ids) and len(set(part_ids)) == len(part_ids), 'explicit_part_ids')
    require(isinstance(source_sha, str) and re.fullmatch(r'[0-9a-f]{40}', source_sha), 'source_sha')
    return {'origin': origin, 'backend': backend, 'gateway': gateway, 'namespace': namespace,
            'database': database, 'session_id': session_id, 'part_ids': sorted(part_ids),
            'client_sha': source_sha, 'backend_sha': BACKEND_SHA}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def plan(config, owned_root, tunnel_id):
    # The future operator must create/review this NEW private canonical root. No reads,
    # discovery, mkdir, cloudflared invocation or credential access occur here.
    root = Path(owned_root)
    require(root.is_absolute() and str(root) == owned_root and '..' not in root.parts and root != Path('/'), 'explicit_owned_root')
    require(re.fullmatch(UUID, tunnel_id or ''), 'explicit_tunnel_id')
    host = urlsplit(config['origin']).hostname
    export = root / 'reader-export'
    return {'status': 'dry_run_only', 'trust_verified': False, 'network_performed': False,
            'binding': config, 'binding_sha256': digest(config),
            'reader_url': f"{config['origin']}/sessions/{config['session_id']}/parts",
            'native_generation_environment': {
                'SERVICE_PROGRESS_DEVELOPMENT_ORIGIN': config['origin'],
                'SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN': config['origin']},
            'build': {'cwd': 'apps/mobile', 'inherit_environment': False,
                      'environment': {'PATH': '<explicit-reviewed-node-toolchain-path>', 'HOME': str(root / 'home'),
                                      'CI': '1', 'NODE_ENV': 'production', 'EXPO_NO_DOTENV': '1', 'EXPO_NO_TELEMETRY': '1',
                                      'EXPO_OFFLINE': '1', 'SENTRY_DISABLE_AUTO_UPLOAD': '1',
                                      'EXPO_PUBLIC_API_URL': config['origin'],
                                      'EXPO_PUBLIC_ACTIONCABLE_URL': config['origin'].replace('https:', 'wss:') + '/cable',
                                      'EXPO_PUBLIC_LIBRARY_ENABLED': '0', 'EXPO_PUBLIC_SENTRY_DSN': '',
                                      'TARKMAN_SERVICE_PROGRESS_PRODUCT': '0'},
                      'argv': ['node', 'node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', str(export)],
                      'receipt_required': ['binding_sha256', 'client_sha', 'export_tree_sha256', 'exact_build_environment', 'argv']},
            'cloudflared_config_path': str(root / 'cloudflared.yml'),
            'cloudflared_config_dry_run': '\n'.join([
                'tunnel: ' + json.dumps(tunnel_id),
                'credentials-file: ' + json.dumps(str(root / 'tunnel-credentials.json')),
                'ingress:', '  - hostname: ' + json.dumps(host),
                '    service: ' + json.dumps(config['gateway']),
                '  - service: http_status:404', '']),
            'future_command_NOT_EXECUTED': ['/opt/homebrew/bin/cloudflared', '--config', str(root / 'cloudflared.yml'), 'tunnel', 'run', tunnel_id],
            'future_command_inherit_environment': False,
            'future_command_environment': {'HOME': str(root / 'home'), 'TMPDIR': str(root / 'tmp'), 'PATH': '/usr/bin:/bin'},
            'policy': {'same_origin_reader_api': True, 'cookies_authorization': 'reject',
                       'redirects': 'reject', 'cable': 'deny; existing reader polls',
                       'public': ['GET /services.json?tz=America%2FLos_Angeles',
                                  f"GET /s/{config['session_id']}[ /state | /parts ].json (no query)",
                                  'GET only explicit bound part IDs'],
                       'mutations': ['PUT /public/service_activity_registrations/<uuid>',
                                     'DELETE /public/service_activity_registrations/<uuid>',
                                     'POST /public/service_activity_registrations/<uuid>/revoke'],
                       'mutation_fence': 'exact session_id for PUT/POST, no query, <=4096 bytes, backend capability/fence authoritative'}}


def main(argv=None):
    parser = RoutingArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    for key in ('origin', 'backend', 'gateway', 'namespace', 'database', 'client-sha', 'owned-root', 'tunnel-id'):
        parser.add_argument('--' + key)
    parser.add_argument('--session-id', type=int)
    parser.add_argument('--part-id', type=int, action='append')
    args = parser.parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        require(args.dry_run, 'dry_run_required')
        config = binding(args.origin, args.backend, args.gateway, args.namespace, args.database,
                         args.session_id, args.part_id, args.client_sha)
        print(json.dumps(plan(config, args.owned_root, args.tunnel_id), sort_keys=True, indent=2))
        return 0
    except (ValueError, TypeError):
        # No echo of arbitrary input, exception strings, environments or secrets.
        print(json.dumps({'status': 'rejected', 'reason': 'routing_configuration'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

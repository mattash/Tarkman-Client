#!/usr/bin/env python3
"""Account-free Quick Tunnel preparation ONLY. Never runs cloudflared/network.

Primary source: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
Installed tunnel --help verifies the flags below, not live startup behavior/trust.
"""
from pathlib import Path
import re

from routing_plan import RoutingArgumentParser, binding, loopback, plan, require
import json


DOCS = 'https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/'


def assigned_origin(value):
    require(isinstance(value, str) and re.fullmatch(r'https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com', value), 'assigned_quick_origin')
    return value


def quick_plan(root, backend, gateway, namespace, database, session_id, part_ids, client_sha,
               assigned=None, expected=None):
    root = Path(root)
    require(root.is_absolute() and '..' not in root.parts and str(root) != '/', 'fresh_owned_root')
    loopback(backend)
    loopback(gateway)
    # Validate non-origin bindings even during bootstrap, using reserved identity
    # only internally. Never use this placeholder for a real assigned endpoint.
    binding('https://unassigned.example.invalid', backend, gateway, namespace, database, session_id, part_ids, client_sha)
    if expected is not None:
        require(assigned is not None and assigned_origin(expected) == assigned_origin(assigned), 'origin_changed_stop')
    result = {'status': 'dry_run_only', 'mode': 'account_free_quick_tunnel', 'primary_source': DOCS,
              'network_performed': False, 'trust_verified': False,
              'fresh_owned_root_required': str(root),
              'empty_config_path': str(root / 'quick-empty.yml'), 'empty_config_exact_text': '{}\n',
              'future_command_inherit_environment': False,
              'future_command_environment': {'HOME': str(root / 'home'), 'XDG_CONFIG_HOME': str(root / 'home/.config'),
                                             'TMPDIR': str(root / 'tmp'), 'PATH': '/usr/bin:/bin'},
              'future_command_NOT_EXECUTED': ['/opt/homebrew/bin/cloudflared', 'tunnel', '--config', str(root / 'quick-empty.yml'),
                                               '--no-autoupdate', '--metrics', '127.0.0.1:0', '--management-diagnostics=false',
                                               '--loglevel', 'info', '--transport-loglevel', 'warn', '--label', namespace,
                                               '--url', gateway],
              'bootstrap_gate': 'gateway NOT listening; no reader/API/static/registration exposed until exact assigned-origin export+manifest receipt verified',
              'account_or_dns_or_credentials_required': False,
              'no_authentication_layer': 'do not use allowed-mail, Access JWT, login cookies or account credentials',
              'stop_conditions': ['assigned origin changes or tunnel restarts', 'ownership/isolation/trust/receipt failure', 'TTL/request bound'],
              'cleanup': 'exact fenced revocation before journal erase; stop/collect owned cloudflared first, then gateway; retain unresolved artifacts'}
    if assigned is None:
        result['phase'] = 'unassigned_bootstrap_recipe_only'
        result['reader_or_native_use_allowed'] = False
        result['next_step'] = 'future operator receives actual printed origin; rerun this dry-run with --assigned-origin; verify system HTTPS trust before any reader/native/API use'
    else:
        origin = assigned_origin(assigned)
        cfg = binding(origin, backend, gateway, namespace, database, session_id, part_ids, client_sha)
        packet = plan(cfg, str(root), '11111111-1111-4111-8111-111111111111')
        for key in list(packet):
            if key.startswith('cloudflared_') or key.startswith('future_command'):
                del packet[key]
        result['phase'] = 'assigned_origin_packet_preparation_only'
        result['reader_or_native_use_allowed'] = False
        result['routing_manifest_packet'] = packet
        result['binding_gate'] = 'save packet to new routing-manifest.json; export unchanged reader; verify receipt and actual system trust; only then start manifest-bound loopback gateway and separately released native generation'
    return result


def main(argv=None):
    parser = RoutingArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    for key in ('root', 'backend', 'gateway', 'namespace', 'database', 'client-sha', 'assigned-origin', 'expected-origin'):
        parser.add_argument('--' + key)
    parser.add_argument('--session-id', type=int)
    parser.add_argument('--part-id', type=int, action='append')
    args = parser.parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        require(args.dry_run, 'dry_run_required')
        print(json.dumps(quick_plan(args.root, args.backend, args.gateway, args.namespace, args.database,
                                    args.session_id, args.part_id, args.client_sha, args.assigned_origin,
                                    args.expected_origin), sort_keys=True, indent=2))
        return 0
    except (ValueError, TypeError):
        print(json.dumps({'status': 'rejected', 'reason': 'quick_routing_configuration_or_origin_change'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

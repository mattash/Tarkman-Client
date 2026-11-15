#!/usr/bin/env python3
"""Opt-in loopback gateway -> genuine fixture PUT/DELETE/fenced-POST probe.

No synthetic HTTP substitution. No account cookies/auth. Capability/token remain
memory-only; stage before PUT and require matching fence on cleanup. Not TLS proof.
"""
import http.client
import json
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit
import uuid

from routing_gateway import load_packet, verify_fixture
from routing_plan import RoutingArgumentParser, digest, require


def probe(root, fixture_root, output):
    cfg, _ = load_packet(root)
    verify_fixture(fixture_root, cfg)
    output = Path(output)
    require(output.parent == Path(root) and not output.exists(), 'new_owned_evidence')
    endpoint = urlsplit(cfg['gateway'])
    capability = secrets.token_hex(32)
    registration = str(uuid.uuid4())
    identity = {'session_id': cfg['session_id'], 'activity_id': 'synthetic-gateway-probe', 'generation': str(uuid.uuid4())}
    payload = {**identity, 'push_token': secrets.token_hex(32), 'token_version': 1,
               'consent_version': 'public-lock-screen-v1', 'lease_seconds': 3600}
    path = '/public/service_activity_registrations/' + registration
    records = []
    staged = False
    fenced = False

    def request(alias, method, target, expected, body=None, cap=None):
        connection = http.client.HTTPConnection(endpoint.hostname, endpoint.port, timeout=5)
        try:
            headers = {'Host': urlsplit(cfg['origin']).netloc, 'Accept': 'application/json'}
            if cap is not None:
                headers['X-Service-Activity-Secret'] = cap
            data = json.dumps(body).encode() if body is not None else None
            if data:
                headers['Content-Type'] = 'application/json'
            # Explicit raw framing keeps DELETE bodyless on both sides of gateway.
            connection.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
            for key, value in headers.items():
                connection.putheader(key, value)
            if data is not None:
                connection.putheader('Content-Length', str(len(data)))
            connection.endheaders(data)
            response = connection.getresponse()
            raw = response.read(4097)
            records.append({'alias': alias, 'method': method, 'status': response.status,
                            'expected': expected, 'no_cookie': response.getheader('set-cookie') is None,
                            'no_store': 'no-store' in [token.strip().lower() for token in (response.getheader('cache-control') or '').split(',')],
                            'bodyless_no_framing': method == 'DELETE',
                            'single_date': sum(k.lower() == 'date' for k, _ in response.getheaders()) == 1,
                            'no_age': response.getheader('Age') is None})
            require(records[-1]['single_date'] and records[-1]['no_age'], 'date_provenance')
            require(response.status == expected and len(raw) <= 4096 and
                    response.getheader('set-cookie') is None and 'no-store' in [token.strip().lower() for token in (response.getheader('cache-control') or '').split(',')], 'http_contract')
            return json.loads(raw) if raw else None
        finally:
            connection.close()

    try:
        state = request('public-state', 'GET', f"/s/{cfg['session_id']}/state.json", 200)
        require(state['session']['id'] == cfg['session_id'], 'public_session')
        staged = True
        first = request('put', 'PUT', path, 200, payload, capability)
        require(first['id'] == registration and first['token_version'] == 1, 'put_receipt')
        request('wrong-capability-delete', 'DELETE', path, 403, cap=secrets.token_hex(32))
        request('bodyless-delete', 'DELETE', path, 204, cap=capability)
        receipt = request('exact-fenced-post', 'POST', path + '/revoke', 200, identity, capability)
        require(receipt == {'id': registration, **identity, 'revoked': True}, 'exact_fence')
        fenced = True
        records[-1]['exact_receipt'] = True
        request('late-put', 'PUT', path, 409, payload, capability)
        request('wrong-session-read', 'GET', '/s/43/state.json', 403)
        request('login-denied', 'GET', '/login', 403)
    finally:
        if staged and not fenced:
            try:
                receipt = request('cleanup-fence', 'POST', path + '/revoke', 200, identity, capability)
                fenced = receipt == {'id': registration, **identity, 'revoked': True}
            except (ValueError, OSError, http.client.HTTPException):
                pass
        with output.open('x') as destination:
            os.chmod(output, 0o600)
            json.dump({'binding_sha256': digest(cfg), 'cases': records,
                       'possibly_attempted': staged, 'exact_fenced': fenced,
                       'unresolved': staged and not fenced, 'tls_verified': False}, destination, indent=2)
    require(fenced, 'unresolved_registration')
    print(json.dumps({'status': 'passed', 'cases': len(records), 'exact_fenced': True, 'tls_verified': False}))


def main(argv=None):
    parser = RoutingArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--root')
    parser.add_argument('--fixture-root')
    parser.add_argument('--output')
    args = parser.parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        probe(args.root, args.fixture_root, args.output)
        return 0
    except (ValueError, TypeError, KeyError, OSError, http.client.HTTPException):
        print(json.dumps({'status': 'rejected', 'reason': 'routing_probe_or_unresolved'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

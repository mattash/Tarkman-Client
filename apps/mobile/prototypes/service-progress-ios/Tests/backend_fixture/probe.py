#!/usr/bin/env python3
"""Opt-in real socket checks; synthetic capabilities/tokens stay in memory."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import secrets
import urllib.error
import urllib.request
import uuid


def require(condition):
    if not condition:
        raise ValueError('HTTP contract or receipt mismatch')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--origin', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(argv)
    if not args.enabled:
        print('{"status":"disabled"}')
        return
    if not re.fullmatch(r'http://127\.0\.0\.1:[1-9][0-9]{3,4}', args.origin):
        raise ValueError('explicit isolated loopback HTTP origin required')
    port = int(args.origin.rsplit(':', 1)[1])
    if not 1024 <= port <= 65535:
        raise ValueError('unprivileged loopback port required')
    output = Path(args.output)
    if output.exists():
        raise ValueError('new evidence output required')
    class RejectRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args, **_kwargs):
            return None
    http = urllib.request.build_opener(urllib.request.ProxyHandler({}), RejectRedirect())
    results = []
    staged = []
    def request(alias, method, path, status, body=None, secret=None):
        headers = {'Content-Type': 'application/json'} if body is not None else {}
        if secret:
            headers['X-Service-Activity-Secret'] = secret
        wire = urllib.request.Request(args.origin + path, method=method, headers=headers,
                                      data=json.dumps(body).encode() if body is not None else None)
        try:
            response = http.open(wire, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(4097)
            record = {'alias': alias, 'method': method, 'status': response.status,
                      'expected': status, 'bytes': len(raw), 'date': response.headers.get('Date'),
                      'cache_control': response.headers.get('Cache-Control'),
                      'at': datetime.now(timezone.utc).isoformat()}
            results.append(record)
            require(len(raw) <= 4096 and response.status == status)
            require('no-store' in (record['cache_control'] or '') and record['date'])
            require(response.headers.get('Age') is None)
            decoded = json.loads(raw) if raw else None
            if alias.startswith('selection'):
                record['snapshot'] = decoded  # Public synthetic source data only.
            elif decoded:
                allowed_keys = {'id', 'token_version', 'lease_expires_at', 'session_id', 'activity_id', 'generation', 'revoked', 'error'}
                record['body_keys'] = sorted(set(decoded) & allowed_keys)
                record['unexpected_body_keys'] = bool(set(decoded) - allowed_keys)
                if method == 'POST':
                    record['receipt_matches'] = decoded == {'id': path.split('/')[-2], **body, 'revoked': True}
                    require(record['receipt_matches'])
                elif method == 'PUT' and status == 200:
                    require(set(decoded) == {'id', 'token_version', 'lease_expires_at'})
                    require(decoded['id'] == path.split('/')[-1] and decoded['token_version'] == 1)
            return decoded
    try:
        state = request('selection-state', 'GET', '/s/42/state.json', 200)['session']
        detail = request('selection-detail', 'GET', '/s/42.json', 200)['session']
        require(state['id'] == detail['id'] == 42 and state['revision'] == detail['revision'])
        require(state['status'] == detail['status'] == 'active')
        registration, generation = str(uuid.uuid4()), str(uuid.uuid4())
        secret = secrets.token_hex(32)
        path = '/public/service_activity_registrations/' + registration
        body = {'session_id': 42, 'activity_id': 'synthetic-http-probe', 'generation': generation,
                'push_token': secrets.token_hex(32), 'token_version': 1,
                'consent_version': 'public-lock-screen-v1', 'lease_seconds': 3600}
        first = {'path': path, 'identity': {key: body[key] for key in ('session_id', 'activity_id', 'generation')}, 'secret': secret, 'resolved': False}
        staged.append(first)  # Stage before any possibly committing PUT.
        request('put-initial', 'PUT', path, 200, body, secret)
        request('put-idempotent', 'PUT', path, 200, body, secret)
        request('wrong-capability', 'DELETE', path, 403, secret=secrets.token_hex(32))
        request('delete', 'DELETE', path, 204, secret=secret)
        request('put-after-delete', 'PUT', path, 409, body, secret)
        identity = {key: body[key] for key in ('session_id', 'activity_id', 'generation')}
        request('fenced-existing', 'POST', path + '/revoke', 200, identity, secret)
        first['resolved'] = True
        path = '/public/service_activity_registrations/' + str(uuid.uuid4())
        body.update(generation=str(uuid.uuid4()), activity_id='synthetic-absent-http-probe')
        identity = {key: body[key] for key in ('session_id', 'activity_id', 'generation')}
        second = {'path': path, 'identity': identity, 'secret': secret, 'resolved': False}
        staged.append(second)
        request('fenced-never-created', 'POST', path + '/revoke', 200, identity, secret)
        second['resolved'] = True
        request('late-put-after-fence', 'PUT', path, 409, body, secret)
        request('fenced-idempotent', 'POST', path + '/revoke', 200, identity, secret)
    finally:
        for record in staged:
            if not record['resolved']:
                try:
                    request('cleanup-fence', 'POST', record['path'] + '/revoke', 200, record['identity'], record['secret'])
                    record['resolved'] = True
                except Exception as error:
                    results.append({'alias': 'cleanup-fence-failed', 'error_class': type(error).__name__})
        with output.open('x') as evidence:
            json.dump({'scope': 'real HTTP/genuine isolated Rails; synthetic credentials never emitted',
                       'unresolved_identities': sum(not item['resolved'] for item in staged),
                       'results': results}, evidence, indent=2)
    print(json.dumps({'requests': len(results), 'all_expected': True}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error_class': type(error).__name__,
                          'recovery': 'possibly attempted identities remain unresolved unless exact receipts observed'}))
        raise SystemExit(1)

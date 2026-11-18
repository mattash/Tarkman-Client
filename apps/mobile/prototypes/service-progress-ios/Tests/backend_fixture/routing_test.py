#!/usr/bin/env python3
"""Offline guards plus owned ephemeral loopback HTTP. Not TLS/Rails/UI proof."""
import contextlib
import fcntl
import os
import socket
import subprocess
import sys
import hashlib
import http.client
import http.server
import io
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from routing_gateway import Export, Gateway, load_packet, verify_fixture
from routing_plan import binding, digest, main, plan

ORIGIN = 'https://fixture.example.invalid'
ID = '11111111-1111-4111-8111-111111111111'
IDENTITY = {'session_id': 42, 'activity_id': 'synthetic-route-test', 'generation': ID}
PUT = {**IDENTITY, 'push_token': 'ab' * 32, 'token_version': 1, 'consent_version': 'public-lock-screen-v1', 'lease_seconds': 3600}


def config(backend='http://127.0.0.1:18777'):
    return binding(ORIGIN, backend, 'http://127.0.0.1:18778', 'sp277-test-only', 'sp277_test_only', 42, [1, 2, 3], '3ed66950d0d325f7931a7bb4647c7cf6fc0edb4e')


def receipt(root, cfg):
    # Tiny opaque file bytes exercise the export contract only. This is not a
    # reader UI or alternative HTML deliverable, nor actual Expo-build evidence.
    files = {'index.html': b'unit-test-export-bytes', '_expo/static/web/test.js': ORIGIN.encode()}
    for name, data in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return {'binding_sha256': digest(cfg), 'client_sha': cfg['client_sha'],
            'export_tree_sha256': digest({p: hashlib.sha256(data).hexdigest() for p, data in files.items()}),
            'exact_build_environment': {'EXPO_PUBLIC_API_URL': cfg['origin'],
                                        'EXPO_PUBLIC_ACTIONCABLE_URL': cfg['origin'].replace('https:', 'wss:') + '/cable',
                                        'EXPO_NO_DOTENV': '1'}}


class PlanTests(unittest.TestCase):
    def test_disabled_has_no_resource_access(self):
        output = io.StringIO()
        with patch('pathlib.Path.read_text', side_effect=AssertionError('read')), patch('subprocess.run', side_effect=AssertionError('process')), patch('socket.socket', side_effect=AssertionError('socket')), contextlib.redirect_stdout(output):
            self.assertEqual(main([]), 0)
        self.assertEqual(json.loads(output.getvalue()), {'status': 'disabled'})

    def test_enabled_must_stay_dry_and_errors_do_not_echo(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(main(['--enabled', '--origin', 'https://secret:credential@example.invalid']), 2)
        self.assertEqual(json.loads(output.getvalue()), {'status': 'rejected', 'reason': 'routing_configuration'})
        self.assertNotIn('secret', output.getvalue())

    def test_origin_namespace_and_session_rejections(self):
        base = config()
        cases = {'origin': ['http://fixture.invalid', ORIGIN + '/', ORIGIN + '/path', ORIGIN + '?secret', 'https://user:secret@fixture.invalid', 'https://UPPER.invalid', 'https://127.0.0.1', 'https://fixture.invalid:443', 'https://bad..invalid'],
                 'backend': ['http://localhost:18777', 'http://127.0.0.1:018777', ORIGIN, 'http://127.0.0.1:65536'],
                 'gateway': [base['backend']], 'namespace': ['production', '../sp277-x'],
                 'database': ['production', 'sp277-x'], 'session_id': [True, 0, 43], 'part_ids': [[], [1, 1], [True]],
                 'client_sha': ['HEAD', 'a' * 39]}
        for field, values in cases.items():
            for value in values:
                bad = {**base, field: value}
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    binding(bad['origin'], bad['backend'], bad['gateway'], bad['namespace'], bad['database'], bad['session_id'], bad['part_ids'], bad['client_sha'])

    def test_explicit_build_native_and_tunnel_bindings(self):
        cfg = config()
        result = plan(cfg, '/tmp/sp277-new-reviewed-routing', ID)
        self.assertFalse(result['trust_verified'])
        self.assertFalse(result['network_performed'])
        self.assertEqual(result['reader_url'], ORIGIN + '/sessions/42/parts')
        self.assertEqual(set(result['native_generation_environment'].values()), {ORIGIN})
        self.assertEqual(result['build']['environment']['EXPO_PUBLIC_API_URL'], ORIGIN)
        self.assertEqual(result['build']['environment']['EXPO_NO_DOTENV'], '1')
        self.assertFalse(result['build']['inherit_environment'])
        self.assertIn('http://127.0.0.1:18778', result['cloudflared_config_dry_run'])
        self.assertNotIn(cfg['backend'], result['cloudflared_config_dry_run'])
        self.assertIn('http_status:404', result['cloudflared_config_dry_run'])
        self.assertIn('/tmp/sp277-new-reviewed-routing/tunnel-credentials.json', result['cloudflared_config_dry_run'])
        self.assertNotIn('.cloudflared', result['cloudflared_config_dry_run'])

    def test_export_receipt_and_tree_reject_cross_namespace_origin_and_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root, cfg = Path(directory).resolve(), config()
            record = receipt(root, cfg)
            Export(root, cfg, record)
            for replacement in ({'namespace': 'sp277-other'}, {'origin': 'https://other.example.invalid'}, {'client_sha': 'a' * 40}):
                with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                    Export(root, {**cfg, **replacement}, record)
            bad = json.loads(json.dumps(record))
            bad['exact_build_environment']['EXPO_PUBLIC_API_URL'] = 'https://production.example.invalid'
            with self.assertRaises(ValueError):
                Export(root, cfg, bad)
            (root / 'index.html').write_bytes(b'tampered')
            with self.assertRaises(ValueError):
                Export(root, cfg, record)

    def test_export_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, cfg = Path(directory).resolve(), config()
            record = receipt(root, cfg)
            (root / 'link').symlink_to(root / 'index.html')
            with self.assertRaises(ValueError):
                Export(root, cfg, record)


class QuickPlanTests(unittest.TestCase):
    def quick(self, **kwargs):
        from routing_quick import quick_plan
        return quick_plan('/private/tmp/sp277-quick-not-created', 'http://127.0.0.1:18779', 'http://127.0.0.1:18780',
                          'sp277-quick-test', 'sp277_quick_test', 42, [1, 2, 3], 'a' * 40, **kwargs)

    def test_unassigned_bootstrap_never_exposes_reader_or_requires_account(self):
        with patch('socket.socket', side_effect=AssertionError('network')), patch('pathlib.Path.lstat', side_effect=AssertionError('filesystem')), patch('subprocess.run', side_effect=AssertionError('process')):
            packet = self.quick()
        self.assertFalse(packet['reader_or_native_use_allowed'])
        self.assertFalse(packet['account_or_dns_or_credentials_required'])
        self.assertNotIn('routing_manifest_packet', packet)
        self.assertFalse(packet['future_command_inherit_environment'])
        self.assertEqual(packet['empty_config_exact_text'], '{}\n')
        command = packet['future_command_NOT_EXECUTED']
        self.assertIn('--config', command)
        self.assertNotIn('--credentials-file', command)
        self.assertNotIn('--no-tls-verify', command)
        self.assertIn('--metrics', command)
        self.assertNotIn('TUNNEL_TOKEN', packet['future_command_environment'])

    def test_assignment_binds_all_origins_but_is_not_live_trust(self):
        # Validator-only synthetic input; no claim this hostname exists/is owned.
        assigned = 'https://synthetic-validator-only.trycloudflare.com'
        packet = self.quick(assigned=assigned, expected=assigned)
        manifest = packet['routing_manifest_packet']
        self.assertEqual(manifest['binding']['origin'], assigned)
        self.assertEqual(manifest['build']['environment']['EXPO_PUBLIC_API_URL'], assigned)
        self.assertEqual(set(manifest['native_generation_environment'].values()), {assigned})
        self.assertFalse(packet['trust_verified'])
        self.assertFalse(packet['reader_or_native_use_allowed'])
        self.assertNotIn('cloudflared_config_dry_run', manifest)

    def test_origin_reassignment_and_malformed_assignment_rejected(self):
        for assigned in ('http://synthetic.trycloudflare.com', 'https://synthetic.trycloudflare.com/path', 'https://user:private@synthetic.trycloudflare.com', 'https://synthetic.trycloudflare.com.evil.invalid', 'https://fixture.example.invalid', 'https://trycloudflare.com'):
            with self.subTest(assigned=assigned), self.assertRaises(ValueError):
                self.quick(assigned=assigned)
        with self.assertRaises(ValueError):
            self.quick(assigned='https://new-synthetic.trycloudflare.com', expected='https://old-synthetic.trycloudflare.com')

    def test_all_cli_parser_errors_redact_values(self):
        from routing_quick import main as quick_main
        for entry in (main, quick_main):
            output = io.StringIO()
            with contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as error:
                entry(['--private-token-DO-NOT-PRINT'])
            self.assertEqual(error.exception.code, 2)
            self.assertNotIn('DO-NOT-PRINT', output.getvalue())
            self.assertEqual(json.loads(output.getvalue())['reason'], 'routing_arguments')


class EntrypointTests(unittest.TestCase):
    def packet(self, root, gateway_port, backend_port=18777):
        cfg = binding(ORIGIN, f'http://127.0.0.1:{backend_port}', f'http://127.0.0.1:{gateway_port}', 'sp277-cli-test', 'sp277_cli_test', 42, [1, 2, 3], 'a' * 40)
        export = root / 'reader-export'
        export.mkdir()
        record = receipt(export, cfg)
        manifest = {'binding': cfg, 'binding_sha256': digest(cfg)}
        for name, value in [('routing-manifest.json', manifest), ('reader-export-receipt.json', record)]:
            path = root / name
            path.write_text(json.dumps(value))
            path.chmod(0o600)
        fixture = root / 'synthetic-owned-runtime'
        fixture.mkdir(mode=0o700)
        facts = {'root': str(fixture), 'backend_sha': cfg['backend_sha'], 'enabled': True, 'mode': 'serve', 'database': cfg['database'], 'http_port': backend_port}
        runtime = fixture / '.runtime-sp277_cli_test.json'
        runtime.write_text(json.dumps(facts))
        runtime.chmod(0o600)
        lock = (fixture / '.runtime-sp277_cli_test.lock').open('w')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return cfg, fixture, lock, runtime, facts

    def test_cli_defaults_no_resource_calls(self):
        from routing_export import main as export_main
        from routing_gateway import main as gateway_main
        with patch('socket.socket', side_effect=AssertionError('socket')), patch('pathlib.Path.lstat', side_effect=AssertionError('filesystem')), patch('subprocess.run', side_effect=AssertionError('process')), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(gateway_main([]), 0)
            self.assertEqual(export_main([]), 0)

    def test_nonsecret_runtime_namespace_binding_lock_and_packet_guards(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            cfg, fixture, lock, runtime, facts = self.packet(root, 18778)
            try:
                load_packet(root)
                verify_fixture(fixture, cfg)
                for replacement in ({'database': 'sp277_wrong'}, {'http_port': 18779}, {'mode': 'schema'}, {'backend_sha': 'b' * 40}, {'root': '/private/tmp/wrong'}):
                    runtime.write_text(json.dumps({**facts, **replacement}))
                    with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                        verify_fixture(fixture, cfg)
                runtime.write_text(json.dumps(facts))
                fcntl.flock(lock, fcntl.LOCK_UN)
                with self.assertRaises(ValueError):
                    verify_fixture(fixture, cfg)
                (root / 'routing-manifest.json').chmod(0o644)
                with self.assertRaises(ValueError):
                    load_packet(root)
            finally:
                lock.close()

    def test_actual_gateway_cli_serves_only_bound_route_and_closes_on_cap(self):
        # This is synthetic runtime metadata, not a Rails/PG process claim.
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            port = reservation.getsockname()[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            _, fixture, lock, _, _ = self.packet(root, port)
            command = [sys.executable, str(Path(__file__).with_name('routing_gateway.py')), '--enabled', '--serve-owned-loopback', '--root', str(root), '--fixture-root', str(fixture), '--ttl', '3', '--max-requests', '1']
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'})
            try:
                ready = json.loads(process.stdout.readline())
                self.assertEqual(ready['event'], 'routing_ready')
                connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
                try:
                    connection.request('GET', '/sessions/42/parts', headers={'Host': 'fixture.example.invalid'})
                    response = connection.getresponse()
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), b'unit-test-export-bytes')
                finally:
                    connection.close()
                output, error = process.communicate(timeout=5)
                self.assertEqual(process.returncode, 0, error)
                self.assertTrue(json.loads(output)['listener_closed'])
                with socket.socket() as probe:
                    self.assertNotEqual(probe.connect_ex(('127.0.0.1', port)), 0)
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.communicate(timeout=5)
                lock.close()

    def test_absolute_run_deadline_interrupts_partial_headers_body_and_drip_upstream(self):
        upstream_released = threading.Event()
        class DripBackend(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                try:
                    self.send_response(200)
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('Content-Length', '100')
                    self.end_headers()
                    # A byte every0.1s would defeat a3s-per-recv timeout. This
                    # deliberate network simulation stops as soon as owned peer closes.
                    for _ in range(40):
                        self.wfile.write(b'.')
                        self.wfile.flush()
                        if upstream_released.wait(0.1):
                            break
                except (OSError, ConnectionError):
                    pass
        backend = http.server.HTTPServer(('127.0.0.1', 0), DripBackend)
        thread = threading.Thread(target=backend.serve_forever)
        thread.start()
        try:
            for kind in ('partial_headers', 'partial_body', 'drip_upstream', 'sigterm_partial_headers', 'request_deadline_upstream'):
                with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                    with socket.socket() as reservation:
                        reservation.bind(('127.0.0.1', 0))
                        port = reservation.getsockname()[1]
                    root = Path(directory).resolve()
                    _, fixture, lock, _, _ = self.packet(root, port, backend.server_port)
                    command = [sys.executable, str(Path(__file__).with_name('routing_gateway.py')), '--enabled', '--serve-owned-loopback', '--root', str(root), '--fixture-root', str(fixture), '--ttl', '10' if kind == 'request_deadline_upstream' else '1']
                    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'})
                    client = None
                    try:
                        self.assertEqual(json.loads(process.stdout.readline())['event'], 'routing_ready')
                        start = time.monotonic()
                        client = socket.create_connection(('127.0.0.1', port), timeout=6)
                        if kind in ('partial_headers', 'sigterm_partial_headers'):
                            client.sendall(b'GET /s/42.json HTTP/1.0\r\nHost: fixture.example.invalid\r\nX-Partial: ')
                        elif kind == 'partial_body':
                            client.sendall(('PUT /public/service_activity_registrations/' + ID + ' HTTP/1.0\r\nHost: fixture.example.invalid\r\nContent-Type: application/json\r\nContent-Length: 4096\r\nX-Service-Activity-Secret: ' + 'c' * 64 + '\r\n\r\n{').encode())
                        else:
                            client.sendall(b'GET /s/42.json HTTP/1.0\r\nHost: fixture.example.invalid\r\n\r\n')
                        if kind == 'sigterm_partial_headers':
                            process.terminate()
                        try:
                            self.assertEqual(client.recv(8192), b'')
                        except ConnectionResetError:
                            # SIGTERM before accept may close a backlog socket by
                            # reset rather than EOF; both prove owned peer closed.
                            pass
                        output, error = process.communicate(timeout=3)
                        self.assertEqual(process.returncode, 0, error)
                        self.assertLess(time.monotonic() - start, 4.5 if kind == 'request_deadline_upstream' else 2.5)
                        self.assertTrue(json.loads(output)['listener_closed'])
                        self.assertEqual(error, '')
                        with socket.socket() as probe:
                            self.assertNotEqual(probe.connect_ex(('127.0.0.1', port)), 0)
                    finally:
                        if client:
                            client.close()
                        if process.poll() is None:
                            process.terminate()
                            process.communicate(timeout=3)
                        lock.close()
        finally:
            upstream_released.set()
            backend.shutdown()
            backend.server_close()
            thread.join(timeout=3)
            self.assertFalse(thread.is_alive())

    def test_actual_gateway_cli_rejects_occupied_port_and_ttl(self):
        with socket.socket() as occupied, tempfile.TemporaryDirectory() as directory:
            occupied.bind(('127.0.0.1', 0))
            occupied.listen()
            root = Path(directory).resolve()
            _, fixture, lock, _, _ = self.packet(root, occupied.getsockname()[1])
            command = [sys.executable, str(Path(__file__).with_name('routing_gateway.py')), '--enabled', '--serve-owned-loopback', '--root', str(root), '--fixture-root', str(fixture)]
            try:
                for extra in ([], ['--ttl', '301']):
                    result = subprocess.run(command + extra, capture_output=True, text=True, timeout=5, env={'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'})
                    self.assertEqual(result.returncode, 2)
                    self.assertEqual(json.loads(result.stdout)['status'], 'rejected')
                    self.assertNotIn('Traceback', result.stderr)
            finally:
                lock.close()


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.gateway = Gateway(config())
        self.headers = {'Host': 'fixture.example.invalid', 'Content-Type': 'application/json'}
        self.path = '/public/service_activity_registrations/' + ID

    def route(self, method, path, body=b'', headers=None):
        selected = headers or self.headers
        if method in ('PUT', 'DELETE', 'POST'):
            selected = {**selected, 'X-Service-Activity-Secret': 'c' * 64}
        return self.gateway.route(method, path, selected, body)

    def test_public_reads(self):
        for path in ('/s/42.json', '/s/42/state.json', '/s/42/parts.json', '/s/42/parts/1.json', '/services.json?tz=America%2FLos_Angeles'):
            with self.subTest(path=path):
                self.assertEqual(self.route('GET', path), ('backend', path))

    def test_mutations_exact_session_and_fence_shape(self):
        self.assertEqual(self.route('PUT', self.path, json.dumps(PUT).encode())[0], 'backend')
        self.assertEqual(self.route('DELETE', self.path)[0], 'backend')
        self.assertEqual(self.route('POST', self.path + '/revoke', json.dumps(IDENTITY).encode())[0], 'backend')

    def test_forbidden_routes_queries_and_methods(self):
        for method, path in [('GET', '/login'), ('GET', '/'), ('GET', '/sessions/43/parts'), ('GET', '/s/43.json'), ('GET', '/s/42/parts/99.json'), ('GET', '/cable'), ('GET', '/s/42/state.json?anything=1'), ('GET', '/services.json?tz=America%2FLos_Angeles&tz=America%2FLos_Angeles'), ('GET', '/services.json?tz=UTC'), ('POST', '/s/42.json'), ('OPTIONS', '/s/42.json'), ('GET', '/%73/42.json'), ('GET', '//s/42.json'), ('GET', '/s/../42.json'), ('GET', self.path), ('POST', self.path), ('PUT', self.path + '/revoke'), ('DELETE', self.path + '?secret=value')]:
            with self.subTest(method=method, path=path), self.assertRaises(ValueError):
                self.route(method, path)

    def test_mutation_body_namespace_types_duplicates_and_bounds(self):
        for body in (b'{"session_id":43}', b'{"session_id":true}', b'{"session_id":42.0}', b'{"session_id":42,"session_id":43}', b'[]', b'not-json', b'x' * 4097):
            with self.subTest(body=body[:64]), self.assertRaises(ValueError):
                self.route('PUT', self.path, body)
        with self.assertRaises(ValueError):
            self.route('DELETE', self.path, b'{}')

    def test_cookie_auth_host_and_framing_fail_closed(self):
        for extra in ({'Host': 'production.example.invalid'}, {'Cookie': 'secret=private'}, {'Authorization': 'Bearer private'}, {'Proxy-Authorization': 'private'}, {'Transfer-Encoding': 'chunked'}, {'Content-Length': '99'}):
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                self.route('GET', '/s/42.json', headers={**self.headers, **extra})

    def test_capability_is_mutation_only_and_bounded(self):
        for secret in ('', 'x' * 31, 'x' * 513, 'x' * 32 + '\r\nInjected: private', 'x' * 32 + ' '):
            with self.subTest(length=len(secret)), self.assertRaises(ValueError):
                self.gateway.route('DELETE', self.path, {**self.headers, 'X-Service-Activity-Secret': secret})
        with self.assertRaises(ValueError):
            self.gateway.route('GET', '/s/42.json', {**self.headers, 'X-Service-Activity-Secret': 'x' * 64})
        for extra in ('X-Forwarded-Host', 'X-HTTP-Method-Override', 'X-Original-URL', 'CF-Access-Jwt-Assertion'):
            with self.subTest(header=extra), self.assertRaises(ValueError):
                self.route('GET', '/s/42.json', headers={**self.headers, extra: 'private'})

    def test_request_and_mutation_caps(self):
        gateway = Gateway(config(), max_requests=1)
        gateway.route('GET', '/s/42.json', self.headers)
        with self.assertRaises(ValueError):
            gateway.route('GET', '/s/42.json', self.headers)
        gateway = Gateway(config(), max_mutations=1)
        mutation_headers = {**self.headers, 'X-Service-Activity-Secret': 'c' * 64}
        gateway.route('DELETE', self.path, mutation_headers)
        with self.assertRaises(ValueError):
            gateway.route('DELETE', self.path, mutation_headers)

    def test_failure_body_is_redacted(self):
        status, _, body = self.gateway.respond('POST', '/secret-private-value', self.headers, b'{"capability":"DO-NOT-PRINT"}')
        self.assertEqual(status, 403)
        self.assertEqual(body, b'{"error":"isolated_route_rejected"}')


class SocketTests(unittest.TestCase):
    def test_same_backend_namespace_static_reader_and_upstream_rejections(self):
        seen = []
        class SyntheticBackend(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                seen.append((self.path, dict(self.headers)))
                status = 302 if self.path.endswith('/parts.json') else 200
                self.send_response(status)
                self.send_header('Cache-Control', 'no-store')
                if self.path.endswith('/parts/2.json'):
                    self.send_header('Set-Cookie', 'must-not-pass=secret')
                if status == 302:
                    self.send_header('Location', 'https://production.example.invalid')
                self.end_headers()
                self.wfile.write(b'{"session_id":42,"namespace":"sp277-test-only"}')
        backend = http.server.HTTPServer(('127.0.0.1', 0), SyntheticBackend)
        backend_thread = threading.Thread(target=backend.serve_forever)
        backend_thread.start()
        gateway_server = None
        try:
            cfg = config(f'http://127.0.0.1:{backend.server_port}')
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve()
                export = Export(root, cfg, receipt(root, cfg))
                gateway = Gateway(cfg, export)
                class Adapter(http.server.BaseHTTPRequestHandler):
                    def log_message(self, *_):
                        pass
                    def do_GET(self):
                        status, headers, body = gateway.respond('GET', self.path, dict(self.headers))
                        self.send_response(status)
                        for key, value in headers.items():
                            self.send_header(key, value)
                        self.end_headers()
                        self.wfile.write(body)
                gateway_server = http.server.HTTPServer(('127.0.0.1', 0), Adapter)
                thread = threading.Thread(target=gateway_server.serve_forever)
                thread.start()
                def get(path):
                    connection = http.client.HTTPConnection('127.0.0.1', gateway_server.server_port, timeout=3)
                    try:
                        connection.request('GET', path, headers={'Host': 'fixture.example.invalid', 'X-Forwarded-For': '192.0.2.1'})
                        response = connection.getresponse()
                        return response.status, response.read()
                    finally:
                        connection.close()
                self.assertEqual(get('/sessions/42/parts'), (200, b'unit-test-export-bytes'))
                for path in ('/s/42/state.json', '/s/42.json', '/s/42/parts/1.json'):
                    status, body = get(path)
                    self.assertEqual(status, 200)
                    self.assertEqual(json.loads(body)['namespace'], cfg['namespace'])
                self.assertEqual(get('/s/42/parts.json')[0], 403)  # no redirect follow
                self.assertEqual(get('/s/42/parts/2.json')[0], 200)  # Rails cookie stripped
                status, safe_headers, _ = gateway.respond('GET', '/s/42/parts/2.json', {'Host': 'fixture.example.invalid'})
                self.assertEqual(status, 200)
                self.assertNotIn('set-cookie', safe_headers)
                self.assertEqual(get('/sessions/43/parts')[0], 403)
                self.assertTrue(all('X-Forwarded-Host' not in headers for _, headers in seen))
        finally:
            if gateway_server:
                port = gateway_server.server_port
                gateway_server.shutdown()
                gateway_server.server_close()
                thread.join(timeout=3)
                self.assertFalse(thread.is_alive())
                with self.assertRaises(OSError):
                    http.client.HTTPConnection('127.0.0.1', port, timeout=1).connect()
            backend.shutdown()
            backend.server_close()
            backend_thread.join(timeout=3)
            self.assertFalse(backend_thread.is_alive())


if __name__ == '__main__':
    unittest.main()

"""Default-off, bounded, manifest-bound owned-loopback gateway; no public launch.

Tests exercise real owned loopback HTTP; this module is not a TLS server and
cannot establish DNS/certificate/system trust. Never invokes cloudflared.
"""
import fcntl
import http.server
import os
import signal
import socket
import stat
import time
import hashlib
import http.client
import json
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlsplit

from routing_plan import UUID, RoutingArgumentParser, binding, digest, require


class Export:
    """Exact reviewed Expo export, not a generated/mock reader HTML page."""
    def __init__(self, root, config, receipt):
        self.root = Path(root)
        require(self.root.is_absolute() and self.root.resolve() == self.root and self.root.is_dir(), 'export_root')
        require(receipt.get('binding_sha256') == digest(config) and receipt.get('client_sha') == config['client_sha'], 'export_binding')
        env = receipt.get('exact_build_environment', {})
        require(env.get('EXPO_PUBLIC_API_URL') == config['origin'] and
                env.get('EXPO_PUBLIC_ACTIONCABLE_URL') == config['origin'].replace('https:', 'wss:') + '/cable' and
                env.get('EXPO_NO_DOTENV') == '1', 'export_environment')
        self.files = {}
        for path in sorted(self.root.rglob('*')):
            require(not path.is_symlink(), 'export_symlink')
            if path.is_file():
                relative = path.relative_to(self.root).as_posix()
                data = path.read_bytes()
                self.files[relative] = data
        require('index.html' in self.files and any(p.endswith('.js') for p in self.files), 'expo_export_required')
        tree = {p: hashlib.sha256(data).hexdigest() for p, data in self.files.items()}
        require(receipt.get('export_tree_sha256') == digest(tree), 'export_tree')
        # A receipt records the build's inputs; it is not independent bundle semantic
        # verification. Keep source/build logs for review, do not attest arbitrary dist.

    def read(self, path, session_id):
        if path == f'/sessions/{session_id}/parts':
            name = 'index.html'
        elif path.startswith('/_expo/static/') or path.startswith('/assets/'):
            name = path[1:]
        elif path == '/favicon.ico':
            name = 'favicon.ico'
        else:
            return None
        if name not in self.files or name.endswith(('.map', '.json', '.html')) and name != 'index.html':
            return None
        return self.files[name], mimetypes.guess_type(name)[0] or 'application/octet-stream'


class Gateway:
    def __init__(self, config, export=None, max_requests=100, max_mutations=20):
        require(type(max_requests) is int and 1 <= max_requests <= 1000, 'request_bound')
        require(type(max_mutations) is int and 1 <= max_mutations <= 100, 'mutation_bound')
        self.config, self.export = config, export
        self.remaining, self.mutations = max_requests, max_mutations
        self.identities = set()
        self.active_connection = None
        self.active_socket = None
        self.stopped = lambda: False

    def route(self, method, target, headers, body=b''):
        headers = {k.lower(): v for k, v in headers.items()}
        require(headers.get('host') == urlsplit(self.config['origin']).netloc, 'host_binding')
        require(not any(k in headers for k in ('cookie', 'authorization', 'proxy-authorization', 'transfer-encoding',
                                             'x-forwarded-host', 'x-http-method-override', 'x-method-override',
                                             'x-original-url', 'x-rewrite-url', 'cf-access-jwt-assertion')), 'credential_or_framing')
        # cloudflared supplies forwarding metadata. Ignore it; never trust or
        # propagate it to the synthetic backend (including client-supplied forms).
        require(isinstance(body, bytes) and len(body) <= 4096, 'body_bound')
        if 'content-length' in headers:
            require(headers['content-length'] == str(len(body)), 'content_length')
        require(isinstance(target, str) and len(target) <= 2048 and target.startswith('/') and not target.startswith('//') and
                not re.search(r'[\\%#\s\x00-\x1f\x7f]', target.split('?')[0]), 'canonical_target')
        path, separator, query = target.partition('?')
        require(not any(p in ('.', '..', '') for p in path.split('/')[1:]), 'canonical_path')
        require(self.remaining > 0, 'request_bound')
        self.remaining -= 1
        sid = self.config['session_id']
        reads = {f'/s/{sid}.json', f'/s/{sid}/state.json', f'/s/{sid}/parts.json'}
        reads.update(f'/s/{sid}/parts/{pid}.json' for pid in self.config['part_ids'])
        if method == 'GET' and not body:
            require('x-service-activity-secret' not in headers, 'capability_on_read')
            if (path in reads and not separator) or target == '/services.json?tz=America%2FLos_Angeles':
                return 'backend', target
            if not separator and self.export:
                data = self.export.read(path, sid)
                if data:
                    return 'static', data
        registration = re.fullmatch(r'/public/service_activity_registrations/(' + UUID + r')(/revoke)?', path)
        require(registration and not separator and ((registration[2] is None and method in ('PUT', 'DELETE')) or
                (registration[2] == '/revoke' and method == 'POST')), 'route_scope')
        secret = headers.get('x-service-activity-secret', '')
        require(isinstance(secret, str) and 32 <= len(secret) <= 512 and all(33 <= ord(c) <= 126 for c in secret), 'capability_shape')
        require(self.mutations > 0, 'mutation_bound')
        self.mutations -= 1
        if method == 'DELETE':
            require(not body, 'delete_body')
        else:
            require(headers.get('content-type') == 'application/json', 'content_type')
            try:
                def unique(pairs):
                    result = {}
                    for key, value in pairs:
                        require(key not in result, 'duplicate_json')
                        result[key] = value
                    return result
                obj = json.loads(body, object_pairs_hook=unique)
            except (ValueError, UnicodeError):
                raise ValueError('mutation_json') from None
            require(isinstance(obj, dict) and type(obj.get('session_id')) is int and obj['session_id'] == sid, 'session_binding')
            identity = {'session_id', 'activity_id', 'generation'}
            expected = identity if method == 'POST' else identity | {'push_token', 'token_version', 'consent_version', 'lease_seconds'}
            require(set(obj) == expected, 'mutation_keys')
            require(isinstance(obj.get('activity_id'), str) and 1 <= len(obj['activity_id'].encode()) <= 200 and
                    isinstance(obj.get('generation'), str) and re.fullmatch(UUID, obj['generation']), 'mutation_identity')
            if method == 'PUT':
                token = obj.get('push_token')
                require(isinstance(token, str) and re.fullmatch(r'(?:[0-9a-f]{2}){1,100}', token) and
                        type(obj.get('token_version')) is int and 1 <= obj['token_version'] <= 2147483647 and
                        obj.get('consent_version') == 'public-lock-screen-v1' and
                        type(obj.get('lease_seconds')) is int and 60 <= obj['lease_seconds'] <= 3600, 'mutation_payload')
        require(registration[1] in self.identities or len(self.identities) < 20, 'identity_bound')
        self.identities.add(registration[1])
        return 'backend', target

    def respond(self, method, target, headers, body=b''):
        try:
            kind, value = self.route(method, target, headers, body)
            if kind == 'static':
                data, content_type = value
                return 200, {'content-type': content_type, 'cache-control': 'no-store'}, data
            endpoint = urlsplit(self.config['backend'])
            connection = http.client.HTTPConnection(endpoint.hostname, endpoint.port, timeout=3)
            self.active_connection = connection
            try:
                require(not self.stopped(), 'deadline')
                # Never forward caller cookies/account auth/Host/forwarding headers.
                # Exactly one validated capability header is necessary for existing
                # registration/fencing semantics, and only on the mutation allowlist.
                outgoing = {'Accept': 'application/json'}
                if method in ('PUT', 'POST', 'DELETE'):
                    outgoing['X-Service-Activity-Secret'] = next(v for k, v in headers.items() if k.lower() == 'x-service-activity-secret')
                if body:
                    outgoing['Content-Type'] = 'application/json'
                if method == 'DELETE':
                    # Preserve native EOF: no Content-Length/Transfer-Encoding.
                    connection.putrequest(method, value, skip_accept_encoding=True)
                    for key, header_value in outgoing.items():
                        connection.putheader(key, header_value)
                    connection.endheaders()
                else:
                    connection.request(method, value, body=body or None, headers=outgoing)
                self.active_socket = connection.sock
                require(not self.stopped(), 'deadline')
                response = connection.getresponse()
                require(not self.stopped(), 'deadline')
                require(not 300 <= response.status < 400, 'upstream_redirect')
                # Rails public middleware may mint a session cookie even without
                # incoming authentication. Never propagate any Set-Cookie; do not
                # inspect/log its value or turn it into client state.
                require('no-store' in [token.strip().lower() for token in (response.getheader('cache-control') or '').split(',')], 'upstream_cache')
                require(response.getheader('date') is not None and response.getheader('age') is None and
                        response.getheader('content-encoding') in (None, 'identity'), 'upstream_provenance')
                data = response.read(262145)
                require(not self.stopped(), 'deadline')
                require(len(data) <= 262144, 'response_bound')
                result_headers = {k: response.getheader(k) for k in ('content-type', 'cache-control', 'date') if response.getheader(k)}
                return response.status, result_headers, data
            finally:
                connection.close()
                self.active_connection = None
                self.active_socket = None
        except (ValueError, OSError, http.client.HTTPException):
            # Fixed response; no path, exception, registration ID or capability echo.
            return 403, {'content-type': 'application/json', 'cache-control': 'no-store'}, b'{"error":"isolated_route_rejected"}'


def private_path(path, directory=False):
    info = path.lstat()
    require(not path.is_symlink() and path.resolve() == path and info.st_uid == os.getuid() and
            not (stat.S_IMODE(info.st_mode) & 0o077) and
            (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)), 'owned_private_path')


def load_packet(root):
    root = Path(root)
    private_path(root, directory=True)
    manifest_path, receipt_path = root / 'routing-manifest.json', root / 'reader-export-receipt.json'
    private_path(manifest_path)
    private_path(receipt_path)
    manifest = json.loads(manifest_path.read_text())
    cfg = manifest['binding']
    verified = binding(cfg['origin'], cfg['backend'], cfg['gateway'], cfg['namespace'], cfg['database'],
                       cfg['session_id'], cfg['part_ids'], cfg['client_sha'])
    require(verified == cfg and manifest['binding_sha256'] == digest(cfg), 'manifest_binding')
    return cfg, Export(root / 'reader-export', cfg, json.loads(receipt_path.read_text()))


def verify_fixture(fixture_root, cfg):
    """Read only the explicit owned fixture's nonsecret source-runner bindings."""
    root = Path(fixture_root)
    private_path(root, directory=True)
    runtime = root / ('.runtime-' + cfg['database'] + '.json')
    private_path(runtime)
    facts = json.loads(runtime.read_text())
    require(facts.get('root') == str(root) and facts.get('backend_sha') == cfg['backend_sha'] and
            facts.get('enabled') is True and facts.get('mode') == 'serve' and
            facts.get('database') == cfg['database'] and
            cfg['backend'] == 'http://127.0.0.1:' + str(facts.get('http_port')), 'fixture_runtime_binding')
    lock_path = root / ('.runtime-' + cfg['database'] + '.lock')
    info = lock_path.lstat()
    require(not lock_path.is_symlink() and lock_path.resolve() == lock_path and
            stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid(), 'fixture_lock')
    with lock_path.open('r') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        fcntl.flock(lock, fcntl.LOCK_UN)
        raise ValueError('fixture_not_running')


def serve_owned(root, fixture_root, ttl=60, max_requests=100, max_mutations=20):
    require(type(ttl) is int and 1 <= ttl <= 300, 'ttl_bound')
    cfg, export = load_packet(root)
    verify_fixture(fixture_root, cfg)
    gateway = Gateway(cfg, export, max_requests=max_requests, max_mutations=max_mutations)
    endpoint = urlsplit(cfg['gateway'])

    class Handler(http.server.BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.0'
        server_version = 'IsolatedFixture'
        sys_version = ''

        def log_message(self, *_):
            pass

        def send_error(self, code, message=None, explain=None):
            self.send_response(code)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def handle_one_request(self):
            self.connection.settimeout(3)
            # A per-recv timeout alone is not a deadline: slow drip can reset it.
            # Main-thread POSIX alarm bounds the entire request/upstream operation.
            signal.setitimer(signal.ITIMER_REAL, max(0.000001, min(3, deadline - time.monotonic())))
            try:
                super().handle_one_request()
            finally:
                signal.setitimer(signal.ITIMER_REAL, max(0.000001, deadline - time.monotonic()))

        def dispatch(self):
            try:
                # Reject duplicate framing/Host headers before dict conversion.
                names = [name.lower() for name in self.headers.keys()]
                require(len(names) == len(set(names)), 'duplicate_header')
                length = self.headers.get('Content-Length', '0')
                require(re.fullmatch(r'0|[1-9][0-9]{0,3}', length) and int(length) <= 4096, 'body_bound')
                require(not self.headers.get('Expect'), 'expect_rejected')
                body = self.rfile.read(int(length))
                require(len(body) == int(length), 'truncated_body')
                status, headers, data = gateway.respond(self.command, self.path, dict(self.headers), body)
            except (ValueError, OSError):
                status, headers, data = 403, {'cache-control': 'no-store'}, b'{"error":"isolated_route_rejected"}'
            # Preserve the backend's one Date, never add a second/made-up public
            # freshness timestamp through BaseHTTPRequestHandler.send_response.
            self.send_response_only(status)
            self.send_header('Server', 'IsolatedFixture')
            if 'date' not in headers:
                self.send_header('Date', self.date_time_string())
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_PUT = do_DELETE = do_POST = do_HEAD = do_OPTIONS = do_PATCH = dispatch

    # No reuse/bypass: HTTPServer binds precisely the selected 127.0.0.1 port and
    # rejects occupied ports. No preflight/close/rebind race, no outside killing.
    class OwnedServer(http.server.HTTPServer):
        active_request = None

        def get_request(self):
            request, address = super().get_request()
            self.active_request = request
            return request, address

        def finish_request(self, request, client_address):
            if not stopped:
                super().finish_request(request, client_address)

        def shutdown_request(self, request):
            try:
                super().shutdown_request(request)
            finally:
                self.active_request = None

        def handle_error(self, request, client_address):
            # No raw exception/client address/path/header diagnostics.
            pass
    server = OwnedServer((endpoint.hostname, endpoint.port), Handler, bind_and_activate=False)
    server.allow_reuse_address = False
    server.timeout = 0.25
    stopped = False
    gateway.stopped = lambda: stopped
    def stop(*_):
        nonlocal stopped
        stopped = True
        # Shutdown wakes blocking buffered I/O without asynchronously throwing
        # through Python socket/file constructors (which can leave partial objects).
        # These are only this process's tracked accepted/upstream socket objects.
        upstream = gateway.active_connection.sock if gateway.active_connection else None
        for owned in (server.active_request, gateway.active_socket, upstream):
            if owned is not None:
                try:
                    owned.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
    previous = {}
    activated = False
    timer_owned = False
    deadline = time.monotonic() + ttl
    try:
        require(signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), 'exclusive_timer_owner')
        server.server_bind()
        server.server_activate()
        activated = True
        for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGALRM):
            previous[sig] = signal.signal(sig, stop)
        signal.setitimer(signal.ITIMER_REAL, max(0.000001, deadline - time.monotonic()))
        timer_owned = True
        print(json.dumps({'event': 'routing_ready', 'binding_sha256': digest(cfg), 'ttl': ttl,
                          'loopback_only': True, 'tls_verified': False}), flush=True)
        while not stopped and gateway.remaining > 0 and time.monotonic() < deadline:
            server.handle_request()
    finally:
        if timer_owned:
            signal.setitimer(signal.ITIMER_REAL, 0)
        server.server_close()
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        if activated:
            print(json.dumps({'event': 'routing_stopped', 'listener_closed': True}), flush=True)


def main(argv=None):
    parser = RoutingArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true')
    parser.add_argument('--serve-owned-loopback', action='store_true')
    parser.add_argument('--root')
    parser.add_argument('--fixture-root')
    parser.add_argument('--ttl', type=int, default=60)
    parser.add_argument('--max-requests', type=int, default=100)
    parser.add_argument('--max-mutations', type=int, default=20)
    args = parser.parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        require(args.serve_owned_loopback, 'serve_opt_in')
        serve_owned(args.root, args.fixture_root, args.ttl, args.max_requests, args.max_mutations)
        return 0
    except (ValueError, TypeError, OSError, KeyError):
        print(json.dumps({'status': 'rejected', 'reason': 'routing_configuration_or_transport'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

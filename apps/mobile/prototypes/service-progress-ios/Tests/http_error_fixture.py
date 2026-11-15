#!/usr/bin/env python3
"""Owned synthetic socket faults only; never forwards to Rails or any other host.

Routes are canonical UUID aliases 1..12, not arbitrary URLs. All state stays in
memory. No capability, token, activity ID, request path or body is logged.
"""
import argparse
import datetime
import http.server
import json
import re
import socket
import threading

PREFIX = "/public/service_activity_registrations/"
ROUTE = re.compile(r"^" + PREFIX + r"00000000-0000-4000-8000-([0-9]{12})(/revoke)?$")


class Fixture(http.server.ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False

    def __init__(self, port, fd=None):
        super().__init__(("127.0.0.1", port), Handler, bind_and_activate=fd is None)
        if fd is not None:
            self.socket.close()
            self.socket = socket.socket(fileno=fd)
            self.server_address = self.socket.getsockname()
        self.lock = threading.Lock()
        self.requests = 0
        self.redirect_hits = 0
        self.puts = {}
        self.posts = {}
        self.versions = {}
        self.contract_errors = 0


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(4)

    def reply(self, status, body=b"", store=True, **headers):
        self.send_response(status)
        if store:
            self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        for key, value in headers.items():
            self.send_header(key.replace("_", "-"), value)
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_GET(self):
        self.handle_request()

    def do_PUT(self):
        self.handle_request()

    def do_DELETE(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def handle_request(self):
        with self.server.lock:
            self.server.requests += 1
            if self.server.requests > 120:
                self.reply(429)
                return
        if self.path == "/harness-stats" and self.command == "GET":
            # Counts/status only, never synthetic subject identifiers or values.
            with self.server.lock:
                body = json.dumps({"requests": self.server.requests,
                    "redirect_hits": self.server.redirect_hits,
                    "contract_errors": self.server.contract_errors,
                    "drop_puts": self.server.puts.get(10, 0)}).encode()
            self.reply(200, body)
            return
        if self.path == "/redirect-sink":
            with self.server.lock:
                self.server.redirect_hits += 1
            self.reply(403)
            return
        match = ROUTE.fullmatch(self.path)
        if not match or not 1 <= int(match[1]) <= 12:
            self.reply(404)
            return
        alias = int(match[1])
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= 4096:
                raise ValueError()
            raw = self.rfile.read(length)
            obj = json.loads(raw) if raw else None
            secret = self.headers.get("X-Service-Activity-Secret", "")
            if not 32 <= len(secret) <= 512:
                raise ValueError()
            if self.command == "PUT" and not match[2]:
                if set(obj) != {"session_id", "activity_id", "generation", "push_token", "token_version", "consent_version", "lease_seconds"}:
                    raise ValueError()
                if obj["session_id"] != 42 or obj["consent_version"] != "public-lock-screen-v1":
                    raise ValueError()
                with self.server.lock:
                    count = self.server.puts[alias] = self.server.puts.get(alias, 0) + 1
                    old = self.server.versions.get(alias)
                    candidate = (obj["push_token"], obj["token_version"])
                    if alias == 10 and old is not None and candidate != old:
                        self.server.contract_errors += 1
                    self.server.versions[alias] = candidate
                if alias == 10 and count == 1:
                    # Possible server commit followed by a lost receipt, real TCP EOF.
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.close_connection = True
                    return
                expiry = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=120)).strftime("%Y-%m-%dT%H:%M:%SZ")
                receipt = {"id": self.path.removeprefix(PREFIX), "token_version": obj["token_version"], "lease_expires_at": expiry}
                body = json.dumps(receipt).encode()
                if alias == 12:
                    body += b" " * (4096 - len(body))
                if alias == 1:
                    body = b"{"
                if alias == 3:
                    receipt["token_version"] += 1
                    body = json.dumps(receipt).encode()
                if alias == 4:
                    self.reply(200, b"x" * 4097)
                elif alias == 5:
                    self.send_response(200)
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Transfer-Encoding", "chunked")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    self.wfile.write(b"1001\r\n" + b"x" * 4097 + b"\r\n0\r\n\r\n")
                    self.close_connection = True
                elif alias == 6:
                    self.send_response(200)
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Content-Length", "500")
                    self.end_headers()
                    self.wfile.write(b"{")
                    self.wfile.flush()
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.close_connection = True
                elif alias == 7:
                    self.reply(307, Location="http://127.0.0.1:%d/redirect-sink" % self.server.server_address[1])
                elif alias in (8, 9):
                    self.reply(403 if alias == 8 else 409)
                else:
                    self.reply(200, body, store=alias != 2)
            elif self.command == "POST" and match[2]:
                if set(obj) != {"session_id", "activity_id", "generation"} or obj["session_id"] != 42:
                    raise ValueError()
                with self.server.lock:
                    count = self.server.posts[alias] = self.server.posts.get(alias, 0) + 1
                receipt = dict(obj, id=self.path.removeprefix(PREFIX).removesuffix("/revoke"), revoked=True)
                if alias == 11 and count == 1:
                    receipt["activity_id"] = "mismatched-synthetic-subject"
                self.reply(200, json.dumps(receipt).encode())
            elif self.command == "DELETE" and not match[2]:
                self.reply(204)
            else:
                self.reply(405)
        except (ValueError, KeyError, TypeError):
            with self.server.lock:
                self.server.contract_errors += 1
            self.reply(400)
        except (BrokenPipeError, ConnectionResetError, OSError):
            self.close_connection = True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18778)
    parser.add_argument("--fd", type=int)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("explicit port required")
    server = Fixture(args.port, args.fd)
    # Independent TTL even if the runner dies. No automatic/public activation.
    timer = threading.Timer(180, server.shutdown)
    timer.daemon = True
    timer.start()
    try:
        server.serve_forever(poll_interval=0.1)
    finally:
        timer.cancel()
        server.server_close()


if __name__ == "__main__":
    main()

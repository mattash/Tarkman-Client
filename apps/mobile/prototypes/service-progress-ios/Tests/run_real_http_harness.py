#!/usr/bin/env python3
"""macOS, stdlib + installed Swift only. Run from any directory.

Default (also --faults-only): owned socket faults ONLY; no Rails requests.
Explicit --rails: faults, then ONE new synthetic Rails registration on
127.0.0.1:18777 (service 42), with authoritative fence/cleanup checks. Use --rails
only with the separately authorized owned backend running at that exact origin.
No backend setup/mutation outside the actual public client HTTP contract.
"""
import argparse
import contextlib
import http.client
import io
import pathlib
import socket
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ["ServicePublicationV1.swift", "ServiceRemoteExperimentConfiguration.swift",
           "ServicePublicSelection.swift", "ServiceRegistrationURLSessionHTTP.swift",
           "ServiceRegistrationTransport.swift", "ServiceRegistrationCoordinator.swift",
           "ServiceExperimentJournal.swift"]


def argument_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--rails", action="store_true", help="explicitly authorize actual owned Rails HTTP checks")
    mode.add_argument("--faults-only", action="store_true", help="owned socket faults only (the default)")
    return parser


def harness_command(binary, args):
    return [binary, "http://127.0.0.1:18777", "http://127.0.0.1:18778",
            "--rails" if args.rails else "--faults-only"]


def check_cli_policy():
    # Pure offline parser/command checks; no compile, socket or HTTP side effects.
    parser = argument_parser()
    for options, expected in [([], "--faults-only"), (["--faults-only"], "--faults-only"),
                              (["--rails"], "--rails")]:
        if harness_command("synthetic-binary", parser.parse_args(options))[-1] != expected:
            raise RuntimeError("CLI default/opt-in policy failed")
    with contextlib.redirect_stderr(io.StringIO()):
        try:
            parser.parse_args(["--rails", "--faults-only"])
        except SystemExit as error:
            if error.code != 2:
                raise RuntimeError("CLI conflict policy failed")
        else:
            raise RuntimeError("CLI accepted conflicting modes")
    print("PASS offline CLI policy: default/compatibility faults-only; explicit Rails; conflicting flags rejected", flush=True)


def run():
    parser = argument_parser()
    args = parser.parse_args()
    check_cli_policy()
    if sys.platform != "darwin":
        parser.error("the compile gate admits only macOS")
    child = None
    listener = None
    with tempfile.TemporaryDirectory(prefix="service-progress-http-") as directory:
        binary = str(pathlib.Path(directory) / "real-http-harness")
        command = ["swiftc", "-swift-version", "6", "-warnings-as-errors",
                   "-strict-concurrency=complete", "-D", "SERVICE_PROGRESS_HTTP_TESTING"]
        command += [str(ROOT / "Shared" / name) for name in SOURCES]
        command += [str(ROOT / "Tests" / "RealHTTPHarness.swift"), "-o", binary]
        subprocess.run(command, check=True, timeout=120)
        print("PASS compile: Swift 6 strict concurrency, test-only macro", flush=True)
        try:
            # Bind before spawning: occupied port fails closed; no unrelated
            # listener can satisfy readiness. Child inherits this exact socket.
            listener = socket.socket()
            listener.bind(("127.0.0.1", 18778))
            listener.listen(16)
            child = subprocess.Popen([sys.executable, str(ROOT / "Tests" / "http_error_fixture.py"),
                                      "--port", "18778", "--fd", str(listener.fileno())],
                                     pass_fds=(listener.fileno(),), stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
            listener.close()
            listener = None
            command = harness_command(binary, args)
            subprocess.run(command, check=True, timeout=150)
            conn = http.client.HTTPConnection("127.0.0.1", 18778, timeout=4)
            try:
                conn.request("GET", "/harness-stats")
                response = conn.getresponse()
                import json
                stats = json.loads(response.read(4096))
                if response.status != 200 or stats["redirect_hits"] != 0 or stats["contract_errors"] != 0 or stats["drop_puts"] != 2 or stats["requests"] > 120:
                    raise RuntimeError("fixture count/status assertion failed")
                print("PASS fixture: redirects=0 contract_errors=0 dropped-candidate PUTs=2 bounded_requests=%d" % stats["requests"], flush=True)
            finally:
                conn.close()
        finally:
            if listener is not None:
                listener.close()
            if child is not None:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=5)
                # Check the released listener without sending a request elsewhere.
                with socket.socket() as probe:
                    probe.settimeout(1)
                    if probe.connect_ex(("127.0.0.1", 18778)) == 0:
                        raise RuntimeError("fixture listener still active after teardown")
                print("PASS teardown: owned fixture stopped; listener closed", flush=True)


if __name__ == "__main__":
    try:
        run()
    except (subprocess.SubprocessError, OSError, RuntimeError, ValueError):
        # Child Swift errors are labels only; never dump environment or payloads.
        print("FAIL bounded runner (see labeled checks above)", file=sys.stderr)
        sys.exit(1)

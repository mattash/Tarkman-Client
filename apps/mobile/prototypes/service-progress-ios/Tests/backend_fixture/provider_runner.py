#!/usr/bin/env python3
"""Separately gated one-shot provider experiment; no default transport fallback."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import runner

HERE = Path(__file__).resolve().parent


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--enabled', action='store_true')
    result.add_argument('--authorize-provider', action='store_true')
    result.add_argument('--authorize-transport', action='store_true')
    transport = result.add_mutually_exclusive_group()
    transport.add_argument('--synthetic-transport', action='store_true')
    transport.add_argument('--real-transport', action='store_true')
    result.add_argument('--synthetic-scenario', choices=('accepted', 'rejected', 'transport-error', 'expired-registration'), default='accepted')
    result.add_argument('--root', required=True)
    result.add_argument('--database', required=True)
    result.add_argument('--pg-port', type=int, default=55477)
    result.add_argument('--registration-id', action='append', default=[])
    result.add_argument('--input-fd', type=int)
    result.add_argument('--deadline-seconds', type=int, default=15)
    result.add_argument('--rounds', type=int, default=1)
    result.add_argument('--max-requests', type=int, default=4)
    result.add_argument('--initialize-synthetic-fixture', action='store_true')
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    if not (args.authorize_provider and args.authorize_transport and
            (args.synthetic_transport != args.real_transport)):
        raise ValueError('separate gates and explicit transport required')
    if args.real_transport and args.synthetic_scenario != 'accepted':
        raise ValueError('synthetic outcomes forbidden for real transport')
    if not (1 <= args.deadline_seconds <= 30 and 1 <= args.rounds <= 4 and
            1 <= args.max_requests <= 20 and 1 <= len(args.registration_id) <= 20 and
            len(args.registration_id) == len(set(args.registration_id)) and
            len(args.registration_id) * args.rounds <= args.max_requests):
        raise ValueError('invalid bounds')
    import re
    if not all(re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', v) for v in args.registration_id):
        raise ValueError('explicit canonical registration allowlist required')
    if args.input_fd is None or args.input_fd < 3:
        raise ValueError('explicit private input FD required')
    mode = os.fstat(args.input_fd).st_mode
    if not (stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode)):
        raise ValueError('pipe or Unix IPC required')
    root = runner.root_path(args.root)
    database = runner.database_name(args.database)
    pg_port = runner.port_number(args.pg_port)
    runner.validate_root(root)
    runner.validate_pg_directory(root, required=True)
    env = runner.clean_environment(root, database, pg_port)
    runner.ensure_ruby(root, env)
    if args.initialize_synthetic_fixture:
        # Use the unchanged verified schema runner in its own process; never run
        # schema tasks in the process retaining provider/key/module references.
        schema_args = argparse.Namespace(action='schema', database=database, pg_port=pg_port,
                                         http_port=18777, ttl=args.deadline_seconds, max_reads=1)
        runner.serve(schema_args, root)
    configuration = {'root': str(root), 'database': database, 'pg_port': pg_port,
                     'backend_sha': runner.SHA, 'enabled': True,
                     'authorization_enabled': True, 'transport_enabled': True,
                     'synthetic_transport': args.synthetic_transport, 'synthetic_scenario': args.synthetic_scenario,
                     'registration_ids': args.registration_id, 'deadline_seconds': args.deadline_seconds,
                     'rounds': args.rounds, 'max_requests': args.max_requests,
                     'initialize_synthetic_fixture': args.initialize_synthetic_fixture}
    # SAME lock as ordinary fixture: never run concurrently with its key owner.
    with (root / f'.runtime-{database}.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Nonsecret config in anonymous pipe too; no new persisted config file.
        config_read, config_write = os.pipe()
        try:
            encoded = json.dumps(configuration).encode()
            if len(encoded) > 4096:
                raise ValueError('configuration bound')
            os.write(config_write, encoded)
            os.close(config_write)
            config_write = None
            command = [runner.RUBY, str(HERE / 'provider_entrypoint.rb'),
                       f'/dev/fd/{config_read}', str(args.input_fd)]
            child = subprocess.Popen(command, cwd=root / 'src', env=env,
                                     pass_fds=(config_read, args.input_fd))
            previous = {}
            def forward(signum, _frame):
                if child.poll() is None:
                    child.send_signal(signum)
            for signum in (signal.SIGTERM, signal.SIGINT):
                previous[signum] = signal.signal(signum, forward)
            try:
                return child.wait(timeout=args.deadline_seconds + 30)
            finally:
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait()
                for signum, handler in previous.items():
                    signal.signal(signum, handler)
        finally:
            os.close(config_read)
            if config_write is not None:
                os.close(config_write)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError):
        print(json.dumps({'status': 'failed', 'stage': 'provider_runner'}), file=sys.stderr)
        sys.exit(1)

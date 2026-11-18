#!/usr/bin/env python3
"""Default-off disposable backend runner. Never selects a real APNs transport."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tarfile
from urllib.parse import urlencode

SHA = '46481161509155d04e3fcf60ce7928ea19f9614b'
ARCHIVE_SHA256 = 'ce340626b89356c75952081eaac2b1dc292529de3b150c66c207a111bbba95bc'
RUBY = '/opt/homebrew/opt/ruby@3.3/bin/ruby'
PG_BIN = '/opt/homebrew/bin'
HERE = Path(__file__).resolve().parent
MARKER = '.sp277-owned-fixture.json'
STAGE = 'arguments'


def failure_record(error):
    # Numeric errno and fixed stage only: no arbitrary exception text/paths/env.
    return {'status': 'failed', 'error_class': type(error).__name__, 'stage': STAGE,
            'errno': error.errno if isinstance(error, OSError) and isinstance(error.errno, int) else None}


CRITICAL = ('app/services/service_progress.rb', 'app/services/service_progress/apns_provider.rb',
            'app/services/service_progress/apns_curl_http2.rb', 'app/services/service_progress/apns_jwt_auth.rb',
            'app/services/service_progress/development_bootstrap.rb', 'app/services/service_progress/registrations.rb',
            'app/services/service_progress/delivery.rb', 'app/controllers/service_activity_registrations_controller.rb',
            'config/database.yml', 'config/routes.rb')


def root_path(value):
    path = Path(value)
    if not path.is_absolute() or not re.fullmatch(r'sp277[-_][A-Za-z0-9_.-]+', path.name):
        raise ValueError('explicit absolute sp277-owned root required')
    if path.is_symlink():
        raise ValueError('owned root must not be a symlink')
    return path.resolve()


def database_name(value):
    if not re.fullmatch(r'sp277_[a-z0-9_]{1,40}', value):
        raise ValueError('dedicated sp277 database name required')
    return value


def port_number(value):
    value = int(value)
    if not 1024 <= value <= 65535:
        raise ValueError('explicit unprivileged port required')
    return value


def clean_environment(root, database, pg_port, rails_env='development'):
    # Construct an allowlist, never copy os.environ or print its values.
    return {'HOME': str(root / 'home'), 'TMPDIR': str(root / 'tmp'), 'LANG': 'en_US.UTF-8',
            'PATH': '/opt/homebrew/opt/ruby@3.3/bin:/opt/homebrew/bin:/usr/bin:/bin',
            'GEM_HOME': str(root / 'gems'), 'GEM_PATH': str(root / 'gems'),
            'BUNDLE_PATH': str(root / 'bundle'), 'BUNDLE_WITHOUT': 'production:staging',
            'BUNDLE_GEMFILE': str(root / 'src/Gemfile'), 'DISABLE_SPRING': '1',
            'DATABASE_URL': f'postgresql://postgres@localhost/{database}?' + urlencode({'host': str(root / 'socket'), 'port': pg_port}),
            'RAILS_ENV': rails_env, 'SECRET_KEY_BASE_DUMMY': '1', 'S3_BUCKET_NAME': 'sp277-disposable'}


def verify_archive(root):
    archive_path = root / 'backend.tar.gz'
    if hashlib.sha256(archive_path.read_bytes()).hexdigest() != ARCHIVE_SHA256:
        raise ValueError('pinned archive digest mismatch; review packaging before changing pin')
    records = {}
    with tarfile.open(archive_path) as archive:
        members = archive.getmembers()
        prefix = members[0].name.split('/')[0]
        if prefix not in ('mattash-Tarkman-' + SHA, 'mattash-Tarkman-' + SHA[:7]):
            raise ValueError('archive does not identify pinned revision')
        for relative in CRITICAL:
            member = archive.getmember(prefix + '/' + relative)
            original = archive.extractfile(member).read()
            actual = (root / 'src' / relative).read_bytes()
            if actual != original:
                raise ValueError('immutable backend source changed')
            records[relative] = hashlib.sha256(actual).hexdigest()
    return {'backend_sha': SHA, 'archive_sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
            'critical_sources': records}


def validate_pg_directory(root, required=False):
    path = root / 'pg'
    try:
        metadata = path.lstat()  # Never follow a redirected cluster directory.
    except FileNotFoundError:
        if required:
            raise ValueError('owned PostgreSQL cluster missing')
        return
    if (not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != os.getuid() or
            metadata.st_mode & 0o077 or path.resolve(strict=True) != path):
        raise ValueError('private canonical owned PostgreSQL directory required')
    if required:
        version = path / 'PG_VERSION'
        try:
            info = version.lstat()
        except FileNotFoundError:
            raise ValueError('owned PostgreSQL cluster not initialized') from None
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
            raise ValueError('owned PostgreSQL version marker required')


def validate_root(root):
    if root.is_symlink() or root.resolve(strict=True) != root or not root.is_dir() or root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise ValueError('private owned root required')
    manifest = json.loads((root / MARKER).read_text())
    if manifest.get('root') != str(root) or manifest.get('backend_sha') != SHA:
        raise ValueError('owned root manifest mismatch')
    for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence'):
        path = root / name
        if not path.is_dir() or path.is_symlink() or path.resolve().parent != root or path.stat().st_uid != os.getuid():
            raise ValueError('owned directory binding mismatch')
    validate_pg_directory(root)  # Absence allowed only until explicit initialization.
    actual = verify_archive(root)
    if actual != {key: manifest[key] for key in actual}:
        raise ValueError('pinned source verification mismatch')
    return manifest


def adopt(root):
    if (root / MARKER).exists():
        validate_root(root)
        return
    if root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise ValueError('private owned root required')
    manifest = {'root': str(root), **verify_archive(root)}
    marker = root / MARKER
    with marker.open('x') as output:
        json.dump(manifest, output, indent=2)
    os.chmod(marker, 0o600)
    validate_root(root)


def verify_database_facts(root, pg_port, facts):
    if (Path(facts['dir']).resolve() != root / 'pg' or
            Path(facts['socket']).resolve() != root / 'socket' or
            str(facts['port']) != str(pg_port) or facts['listen'] != ''):
        raise ValueError('owned database binding mismatch')


def create_database(args, root, env):
    validate_pg_directory(root, required=True)
    # Never use localhost/default server: only this root's already-running socket.
    command = [PG_BIN + '/psql', '-X', '-A', '-t', '-h', str(root / 'socket'), '-p', str(args.pg_port),
               '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
               "SELECT json_build_object('dir',current_setting('data_directory'),'socket',current_setting('unix_socket_directories'),'port',current_setting('port'),'listen',current_setting('listen_addresses'))"]
    facts = json.loads(subprocess.check_output(command, cwd=root, env=env, timeout=10, text=True))
    verify_database_facts(root, args.pg_port, facts)
    run([PG_BIN + '/createdb', '-h', str(root / 'socket'), '-p', str(args.pg_port), '-U', 'postgres', args.database], cwd=root, env=env, timeout=30)


def run(command, *, cwd, env, timeout=600):
    subprocess.run(command, cwd=cwd, env=env, timeout=timeout, check=True)


def ensure_ruby(root, env):
    version = subprocess.check_output([RUBY, '--version'], cwd=root, env=env, timeout=10, text=True)
    if not version.startswith('ruby 3.3.13 '):
        raise ValueError('exact Ruby 3.3.13 required')


def prepare(args, root):
    if not args.download or root.exists():
        raise ValueError('prepare requires --download and a nonexistent dedicated root')
    root.mkdir(mode=0o700, parents=False)
    for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence'):
        (root / name).mkdir(mode=0o700)
    # gh alone performs GitHub operations; authentication remains with gh, not logs.
    with (root / 'backend.tar.gz').open('xb') as output:
        subprocess.run(['gh', 'api', f'repos/mattash/Tarkman/tarball/{SHA}'], stdout=output, check=True, timeout=120)
    with tarfile.open(root / 'backend.tar.gz') as archive:
        members = archive.getmembers()
        prefix = members[0].name.split('/')[0] + '/'
        if prefix.rstrip('/') not in ('mattash-Tarkman-' + SHA, 'mattash-Tarkman-' + SHA[:7]):
            raise ValueError('wrong archive revision')
        for member in members:
            if member.name.rstrip('/') == prefix.rstrip('/'):
                continue
            if not member.name.startswith(prefix):
                raise ValueError('archive path outside prefix')
            member.name = member.name[len(prefix):]
            archive.extract(member, root / 'src', filter='data')
    adopt(root)
    env = clean_environment(root, args.database, args.pg_port)
    ensure_ruby(root, env)
    if args.install_dependencies:
        run([str(Path(RUBY).with_name('gem')), 'install', 'bundler', '-v', '2.5.9', '--no-document'], cwd=root, env=env)
        bundle = str(root / 'gems/bin/bundle')
        run([bundle, '_2.5.9_', 'lock', '--add-platform', 'arm64-darwin'], cwd=root / 'src', env=env)
        env['BUNDLE_BUILD__PG'] = '--with-pg-config=/opt/homebrew/bin/pg_config'
        run([bundle, '_2.5.9_', 'install', '--jobs', '4', '--retry', '1'], cwd=root / 'src', env=env, timeout=1200)
    if args.init_cluster:
        validate_pg_directory(root)
        run([PG_BIN + '/initdb', '-D', str(root / 'pg'), '-U', 'postgres', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--encoding=UTF8'], cwd=root, env=env)


def serve(args, root):
    global STAGE
    STAGE = 'owned_root_verification'
    validate_root(root)
    validate_pg_directory(root, required=True)
    env = clean_environment(root, args.database, args.pg_port)
    STAGE = 'ruby_version_verification'
    ensure_ruby(root, env)
    validate_pg_directory(root, required=True)
    if args.action == 'serve':
        STAGE = 'http_bind_preflight'
        with socket.socket() as test:
            test.bind(('127.0.0.1', args.http_port))
    STAGE = 'runtime_lock_and_configuration'
    lock_path = root / f'.runtime-{args.database}.lock'
    with lock_path.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config_path = root / f'.runtime-{args.database}.json'
        config = {'root': str(root), 'backend_sha': SHA, 'enabled': True, 'mode': args.action,
                  'database': args.database, 'pg_port': args.pg_port, 'http_port': args.http_port,
                  'ttl': args.ttl, 'max_reads': args.max_reads}
        config_path.write_text(json.dumps(config))
        os.chmod(config_path, 0o600)  # Contains only nonsecret bindings, never key bytes.
        STAGE = 'runtime_process_launch'
        child = subprocess.Popen([RUBY, str(HERE / 'server.rb'), str(config_path)], cwd=root / 'src', env=env)
        STAGE = 'runtime_process_wait'
        previous = {}
        def forward(signum, _frame):
            if child.poll() is None:
                child.send_signal(signum)
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous[signum] = signal.signal(signum, forward)
        try:
            code = child.wait(timeout=args.ttl + 30)
            if code:
                raise RuntimeError('owned runtime failed; inspect redacted scoped log')
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
            for signum, handler in previous.items():
                signal.signal(signum, handler)


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('action', choices=('prepare', 'adopt', 'serve', 'schema', 'postgres', 'create-db', 'test', 'verify'))
    result.add_argument('--enabled', action='store_true', help='Required explicit opt-in; default does nothing')
    result.add_argument('--root', required=True)
    result.add_argument('--database', default='sp277_native')
    result.add_argument('--pg-port', type=int, default=55477)
    result.add_argument('--http-port', type=int, default=18777)
    result.add_argument('--ttl', type=int, default=1200)
    result.add_argument('--max-reads', type=int, default=1000)
    result.add_argument('--download', action='store_true')
    result.add_argument('--install-dependencies', action='store_true')
    result.add_argument('--init-cluster', action='store_true')
    result.add_argument('--negative-control', action='store_true')
    return result


def main(argv=None):
    global STAGE
    STAGE = 'arguments'
    args = parser().parse_args(argv)
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    STAGE = 'argument_validation'
    root = root_path(args.root)
    args.database = database_name(args.database)
    args.pg_port = port_number(args.pg_port)
    args.http_port = port_number(args.http_port)
    if args.pg_port == args.http_port or not 1 <= args.ttl <= 1800 or not 1 <= args.max_reads <= 1000:
        raise ValueError('bounded distinct ports/TTL/read count required')
    if args.action != 'prepare' and (args.download or args.install_dependencies or args.init_cluster):
        raise ValueError('setup flags permitted only with prepare')
    STAGE = args.action  # argparse choices are fixed, never caller-provided text.
    if args.action == 'prepare':
        prepare(args, root)
    elif args.action == 'adopt':
        adopt(root)
    elif args.action in ('serve', 'schema'):
        serve(args, root)
    else:
        validate_root(root)
        if args.action in ('postgres', 'create-db', 'test'):
            validate_pg_directory(root, required=True)
        env = clean_environment(root, args.database, args.pg_port, 'test' if args.action == 'test' else 'development')
        if args.action == 'postgres':
            validate_pg_directory(root, required=True)
            os.execve(PG_BIN + '/postgres', [PG_BIN + '/postgres', '-D', str(root / 'pg'), '-k', str(root / 'socket'), '-p', str(args.pg_port), '-c', 'listen_addresses=', '-c', 'max_connections=20', '-c', 'shared_buffers=32MB'], env)
        elif args.action == 'create-db':
            create_database(args, root, env)
        elif args.action == 'test':
            if not args.database.endswith('_test'):
                raise ValueError('separate dedicated _test database required')
            ensure_ruby(root, env)
            env['SERVICE_PROGRESS_FENCE_NEGATIVE_CONTROL'] = '1' if args.negative_control else '0'
            # Schema tasks can dirty Rails' first-request reload state. Keep them
            # out of the Ruby process retaining RSpec class/module references.
            command = [RUBY, str(HERE / 'specs.rb'), str(root), args.database, str(args.pg_port)]
            run(command + ['prepare'], cwd=root / 'src', env=env, timeout=60)
            run(command + ['negative' if args.negative_control else 'ordinary'], cwd=root / 'src', env=env, timeout=120)
        else:
            print(json.dumps({'status': 'verified', 'backend_sha': SHA, 'root': str(root)}))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, tarfile.TarError) as error:
        # Fixed error class only; no environment, credentials, request or arbitrary exception dump.
        print(json.dumps(failure_record(error)), file=sys.stderr)
        sys.exit(1)

"""No downloads, Rails, PostgreSQL connections or server launches."""
import contextlib
import errno
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('owned_backend_runner', HERE / 'runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class GuardTests(unittest.TestCase):
    def test_real_test_entrypoint_separates_schema_and_example_processes(self):
        proof = {'backend_sha': runner.SHA, 'archive_sha256': 'synthetic', 'critical_sources': {}}
        for negative in (False, True):
            with self.subTest(negative=negative), tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
                root = Path(directory).resolve()
                for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence', 'pg'):
                    (root / name).mkdir(mode=0o700)
                (root / 'pg/PG_VERSION').write_text('16')
                (root / runner.MARKER).write_text(json.dumps({'root': str(root), **proof}))
                with patch.object(runner, 'verify_archive', return_value=proof), patch.object(runner.subprocess, 'check_output', return_value='ruby 3.3.13 synthetic'), patch.object(runner, 'run') as run:
                    arguments = ['test', '--enabled', '--root', str(root), '--database', 'sp277_guard_test']
                    if negative:
                        arguments.append('--negative-control')
                    self.assertEqual(runner.main(arguments), 0)
                    self.assertEqual(run.call_count, 2)
                    self.assertEqual(run.call_args_list[0].args[0][-1], 'prepare')
                    self.assertEqual(run.call_args_list[1].args[0][-1], 'negative' if negative else 'ordinary')
                    self.assertEqual(run.call_args_list[0].kwargs['env']['RAILS_ENV'], 'test')
                    self.assertTrue(all('/sp277_guard_test?' in call.kwargs['env']['DATABASE_URL'] for call in run.call_args_list))
        source = (HERE / 'specs.rb').read_text()
        self.assertLess(source.index("if mode == 'prepare'"), source.index("require 'rspec/core'"))
        self.assertIn('ActiveRecord::Base.connection_pool.disconnect!', source)
        self.assertIn("raise 'test schema must be prepared in a separate process' if connection.tables.empty?", source)

    def test_real_main_rejects_redirected_or_nonprivate_pg_before_any_resource(self):
        proof = {'backend_sha': runner.SHA, 'archive_sha256': 'synthetic', 'critical_sources': {}}
        for kind in ('symlink', 'nonprivate', 'missing', 'marker_symlink'):
            for action in ('postgres', 'serve', 'schema', 'test', 'create-db'):
                with self.subTest(kind=kind, action=action), tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
                    base = Path(directory).resolve()
                    root = base / 'sp277-owned'
                    root.mkdir(mode=0o700)
                    for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence'):
                        (root / name).mkdir(mode=0o700)
                    (root / runner.MARKER).write_text(json.dumps({'root': str(root), **proof}))
                    outside = base / 'outside-pg'
                    outside.mkdir(mode=0o700)
                    (outside / 'PG_VERSION').write_text('16')
                    if kind == 'symlink':
                        (root / 'pg').symlink_to(outside, target_is_directory=True)
                    elif kind == 'nonprivate':
                        (root / 'pg').mkdir(mode=0o755)
                        (root / 'pg').chmod(0o755)
                        (root / 'pg/PG_VERSION').write_text('16')
                    elif kind == 'marker_symlink':
                        (root / 'pg').mkdir(mode=0o700)
                        (root / 'pg/PG_VERSION').symlink_to(outside / 'PG_VERSION')
                    resources = ('Popen', 'check_output', 'run')
                    with contextlib.ExitStack() as stack:
                        stack.enter_context(patch.object(runner, 'verify_archive', return_value=proof))
                        blocked = [stack.enter_context(patch.object(runner.subprocess, name, side_effect=AssertionError('resource operation reached'))) for name in resources]
                        blocked.append(stack.enter_context(patch.object(runner.os, 'execve', side_effect=AssertionError('resource operation reached'))))
                        blocked.append(stack.enter_context(patch.object(runner, 'create_database', side_effect=AssertionError('resource operation reached'))))
                        blocked.append(stack.enter_context(patch.object(runner.socket, 'socket', side_effect=AssertionError('resource operation reached'))))
                        with self.assertRaises(ValueError):
                            runner.main([action, '--enabled', '--root', str(root), '--database', 'sp277_guard_test'])
                        for operation in blocked:
                            operation.assert_not_called()

    def test_prepare_adoption_legitimately_allows_absent_pg(self):
        proof = {'backend_sha': runner.SHA, 'archive_sha256': 'synthetic', 'critical_sources': {}}
        with tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
            root = Path(directory).resolve()
            for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence'):
                (root / name).mkdir(mode=0o700)
            with patch.object(runner, 'verify_archive', return_value=proof):
                self.assertEqual(runner.main(['adopt', '--enabled', '--root', str(root)]), 0)
                runner.validate_root(root)
                self.assertFalse((root / 'pg').exists())
                with self.assertRaises(ValueError):
                    runner.validate_pg_directory(root, required=True)
                (root / 'pg').mkdir(mode=0o700)
                (root / 'pg/PG_VERSION').write_text('16')
                runner.validate_pg_directory(root, required=True)
                with patch.object(runner.os, 'getuid', return_value=os.getuid() + 1), self.assertRaises(ValueError):
                    runner.validate_pg_directory(root, required=True)

    def test_ruby_pre_rails_pg_defense_rejects_real_filesystem_redirects(self):
        ruby = shutil.which('ruby')
        if not ruby:
            self.skipTest('Ruby unavailable; no installation attempted')
        for filename in ('server.rb', 'specs.rb'):
            source = (HERE / filename).read_text()
            start = source.index('def validate_owned_pg!')
            guard = source[start:source.index('\nend\n', start) + 5]
            self.assertLess(source.index('validate_owned_pg!(root) # Before Rails'), source.index("require File.join(root, 'src/config/environment')"))
            for kind, expected in (('valid', True), ('symlink', False), ('nonprivate', False), ('foreign_uid', False)):
                with self.subTest(filename=filename, kind=kind), tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
                    base = Path(directory).resolve()
                    root = base / 'sp277-owned'
                    root.mkdir(mode=0o700)
                    (root / 'socket').mkdir(mode=0o700)
                    outside = base / 'outside-pg'
                    outside.mkdir(mode=0o700)
                    (outside / 'PG_VERSION').write_text('16')
                    if kind == 'symlink':
                        (root / 'pg').symlink_to(outside, target_is_directory=True)
                    else:
                        (root / 'pg').mkdir(mode=0o700)
                        (root / 'pg/PG_VERSION').write_text('16')
                        if kind == 'nonprivate':
                            (root / 'pg').chmod(0o755)
                    uid_override = 'module Process; def self.uid; -1; end; end;' if kind == 'foreign_uid' else ''
                    script = guard + '\n' + uid_override + "begin; validate_owned_pg!(ARGV.fetch(0)); puts 'true'; rescue StandardError; puts 'false'; end"
                    result = subprocess.run([ruby, '-e', script, str(root)], text=True, capture_output=True, check=True, timeout=10)
                    self.assertEqual(json.loads(result.stdout), expected)

    def test_bodyless_delete_probe_omits_framing_headers_and_closes(self):
        probe_spec = importlib.util.spec_from_file_location('fixture_probe_delete', HERE / 'probe.py')
        probe = importlib.util.module_from_spec(probe_spec)
        probe_spec.loader.exec_module(probe)
        connection = Mock()
        response = connection.getresponse.return_value
        with patch.object(probe.http.client, 'HTTPConnection', return_value=connection):
            with probe.bodyless_delete(18777, '/synthetic-path', {'X-Service-Activity-Secret': 'synthetic'}) as received:
                self.assertIs(received, response)
        connection.putrequest.assert_called_once_with('DELETE', '/synthetic-path', skip_accept_encoding=True)
        self.assertEqual(connection.putheader.call_args_list[0].args, ('X-Service-Activity-Secret', 'synthetic'))
        self.assertEqual(connection.putheader.call_count, 1)
        connection.endheaders.assert_called_once_with()
        response.close.assert_called_once_with()
        connection.close.assert_called_once_with()
        connection = Mock()
        connection.getresponse.side_effect = OSError('synthetic transport failure')
        with patch.object(probe.http.client, 'HTTPConnection', return_value=connection), self.assertRaises(OSError):
            with probe.bodyless_delete(18777, '/synthetic-path', {}):
                self.fail('no response expected')
        connection.close.assert_called_once_with()

    def test_ruby_body_read_normalizes_eof_but_preserves_bounds(self):
        ruby = shutil.which('ruby')
        if not ruby:
            self.skipTest('Ruby unavailable; no installation attempted')
        source = (HERE / 'server.rb').read_text()
        expression = next(line.strip() for line in source.splitlines() if line.strip().startswith("body = env.fetch('rack.input')"))
        script = "require 'json'; class Input; def initialize(value); @value=value; end; def read(limit); raise unless limit==4097; @value; end; end; puts JSON.generate(JSON.parse(STDIN.read).map do |value|; env={'rack.input'=>Input.new(value)}; " + expression + "; [body.bytesize,body.empty?,body.bytesize>4096]; end)"
        result = subprocess.run([ruby, '-e', script], input=json.dumps([None, '', 'x', 'x' * 4097]), text=True, capture_output=True, check=True, timeout=10)
        self.assertEqual(json.loads(result.stdout), [[0, True, False], [0, True, False], [1, False, False], [4097, False, True]])
        self.assertIn("next reject.call(422, 'fixture_delete_body') unless body.empty?", source)

    def test_failure_diagnostic_preserves_stage_errno_not_arbitrary_text(self):
        with patch.object(runner, 'STAGE', 'http_bind_preflight'):
            record = runner.failure_record(OSError(errno.EADDRINUSE, 'private arbitrary text'))
        self.assertEqual(record, {'status': 'failed', 'error_class': 'OSError', 'stage': 'http_bind_preflight', 'errno': errno.EADDRINUSE})
        self.assertNotIn('private', json.dumps(record))
        self.assertIsNone(runner.failure_record(ValueError('private'))['errno'])
        source = (HERE / 'runner.py').read_text()
        self.assertNotIn('SO_REUSEADDR', source)
        self.assertNotIn('SO_REUSEPORT', source)

    def test_probe_default_off_and_origin_guard(self):
        probe_spec = importlib.util.spec_from_file_location('fixture_probe', HERE / 'probe.py')
        probe = importlib.util.module_from_spec(probe_spec)
        probe_spec.loader.exec_module(probe)
        with patch.object(probe.urllib.request, 'build_opener', side_effect=AssertionError('no network')), contextlib.redirect_stdout(io.StringIO()):
            probe.main(['--origin', 'https://untrusted.invalid', '--output', '/not-created'])
            for origin in ('https://api.tarkman.app', 'http://localhost:18777', 'http://127.0.0.1:80', 'http://127.0.0.1:18777/extra'):
                with self.subTest(origin=origin), self.assertRaises(ValueError):
                    probe.main(['--enabled', '--origin', origin, '--output', '/not-created'])
        self.assertNotIn('assert ', (HERE / 'probe.py').read_text())

    def test_default_off_has_no_side_effects(self):
        with patch.object(runner, 'root_path', side_effect=AssertionError('must not inspect')), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(runner.main(['serve', '--root', '/not-owned']), 0)
        self.assertEqual(json.loads(output.getvalue()), {'status': 'disabled'})

    def test_rejects_unsafe_root_and_database(self):
        for value in ('/', '/tmp', '.', 'relative/sp277-test', '/tmp/ordinary'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                runner.root_path(value)
        for value in ('production', 'Tarkman_development', 'sp277_a/../../production', 'sp277_A'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                runner.database_name(value)

    def test_rejects_symlink_root(self):
        with tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
            path = Path(directory) / 'sp277-link'
            path.symlink_to(Path(directory), target_is_directory=True)
            with self.assertRaises(ValueError):
                runner.root_path(str(path))

    def test_environment_is_allowlisted_not_inherited(self):
        root = Path('/private/tmp/sp277-guard')
        with patch.dict(os.environ, {'DATABASE_URL': 'forbidden', 'SERVICE_PROGRESS_ENCRYPTION_KEY': 'forbidden', 'RAILS_MASTER_KEY': 'forbidden', 'AWS_SECRET_ACCESS_KEY': 'forbidden', 'SENTRY_DSN': 'forbidden'}):
            env = runner.clean_environment(root, 'sp277_native', 55477)
        parsed = urlsplit(env['DATABASE_URL'])
        self.assertEqual(parsed.path, '/sp277_native')
        self.assertEqual(parse_qs(parsed.query), {'host': ['/private/tmp/sp277-guard/socket'], 'port': ['55477']})
        self.assertNotIn('forbidden', env.values())
        self.assertNotIn('RAILS_MASTER_KEY', env)
        self.assertNotIn('SERVICE_PROGRESS_ENCRYPTION_KEY', env)
        self.assertEqual(env['HOME'], str(root / 'home'))

    def test_socket_url_encodes_parent_path_special_characters(self):
        root = Path('/private/tmp/parent &host=unowned?fragment# percent%/sp277-guard')
        url = runner.clean_environment(root, 'sp277_native', 55477)['DATABASE_URL']
        parsed = urlsplit(url)
        self.assertEqual(parsed.hostname, 'localhost')
        self.assertEqual(parsed.fragment, '')
        self.assertEqual(parse_qs(parsed.query), {'host': [str(root / 'socket')], 'port': ['55477']})
        self.assertNotIn(' ', url)

    def test_bounds_reject_before_resource_operations(self):
        for extra in (['--ttl', '1801'], ['--max-reads', '1001'], ['--pg-port', '543'], ['--http-port', '55477'], ['--database', 'production']):
            with self.subTest(extra=extra), patch.object(runner, 'serve', side_effect=AssertionError('must not launch')), self.assertRaises(ValueError):
                runner.main(['serve', '--enabled', '--root', '/tmp/sp277-guard'] + extra)

    def test_setup_flags_cannot_leak_into_serve(self):
        with self.assertRaises(ValueError):
            runner.main(['serve', '--enabled', '--root', '/tmp/sp277-guard', '--install-dependencies'])

    def test_database_binding_guard(self):
        root = Path(tempfile.gettempdir()).resolve() / 'sp277-guard'
        facts = {'dir': str(root / 'pg'), 'socket': str(root / 'socket'), 'port': '55477', 'listen': ''}
        runner.verify_database_facts(root, 55477, facts)
        for key, value in (('dir', '/unowned'), ('socket', '/tmp'), ('port', '5432'), ('listen', 'localhost')):
            with self.subTest(key=key), self.assertRaises(ValueError):
                runner.verify_database_facts(root, 55477, {**facts, key: value})

    def test_manifest_source_and_private_directory_guards(self):
        with tempfile.TemporaryDirectory(prefix='sp277-guard-') as directory:
            root = Path(directory).resolve()
            for name in ('src', 'home', 'tmp', 'gems', 'bundle', 'socket', 'evidence'):
                (root / name).mkdir(mode=0o700)
            with tarfile.open(root / 'backend.tar.gz', 'w:gz') as archive:
                prefix = 'mattash-Tarkman-' + runner.SHA
                for relative in runner.CRITICAL:
                    path = root / 'src' / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(b'public synthetic source')
                    archive.add(path, arcname=prefix + '/' + relative, recursive=False)
            digest = hashlib.sha256((root / 'backend.tar.gz').read_bytes()).hexdigest()
            with patch.object(runner, 'ARCHIVE_SHA256', digest):
                runner.adopt(root)
                runner.validate_root(root)
                (root / 'src' / runner.CRITICAL[0]).write_bytes(b'changed')
                with self.assertRaises(ValueError):
                    runner.validate_root(root)
            with self.assertRaises(ValueError):
                runner.verify_archive(root)  # Real pinned archive digest is mandatory.

    def test_listing_query_and_synthetic_today_guards(self):
        ruby = shutil.which('ruby')
        if not ruby:
            self.skipTest('Ruby unavailable; no installation attempted')
        source = (HERE / 'server.rb').read_text()
        expression = next(line.strip() for line in source.splitlines() if line.strip().startswith('listing_query_valid ='))
        cases = [('tz=America%2FLos_Angeles', True), ('tz=America/Los_Angeles', True), ('', False),
                 ('tz=UTC', False), ('tz=America%2FLos_Angeles&user_id=1', False),
                 ('tz=America%2FLos_Angeles&tz=America%2FLos_Angeles', False), ('bad=%GG', False)]
        script = "require 'json'; require 'uri'; path='/services.json'; cases=JSON.parse(STDIN.read); puts JSON.generate(cases.map do |query, expected|; " + expression + "; [listing_query_valid,expected]; end)"
        result = subprocess.run([ruby, '-e', script], input=json.dumps(cases), text=True, capture_output=True, check=True, timeout=10)
        self.assertTrue(all(actual == expected for actual, expected in json.loads(result.stdout)))
        self.assertIn("fixture_date = Time.current.in_time_zone(fixture_zone).to_date", source)
        self.assertIn("fixture_zone = 'America/Los_Angeles'", source)
        self.assertIn("session.update!(date: fixture_date) if session.date != fixture_date", source)
        self.assertIn("unless Session.count == 1 && Session.exists?(42)", source)
        self.assertLess(source.index("raise 'unresolved prior registration"), source.index('fixture_date ='))

    def test_actual_ruby_route_expression_rejects_broadening(self):
        ruby = shutil.which('ruby')
        if not ruby:
            self.skipTest('Ruby unavailable; no installation attempted')
        source = (HERE / 'server.rb').read_text()
        start = source.index('    public_read =')
        end = source.index('    next reject.call', start)
        expression = source[start:end]
        cases = [('GET', '/services.json', True), ('POST', '/services.json', False), ('GET', '/services/42', False), ('GET', '/services.json/extra', False), ('GET', '/services', False), ('GET', '/s/42.json', True), ('GET', '/s/42/state.json', True), ('GET', '/s/42/parts.json', True),
                 ('GET', '/s/42/parts/1.json', True), ('GET', '/s/42/parts/999.json', False),
                 ('GET', '/s/43.json', False), ('POST', '/s/42/next', False), ('GET', '/users/sign_in', False),
                 ('GET', '/admin', False), ('GET', '/s/42/parts.json/extra', False), ('GET', '/s/42.json%3fq=1', False)]
        identifier = 'e54ad734-cbb0-417f-ae4d-696cb1dd1439'
        base = '/public/service_activity_registrations/' + identifier
        cases += [('PUT', base, True), ('DELETE', base, True), ('POST', base + '/revoke', True),
                  ('GET', base, False), ('POST', base, False), ('PUT', base + '/revoke', False),
                  ('DELETE', base + '/revoke', False), ('PUT', base + '/extra', False)]
        script = "require 'json'; require 'set'; part_ids = Set['1','2','3']; cases = JSON.parse(STDIN.read); out = cases.map do |method,path,expected|\n" + expression + "\n[!!(public_read || mutation),expected]\nend; puts JSON.generate(out)"
        result = subprocess.run([ruby, '-e', script], input=json.dumps(cases), text=True, capture_output=True, check=True, timeout=10)
        self.assertTrue(all(actual == expected for actual, expected in json.loads(result.stdout)))
        self.assertIn("result[1]['date'] = Time.now.utc.httpdate", source)
        self.assertIn('known_ids.size >= 20', source)
        self.assertIn('mutations > 100', source)
        self.assertIn('no_network: true', source)
        self.assertNotIn('http2: nil', source)


if __name__ == '__main__':
    unittest.main()

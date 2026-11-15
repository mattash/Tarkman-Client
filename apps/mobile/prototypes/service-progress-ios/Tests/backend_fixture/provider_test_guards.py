#!/usr/bin/env python3
"""Offline: no network, DB, subprocess or source-cache inspection."""
import contextlib
import io
import os
from unittest import TestCase, main, mock
import provider_runner


class Guards(TestCase):
    def invoke(self, *arguments):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            code = provider_runner.main(list(arguments))
        return code, output.getvalue()

    def test_default_off_does_not_inspect_or_spawn(self):
        with mock.patch.object(provider_runner.runner, 'validate_root', side_effect=AssertionError), \
             mock.patch.object(provider_runner.os, 'fstat', side_effect=AssertionError), \
             mock.patch.object(provider_runner.subprocess, 'Popen', side_effect=AssertionError):
            code, output = self.invoke('--root', '/not/inspected', '--database', 'not_inspected')
        self.assertEqual(code, 0)
        self.assertIn('disabled', output)

    def test_every_gate_and_bounds_fail_before_resources(self):
        base = ['--enabled', '--root', '/not/inspected', '--database', 'not_inspected']
        full = base + ['--authorize-provider', '--authorize-transport', '--synthetic-transport',
                       '--registration-id', '11111111-1111-1111-1111-111111111111', '--input-fd', '3']
        cases = [base, base + ['--authorize-provider'], base + ['--authorize-transport'],
                 full + ['--rounds', '2', '--max-requests', '1'],
                 full + ['--deadline-seconds', '31'], full + ['--max-requests', '21'],
                 full + ['--registration-id', '11111111-1111-1111-1111-111111111111'],
                 full + ['--input-fd', '0'],
                 [v if v != '--synthetic-transport' else '--real-transport' for v in full] +
                 ['--synthetic-scenario', 'expired-registration']]
        with mock.patch.object(provider_runner.runner, 'validate_root', side_effect=AssertionError), \
             mock.patch.object(provider_runner.os, 'fstat', side_effect=AssertionError), \
             mock.patch.object(provider_runner.subprocess, 'Popen', side_effect=AssertionError):
            for arguments in cases:
                with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                    self.invoke(*arguments)

    def test_regular_file_input_is_rejected_before_root(self):
        with open(__file__, 'rb') as handle, \
             mock.patch.object(provider_runner.runner, 'validate_root', side_effect=AssertionError):
            with self.assertRaises(ValueError):
                self.invoke('--enabled', '--authorize-provider', '--authorize-transport', '--real-transport',
                            '--root', '/not/inspected', '--database', 'not_inspected',
                            '--registration-id', '11111111-1111-1111-1111-111111111111',
                            '--input-fd', str(handle.fileno()))


if __name__ == '__main__':
    main()

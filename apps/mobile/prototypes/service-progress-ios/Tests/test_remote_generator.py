"""Metadata-only generator checks: isolated copies, synthetic origins, no builds/I/O."""

import contextlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile
import unittest


GENERATOR = Path(__file__).resolve().parents[1] / "generate.rb"
INPUT_KEYS = (
    "SERVICE_PROGRESS_REMOTE_EXPERIMENT",
    "SERVICE_PROGRESS_DEVELOPMENT_ORIGIN",
    "SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN",
)
SYNTHETIC = {
    "SERVICE_PROGRESS_REMOTE_EXPERIMENT": "1",
    "SERVICE_PROGRESS_DEVELOPMENT_ORIGIN": "https://api.example.invalid",
    "SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN": "https://reader.example.invalid",
}
PROJECT_NAME = "ServiceProgressPrototype.xcodeproj"
PLIST_NAME = "ServiceProgressPrototype.generated.plist"
# Inspect the emitted project through xcodeproj, not textual source assertions.
PROJECT_INSPECTOR = """
require 'xcodeproj'
require 'json'
project = Xcodeproj::Project.open(ARGV.fetch(0))
puts JSON.generate(project.targets.to_h { |target|
  [target.name, target.build_configurations.to_h { |config|
    [config.name, config.build_settings.to_h]
  }]
})
"""


class RemoteGeneratorTests(unittest.TestCase):
    @contextlib.contextmanager
    def generated(self, inputs):
        # Keep GEM_HOME and the rest of the invoking Ruby environment, while
        # removing every activation input so the host cannot affect the tests.
        env = os.environ.copy()
        for key in INPUT_KEYS:
            env.pop(key, None)
        env.update(inputs)
        ruby = env.get("RUBY", "ruby")
        with tempfile.TemporaryDirectory(prefix="service-remote-generator-test-") as temporary:
            root = Path(temporary).resolve()
            # Verify the uniquely owned cleanup target before the context may
            # remove it. No worktree sources, generated project or plist copied.
            self.assertEqual(root.parent, Path(tempfile.gettempdir()).resolve())
            self.assertTrue(root.name.startswith("service-remote-generator-test-"))
            self.assertNotEqual(root, GENERATOR.parent)
            shutil.copyfile(GENERATOR, root / "generate.rb")
            result = subprocess.run(
                [ruby, str(root / "generate.rb")], cwd=root, env=env,
                capture_output=True, text=True, timeout=30, check=False,
            )
            yield root, result, ruby, env

    def inspect_project(self, root, ruby, env):
        result = subprocess.run(
            [ruby, "-e", PROJECT_INSPECTOR, str(root / PROJECT_NAME)],
            cwd=root, env=env, capture_output=True, text=True,
            timeout=30, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        targets = json.loads(result.stdout)
        self.assertEqual(set(targets), {
            "ServiceProgressPrototype", "ServiceProgressLiveActivity", "ServiceProgressUITests",
        })
        return targets

    def test_default_inputs_are_disabled_without_origins_or_entitlements(self):
        with self.generated({}) as (root, result, ruby, env):
            self.assertEqual(result.returncode, 0, result.stderr)
            with (root / PLIST_NAME).open("rb") as file:
                info = plistlib.load(file)
            self.assertIs(info["ServiceProgressRemoteEnabled"], False)
            self.assertEqual(info, {"ServiceProgressRemoteEnabled": False})
            targets = self.inspect_project(root, ruby, env)
            for target, configurations in targets.items():
                self.assertTrue(configurations, target)
                for settings in configurations.values():
                    self.assertNotIn("CODE_SIGN_ENTITLEMENTS", settings)
                    self.assertEqual(settings["CODE_SIGNING_ALLOWED"], "NO")
            for settings in targets["ServiceProgressPrototype"].values():
                self.assertEqual(settings["INFOPLIST_FILE"], PLIST_NAME)

    def test_explicit_synthetic_opt_in_has_typed_plist_and_app_only_entitlements(self):
        with self.generated(SYNTHETIC) as (root, result, ruby, env):
            self.assertEqual(result.returncode, 0, result.stderr)
            with (root / PLIST_NAME).open("rb") as file:
                info = plistlib.load(file)
            self.assertIs(info["ServiceProgressRemoteEnabled"], True)
            self.assertEqual(info, {
                "ServiceProgressRemoteEnabled": True,
                "ServiceProgressDevelopmentOrigin": "https://api.example.invalid",
                "ServiceProgressDevelopmentReaderOrigin": "https://reader.example.invalid",
            })
            targets = self.inspect_project(root, ruby, env)
            for target, configurations in targets.items():
                self.assertTrue(configurations, target)
                for settings in configurations.values():
                    self.assertEqual(settings["CODE_SIGNING_ALLOWED"], "NO")
                    if target == "ServiceProgressPrototype":
                        self.assertEqual(settings["CODE_SIGN_ENTITLEMENTS"], "App/RemoteExperiment.entitlements")
                        self.assertEqual(settings["INFOPLIST_FILE"], PLIST_NAME)
                    else:
                        self.assertNotIn("CODE_SIGN_ENTITLEMENTS", settings)

    def assert_rejected(self, inputs):
        with self.generated(inputs) as (root, result, _ruby, _env):
            self.assertNotEqual(result.returncode, 0, result.stdout)
            # Invalid inputs fail before any generated activation artifacts.
            self.assertFalse((root / PLIST_NAME).exists())
            self.assertFalse((root / PROJECT_NAME).exists())

    def test_unexpected_flag_is_rejected(self):
        self.assert_rejected({**SYNTHETIC, "SERVICE_PROGRESS_REMOTE_EXPERIMENT": "true"})

    def test_missing_backend_is_rejected(self):
        self.assert_rejected({key: value for key, value in SYNTHETIC.items()
                              if key != "SERVICE_PROGRESS_DEVELOPMENT_ORIGIN"})

    def test_missing_reader_is_rejected(self):
        self.assert_rejected({key: value for key, value in SYNTHETIC.items()
                              if key != "SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN"})


def invalid_origin_test(variable, origin):
    def test(self):
        self.assert_rejected({**SYNTHETIC, variable: origin})
    return test


# Each input is its own test, so the runner reports the complete rejection count.
for role, variable in (("backend", "SERVICE_PROGRESS_DEVELOPMENT_ORIGIN"),
                       ("reader", "SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN")):
    for case, origin in {
        "http": "http://example.invalid",
        "path": "https://example.invalid/path",
        "slash": "https://example.invalid/",
        "query": "https://example.invalid?token=synthetic",
        "userinfo": "https://synthetic@example.invalid",
        "fragment": "https://example.invalid#synthetic",
        "empty": "",
    }.items():
        setattr(RemoteGeneratorTests, f"test_reject_{role}_{case}", invalid_origin_test(variable, origin))


if __name__ == "__main__":
    unittest.main()

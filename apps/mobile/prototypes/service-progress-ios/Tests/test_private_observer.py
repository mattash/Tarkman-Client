import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "private_observer", Path(__file__).parents[1] / "prepare-private-observer.py")
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


class PrivateObserverTests(unittest.TestCase):
    def target(self):
        return {"UITargetAppPath": "__TESTROOT__/Debug-iphoneos/ServiceProgressPrototype.app",
                "PreferredScreenCaptureFormat": "screenRecording",
                "SystemAttachmentLifetime": "deleteOnSuccess",
                "UserAttachmentLifetime": "keepAlways"}

    def assert_private(self, target):
        self.assertEqual(target["PreferredScreenCaptureFormat"], "screenshots")
        self.assertEqual(target["SystemAttachmentLifetime"], "keepNever")
        self.assertEqual(target["UserAttachmentLifetime"], "keepNever")
        self.assertEqual(target["OnlyTestIdentifiers"],
                         ["PhysicalObservationTests/testSyntheticTerminatedObservation"])
        self.assertEqual(target["EnvironmentVariables"]["SERVICE_PROGRESS_PRIVATE_OBSERVER"], "metadata-only")

    def test_v1(self):
        document = {"__xctestrun_metadata__": {"FormatVersion": 1}, "ServiceProgressUITests": self.target()}
        self.assert_private(observer.prepare(document)["ServiceProgressUITests"])

    def test_v2_every_configuration(self):
        targets = [dict(self.target(), BlueprintName="ServiceProgressUITests") for _ in range(2)]
        document = {"__xctestrun_metadata__": {"FormatVersion": 2},
                    "TestConfigurations": [{"TestTargets": [target]} for target in targets]}
        observer.prepare(document)
        for target in targets:
            self.assert_private(target)

    def test_rejects_unexpected_target_app_and_format(self):
        for document in [
            {"__xctestrun_metadata__": {"FormatVersion": 1}, "ProductionTests": self.target()},
            {"__xctestrun_metadata__": {"FormatVersion": 1},
             "ServiceProgressUITests": {"UITargetAppPath": "/Production.app"}},
            {"__xctestrun_metadata__": {"FormatVersion": 3}},
            {"__xctestrun_metadata__": {"FormatVersion": 2}, "TestConfigurations": []},
        ]:
            with self.assertRaises(ValueError):
                observer.prepare(document)


if __name__ == "__main__":
    unittest.main()

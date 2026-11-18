#!/usr/bin/env python3
"""Prepare a private metadata-only xctestrun; never installs or operates a device."""
import argparse
import os
from pathlib import Path
import plistlib


def prepare(document):
    version = document.get("__xctestrun_metadata__", {}).get("FormatVersion")
    if version == 1:
        targets = [(key, value) for key, value in document.items()
                   if key != "__xctestrun_metadata__"]
    elif version == 2:
        targets = [(target.get("BlueprintName"), target)
                   for config in document.get("TestConfigurations", [])
                   for target in config.get("TestTargets", [])]
    else:
        raise ValueError("Unsupported xctestrun format")
    if not targets or any(name != "ServiceProgressUITests" for name, _ in targets):
        raise ValueError("Only the isolated ServiceProgressUITests target is permitted")
    for _, target in targets:
        if not target.get("UITargetAppPath", "").endswith("/ServiceProgressPrototype.app"):
            raise ValueError("Unexpected target app; refusing observer preparation")
        target["PreferredScreenCaptureFormat"] = "screenshots"
        target["SystemAttachmentLifetime"] = "keepNever"
        target["UserAttachmentLifetime"] = "keepNever"
        target["OnlyTestIdentifiers"] = ["PhysicalObservationTests/testSyntheticTerminatedObservation"]
        target["SkipTestIdentifiers"] = []
        target.setdefault("EnvironmentVariables", {})["SERVICE_PROGRESS_PRIVATE_OBSERVER"] = "metadata-only"
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    # __TESTROOT__ paths resolve relative to the manifest. Preserve that location.
    if args.input.resolve().parent != args.output.resolve().parent:
        parser.error("Output must be beside the input to preserve __TESTROOT__ paths")
    with args.input.open("rb") as source:
        result = prepare(plistlib.load(source))
    # Never overwrite a source/build configuration, and restrict this private copy.
    descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as destination:
        plistlib.dump(result, destination)
    print("Prepared metadata-only observer; raw results/logs must remain private and local.")


if __name__ == "__main__":
    main()

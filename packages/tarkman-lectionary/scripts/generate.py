#!/usr/bin/env python3
"""Offline exporter. Obtain the pinned archive separately; never import a local checkout."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile

COMMIT = "38302406bce0f0dd7c4e09d3e20ba762c15a7418"
ARCHIVE_SHA256 = "ca5922da837ea37c537c5786085be1530695470f96a6bd6d24bf48ca0aaf7304"
DATASET = f"armenian-lectionary-{COMMIT}-2026-2027-v1"
ROOT = Path(__file__).resolve().parents[1]


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data")
    parser.add_argument("--check", action="store_true", help="Compare complete regenerated payloads without writing")
    parser.add_argument("--consumer-results", type=Path, help="Additionally deep-compare public TypeScript lookup results")
    args = parser.parse_args()
    if hashlib.sha256(args.archive.read_bytes()).hexdigest() != ARCHIVE_SHA256:
        parser.error("Archive checksum does not match the pinned upstream source")
    consumer = json.loads(args.consumer_results.read_text()) if args.consumer_results else None
    consumer_keys = set()
    with tempfile.TemporaryDirectory() as temporary:
        # Extract only the runtime package, never raw oracle caches, dev scripts or links.
        with tarfile.open(args.archive, "r:gz") as archive:
            prefix = f"armenian-lectionary-{COMMIT}/"
            for member in archive.getmembers():
                relative = member.name.removeprefix(prefix)
                if not member.name.startswith(prefix) or not relative.startswith("armenian_lectionary/"):
                    continue
                if not member.isfile() or ".." in Path(relative).parts:
                    continue
                target = Path(temporary) / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
        # Upstream exposes environment overrides. They must not influence an export.
        for key in list(os.environ):
            if key.startswith("LECTIONARY_"):
                del os.environ[key]
        sys.path.insert(0, temporary)
        import armenian_lectionary as engine
        if engine.__version__ != "2.1.0" or set(engine.SUPPORTED_LANGUAGES) != {"en", "hy"}:
            raise ValueError("Unexpected upstream contract")
        manifest = {
            "schemaVersion": 1, "datasetId": DATASET, "exporterVersion": "1.0.0",
            "upstream": {"repository": "https://github.com/andylitalo/armenian-lectionary",
                         "commit": COMMIT, "version": engine.__version__, "archiveSha256": ARCHIVE_SHA256},
            "languages": ["en", "hy"], "coverage": {"from": "2026-01-01", "through": "2027-12-31"},
            "resultCount": 1460, "packs": [],
        }
        files = {}
        for year in (2026, 2027):
            for language in manifest["languages"]:
                days = {}
                date = dt.date(year, 1, 1)
                while date.year == year:
                    day = engine.compute_armenian_lectionary(date, language=language)
                    assert day["Date"] == date.isoformat() and day["Language"] == language
                    days[date.isoformat()] = day
                    if consumer is not None:
                        key = f"{date.isoformat()}/{language}"
                        consumer_keys.add(key)
                        # Python's bool == int is permissive; canonical JSON also verifies scalar types.
                        actual = consumer[key]
                        assert actual == day and json.dumps(actual, sort_keys=True) == json.dumps(day, sort_keys=True), key
                    date += dt.timedelta(days=1)
                payload = encoded({"schemaVersion": 1, "datasetId": DATASET, "year": year, "language": language, "days": days})
                filename = f"{year}-{language}.json"
                files[filename] = payload
                manifest["packs"].append({"year": year, "language": language, "file": filename,
                                          "days": len(days), "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})
        if consumer is not None:
            assert set(consumer) == consumer_keys, "Consumer has missing or extra results"
        files["manifest.json"] = encoded(manifest)
        for filename, payload in files.items():
            destination = args.output / filename
            if args.check:
                if not destination.is_file() or destination.read_bytes() != payload:
                    raise ValueError(f"Generated data differs: {destination}")
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(payload)
        print(f"{'Verified' if args.check else 'Generated'} 1,460 complete results; Python {sys.version.split()[0]}; dataset {DATASET}")


if __name__ == "__main__":
    main()

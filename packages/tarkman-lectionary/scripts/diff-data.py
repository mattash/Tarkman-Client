#!/usr/bin/env python3
"""Review data changes by date/field rather than a single 500 KB JSON line."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("before", type=Path, help="Directory containing the previous JSON packs")
parser.add_argument("after", type=Path, help="Directory containing regenerated JSON packs")
args = parser.parse_args()
changes = []
names = {p.name for directory in (args.before, args.after) for p in directory.glob("????-??.json")}
for name in sorted(names):
    def days(directory):
        path = directory / name
        return json.loads(path.read_text())["days"] if path.exists() else {}
    before, after = days(args.before), days(args.after)
    for date in sorted(before.keys() | after.keys()):
        if date not in before or date not in after:
            changes.append({"pack": name, "date": date, "change": "added" if date in after else "removed"})
            continue
        for field in sorted(before[date].keys() | after[date].keys()):
            old, new = before[date], after[date]
            # Explicit presence flags keep absent distinct from JSON null.
            left = {"present": field in old, **({"value": old[field]} if field in old else {})}
            right = {"present": field in new, **({"value": new[field]} if field in new else {})}
            if json.dumps(left, sort_keys=True) != json.dumps(right, sort_keys=True):
                changes.append({"pack": name, "date": date, "field": field, "before": left, "after": right})
print(json.dumps(changes, ensure_ascii=False, indent=2))

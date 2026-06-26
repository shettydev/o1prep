#!/usr/bin/env python3
"""Validate one JavaScript variant and, if it passes, write it into the YAML.

Reads a variant JSON object (from --file or stdin), runs its reference solution
through the real JavaScript runner, and only appends the ``languages.javascript``
block to the matching problem YAML when every test case passes. Prints ``OK: ...``
and exits 0 on success, or ``FAIL: ...`` and exits 1 otherwise.

This is the gate the parallel generation workflow uses: each agent produces a
variant with its own intelligence, then calls this to validate-and-persist, so
nothing unvalidated ever lands in the problem set.

    ./venv/bin/python scripts/apply_js_variant.py --id 42 --file /tmp/variant.json
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _jsgen_lib as lib  # noqa: E402
import yaml  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", type=int, required=True, help="problem id")
    ap.add_argument("--file", help="path to variant JSON (default: stdin)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing JS variant")
    args = ap.parse_args()

    raw = open(args.file, encoding="utf-8").read() if args.file else sys.stdin.read()
    try:
        variant = json.loads(raw)
    except Exception as e:
        print(f"FAIL: variant is not valid JSON: {e}")
        return 1

    path = lib.path_for_id(args.id)
    if path is None:
        print(f"FAIL: no problem YAML with id {args.id}")
        return 1

    with open(path, encoding="utf-8") as f:
        problem = yaml.safe_load(f)
    if lib.has_js_variant(problem) and not args.force:
        print(f"OK: problem {args.id} already has a JS variant (skipped)")
        return 0

    ok, detail = lib.validate(variant)
    if not ok:
        print(f"FAIL: {detail}")
        return 1

    lib.append_languages_block(path, variant)
    print(f"OK: wrote JS variant for problem {args.id} ({detail}) -> {os.path.basename(path)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

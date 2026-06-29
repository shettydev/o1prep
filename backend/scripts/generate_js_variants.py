#!/usr/bin/env python3
"""Generate and validate JavaScript variants for the problem set.

For each problem YAML that has no ``languages.javascript`` block yet, this asks
the configured Claude Code CLI to translate the Python problem into JavaScript —
a camelCase ``function_name``/``class_name``, JS ``starter_code``, JS
``test_cases`` (the same generic schema), and a throwaway JS *reference
solution*. The variant is then validated by running that reference solution
through the real JavaScript runner; only variants whose reference passes every
test case are written back into the YAML. Failures are reported and skipped, so
re-running the script retries only the ones still missing.

Usage:
    python scripts/generate_js_variants.py [--ids 1,2,3] [--limit N]
                                           [--retries 2] [--dry-run]

The expected values are reused verbatim from the (already validated) Python
test cases wherever they are language-agnostic, so correctness is anchored to
the existing suite rather than invented — the reference-solution gate then
catches any signature/translation mismatch.
"""

import argparse
import json
import os
import re
import subprocess
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # for _jsgen_lib

import _jsgen_lib as lib  # noqa: E402

import config  # noqa: E402
from services.db import LANGUAGE_KEYS  # noqa: E402

SYSTEM_PROMPT = """\
You translate Python coding-interview problems into JavaScript for an automated
judge. You output ONLY a single JSON object — no prose, no markdown fences.

The judge calls a function (or constructs a class and calls methods) and compares
the return value to an expected value with deep equality. JavaScript has no
keyword arguments: an `input` object is spread positionally in declaration order.

Rules:
- Use idiomatic camelCase for the JS function/method/class names.
- Keep EXACTLY the same number of test cases as the Python version, in the same
  order, and reuse the SAME `expected` values verbatim wherever they are
  language-agnostic (numbers, strings, booleans, arrays, plain objects). Only
  rename identifiers and translate code-bearing fields.
- Do NOT use `setup_code` or `__eval__` (the JS judge does not support them). If
  the Python test used a setup wrapper to normalize output (e.g. sorting), make
  the reference solution itself return the normalized form so `expected` still
  matches, or keep `expected` and have the solution produce it directly.
- For class problems, `ops` are method names (camelCase) and `op_args`,
  `init_args`, `expected`, `save_as`, `compare` keep their meaning and values.
- `reference_solution` must be correct JS that makes EVERY test case pass.

Output JSON shape (include class_name XOR function_name to match test_type):
{
  "test_type": "function" | "class",
  "function_name": "camelCaseName",      // when test_type == function
  "class_name": "CamelCaseName",          // when test_type == class
  "starter_code": "function ... { /* ... */ }",
  "reference_solution": "function ... { ... }",
  "test_cases": [ ... same schema, translated ... ]
}
"""


def _build_user_prompt(problem):
    lang_fields = {k: problem.get(k) for k in LANGUAGE_KEYS if k in problem}
    payload = {
        "title": problem.get("title"),
        "description": problem.get("description"),
        "constraints": problem.get("constraints", []),
        "test_type": problem.get("test_type", "function"),
        "function_name": problem.get("function_name"),
        "class_name": problem.get("class_name"),
        "python_starter_code": problem.get("starter_code", ""),
        "python_test_cases": lang_fields.get("test_cases", []),
    }
    return (
        "Translate this Python problem to JavaScript per the rules. "
        "Return ONLY the JSON object.\n\n"
        + json.dumps(payload, indent=2)
    )


def _extract_json_object(text):
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    start = s.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(s[start:i + 1])
                except Exception:
                    return None
    return None


def _ask_model(problem):
    """One-shot Claude CLI call returning the parsed JSON variant, or None."""
    cmd = [
        config.CLAUDE_BIN, "-p",
        "--model", config.CLAUDE_MODEL,
        "--max-turns", "1",
        "--setting-sources", "",
        "--tools", "",
        "--no-session-persistence",
        "--output-format", "json",
        "--system-prompt", SYSTEM_PROMPT,
    ]
    try:
        proc = subprocess.run(
            cmd,
            input=_build_user_prompt(problem),
            capture_output=True,
            text=True,
            timeout=config.CLAUDE_TIMEOUT,
            cwd=config.BASE_DIR,
        )
    except subprocess.TimeoutExpired:
        return None
    try:
        outer = json.loads(proc.stdout)
        result_text = outer.get("result") if isinstance(outer, dict) else None
    except Exception:
        result_text = proc.stdout
    return _extract_json_object(result_text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", help="comma-separated problem ids to process")
    ap.add_argument("--limit", type=int, help="process at most N problems")
    ap.add_argument("--retries", type=int, default=2, help="model retries per problem")
    ap.add_argument("--dry-run", action="store_true", help="validate but do not write YAML")
    args = ap.parse_args()

    ids = {int(x) for x in args.ids.split(",")} if args.ids else None

    succeeded, failed, skipped = [], [], 0
    processed = 0
    for path in lib.problem_files():
        with open(path, encoding="utf-8") as f:
            problem = yaml.safe_load(f)
        pid = problem.get("id")
        if ids is not None and pid not in ids:
            continue
        if lib.has_js_variant(problem):
            skipped += 1
            continue
        if args.limit is not None and processed >= args.limit:
            break
        processed += 1

        title = problem.get("title", f"#{pid}")
        ok = False
        detail = "no model output"
        for attempt in range(1, args.retries + 1):
            variant = _ask_model(problem)
            if not variant:
                detail = "model returned no JSON"
                continue
            ok, detail = lib.validate(variant)
            if ok:
                if not args.dry_run:
                    lib.append_languages_block(path, variant)
                break
            detail = f"attempt {attempt}: {detail}"

        if ok:
            print(f"  OK   [{pid}] {title} — {detail}")
            succeeded.append(pid)
        else:
            print(f"  FAIL [{pid}] {title} — {detail}")
            failed.append(pid)

    print(
        f"\nDone. {len(succeeded)} written, {len(failed)} failed, {skipped} already had a JS variant."
    )
    if failed:
        print("Failed ids (re-run to retry):", ",".join(str(i) for i in failed))
    if succeeded and not args.dry_run:
        print("Re-seed the database to load the new variants: python scripts/seed_problems.py")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

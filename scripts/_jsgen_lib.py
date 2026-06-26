"""Shared helpers for JavaScript-variant generation tooling.

Both ``generate_js_variants.py`` (Claude CLI batch) and ``apply_js_variant.py``
(used by the parallel agent workflow) import these so the validation gate and
the YAML serialization are defined once.
"""

import glob
import os
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from services.db import LANGUAGE_KEYS  # noqa: E402
from services.runners.javascript_runner import JavaScriptRunner  # noqa: E402

_runner = JavaScriptRunner()


def validate(variant):
    """Run the variant's reference solution through the JS runner.

    Returns ``(ok, detail)``. A variant is accepted only if its throwaway
    ``reference_solution`` makes every test case pass — that is the gate that
    keeps incorrect or mistranslated variants out of the problem set.
    """
    test_type = variant.get("test_type", "function")
    target = variant.get("class_name") if test_type == "class" else variant.get("function_name")
    reference = variant.get("reference_solution")
    test_cases = variant.get("test_cases")
    if not target or not reference or not test_cases:
        return False, "missing target/reference/test_cases"
    result = _runner.run_tests(reference, target, test_cases, test_type)
    if not result["success"]:
        return False, f"runner error: {result['error']}"
    failed = [r for r in result["results"] if not r["passed"]]
    if failed:
        first = next((r for r in failed if r.get("error")), failed[0])
        reason = first.get("error") or f"expected {first.get('expected')!r}, got {first.get('actual')!r}"
        return False, (
            f"{len(failed)}/{len(result['results'])} cases failed under reference solution; "
            f"e.g. {first.get('call')}: {reason}"
        )
    return True, f"{len(result['results'])} cases pass"


class _LiteralDumper(yaml.SafeDumper):
    pass


def _str_representer(dumper, data):
    style = "|" if "\n" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


_LiteralDumper.add_representer(str, _str_representer)


def languages_block(variant):
    """Serialize a ``languages: {javascript: {...}}`` YAML block (2-space indent)."""
    lang_data = {k: variant[k] for k in LANGUAGE_KEYS if k in variant}
    block = yaml.dump(
        {"languages": {"javascript": lang_data}},
        Dumper=_LiteralDumper,
        sort_keys=False,
        default_flow_style=False,
        allow_unicode=True,
        width=10**9,
    )
    return block.rstrip("\n") + "\n"


def append_languages_block(path, variant):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    if not text.endswith("\n"):
        text += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text + languages_block(variant))


def problem_files():
    return sorted(glob.glob(os.path.join(config.PROBLEMS_DIR, "*.yaml")))


def path_for_id(problem_id):
    """Return the YAML path whose `id:` matches problem_id, else None."""
    for path in problem_files():
        with open(path, encoding="utf-8") as f:
            problem = yaml.safe_load(f)
        if isinstance(problem, dict) and problem.get("id") == problem_id:
            return path
    return None


def has_js_variant(problem):
    return isinstance(problem, dict) and "javascript" in (problem.get("languages") or {})

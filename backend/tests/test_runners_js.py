"""Tests for the JavaScript runner and the language-runner registry.

The JS harness must mirror the Python harness contract feature-for-feature:
function- and class-style cases, deep equality, expected_error matching,
__ref__ resolution, and the same {success, results, error} shape so the same
frontend renderer works. Several tests run the SAME generic test cases through
both runners and assert identical pass/fail — that parity is the whole point.

Skips automatically if Node.js is not installed.
"""

import shutil

import pytest

import config
from services import languages
from services.runners import UnsupportedLanguageError, get_runner

pytestmark = pytest.mark.skipif(
    shutil.which(config.NODE_BIN) is None,
    reason="Node.js not installed; set NODE_BIN to run JS runner tests",
)

js = get_runner("javascript")
py = get_runner("python")


# ── Registry ────────────────────────────────────────────────────────────


def test_registry_resolves_supported_languages():
    assert get_runner("javascript").language == "javascript"
    assert get_runner("python").language == "python"
    assert get_runner("typescript").language == "typescript"


def test_registry_rejects_unknown_language():
    with pytest.raises(UnsupportedLanguageError):
        get_runner("cobol")


def test_languages_registry_metadata():
    assert languages.is_supported("javascript")
    assert not languages.is_supported("cobol")
    assert languages.resolve("cobol") == "python"
    assert languages.get("javascript")["codemirror_mode"] == "javascript"
    assert [m["id"] for m in languages.all_languages()][0] == "python"


def test_languages_label():
    assert languages.label("javascript") == "JavaScript"
    assert languages.label("python") == "Python"
    assert languages.label("cobol") == "Python"  # unknown resolves to default


# ── Function-style JS ───────────────────────────────────────────────────


def test_js_function_pass_with_positional_args():
    code = "function mul(a, b) { return a * b; }"
    result = js.run_tests(code, "mul", [{"args": [4, 5], "expected": 20}], "function")
    assert result["success"] is True
    assert result["error"] is None
    assert result["results"][0]["passed"] is True
    assert result["results"][0]["actual"] == 20


def test_js_function_input_object_passed_positionally():
    # JS has no kwargs: an `input` object is spread positionally in order.
    code = "function add(a, b) { return a + b; }"
    result = js.run_tests(code, "add", [{"input": {"a": 1, "b": 2}, "expected": 3}], "function")
    assert result["results"][0]["passed"] is True


def test_js_deep_equality_on_arrays():
    code = "function pair(a, b) { return [a, b]; }"
    result = js.run_tests(code, "pair", [{"args": [1, 2], "expected": [1, 2]}], "function")
    assert result["results"][0]["passed"] is True


def test_js_deep_equality_on_objects():
    code = "function wrap(x) { return { v: x }; }"
    result = js.run_tests(code, "wrap", [{"args": [7], "expected": {"v": 7}}], "function")
    assert result["results"][0]["passed"] is True


def test_js_wrong_answer_fails():
    code = "function add(a, b) { return a + b; }"
    result = js.run_tests(code, "add", [{"args": [1, 2], "expected": 99}], "function")
    assert result["success"] is True
    assert result["results"][0]["passed"] is False
    assert result["results"][0]["actual"] == 3


def test_js_expected_error_passes():
    code = "function boom() { throw new Error('nope'); }"
    result = js.run_tests(code, "boom", [{"args": [], "expected_error": "nope"}], "function")
    assert result["results"][0]["passed"] is True


def test_js_unexpected_error_fails():
    code = "function boom() { throw new Error('kaboom'); }"
    result = js.run_tests(code, "boom", [{"args": [], "expected": 1}], "function")
    assert result["results"][0]["passed"] is False
    assert "kaboom" in result["results"][0]["error"]


def test_js_async_function_is_awaited():
    code = "async function slow(x) { return x * 2; }"
    result = js.run_tests(code, "slow", [{"args": [21], "expected": 42}], "function")
    assert result["results"][0]["passed"] is True


def test_js_missing_function_reports_error():
    code = "function other() { return 1; }"
    result = js.run_tests(code, "add", [{"args": [1], "expected": 1}], "function")
    assert result["results"][0]["passed"] is False
    assert "not defined" in result["results"][0]["error"]


# ── Top-level failure modes ─────────────────────────────────────────────


def test_js_syntax_error_reports_failure():
    code = "function bad( { return; }"
    result = js.run_tests(code, "bad", [{"args": [], "expected": 1}], "function")
    assert result["success"] is False
    assert result["error"]


def test_js_timeout_is_caught():
    code = "function loop() { while (true) {} }"
    result = js.run_tests(code, "loop", [{"args": [], "expected": 1}], "function", timeout=1)
    assert result["success"] is False
    assert "Timeout" in result["error"]


# ── Class-style JS ──────────────────────────────────────────────────────


def test_js_class_ops_sequence_passes():
    code = "class Counter {\n  constructor() { this.n = 0; }\n  inc() { this.n += 1; return this.n; }\n}"
    tc = {"label": "basic", "init_args": [], "ops": ["inc", "inc"], "op_args": [[], []], "expected": [1, 2]}
    result = js.run_tests(code, "Counter", [tc], "class")
    assert result["success"] is True
    assert all(r["passed"] for r in result["results"])


def test_js_class_init_args_and_failure_short_circuits():
    code = "class Bag {\n  constructor(cap) { this.cap = cap; }\n  size() { return this.cap; }\n}"
    tc = {"label": "wrong", "init_args": [3], "ops": ["size"], "op_args": [[]], "expected": [999]}
    result = js.run_tests(code, "Bag", [tc], "class")
    assert result["results"][0]["passed"] is False
    assert result["results"][0]["actual"] == 3


def test_js_class_ref_resolution_across_steps():
    # __ref__ pulls a value saved by an earlier step into a later step's args.
    code = (
        "class Store {\n"
        "  constructor() { this.v = null; }\n"
        "  put(x) { this.v = x; return x; }\n"
        "  get() { return this.v; }\n"
        "}"
    )
    tc = {
        "init_args": [],
        "ops": ["put", "get"],
        "op_args": [[42], []],
        "expected": [42, 42],
        "save_as": ["saved", None],
    }
    result = js.run_tests(code, "Store", [tc], "class")
    assert all(r["passed"] for r in result["results"])


# ── Cross-runner parity ─────────────────────────────────────────────────


def test_parity_same_cases_same_verdict():
    # Identical generic test cases must yield identical pass/fail across runtimes.
    cases = [
        {"args": [2, 3], "expected": 5},
        {"args": [2, 3], "expected": 6},
        {"args": [[1, 2], [3]], "expected": [1, 2, 3]},
    ]
    py_code = "def f(a, b):\n    return (a + b)\n"
    js_code = "function f(a, b) { return a.concat ? a.concat(b) : a + b; }"
    py_res = py.run_tests(py_code, "f", cases, "function")
    js_res = js.run_tests(js_code, "f", cases, "function")
    py_pass = [r["passed"] for r in py_res["results"]]
    js_pass = [r["passed"] for r in js_res["results"]]
    assert py_pass == js_pass == [True, False, True]

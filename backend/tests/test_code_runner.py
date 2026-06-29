"""Tests for the Python code-execution sandbox (services/code_runner.py).

These are the riskiest pieces of logic in the app: a templated harness is
filled with user code and run in a subprocess. The tests below lock in the
behaviour of both the function-based and class-based harnesses, plus the
failure modes (wrong answer, raised error, syntax error, timeout).
"""

from services import code_runner

# ── Function-based harness ──────────────────────────────────────────────

def test_function_pass_with_kwargs():
    code = "def add(a, b):\n    return a + b\n"
    result = code_runner.run(code, "add", [{"input": {"a": 1, "b": 2}, "expected": 3}])
    assert result["success"] is True
    assert result["error"] is None
    assert result["results"][0]["passed"] is True
    assert result["results"][0]["actual"] == 3


def test_function_pass_with_positional_args():
    code = "def mul(a, b):\n    return a * b\n"
    result = code_runner.run(code, "mul", [{"args": [4, 5], "expected": 20}])
    assert result["success"] is True
    assert result["results"][0]["passed"] is True


def test_function_wrong_answer_fails():
    code = "def add(a, b):\n    return a + b\n"
    result = code_runner.run(code, "add", [{"input": {"a": 1, "b": 2}, "expected": 99}])
    assert result["success"] is True
    assert result["results"][0]["passed"] is False
    assert result["results"][0]["actual"] == 3


def test_function_expected_error_passes():
    code = "def boom():\n    raise ValueError('nope')\n"
    result = code_runner.run(code, "boom", [{"args": [], "expected_error": "ValueError"}])
    assert result["success"] is True
    assert result["results"][0]["passed"] is True


def test_function_unexpected_error_fails():
    code = "def boom():\n    raise KeyError('x')\n"
    result = code_runner.run(code, "boom", [{"args": [], "expected": 1}])
    assert result["success"] is True
    assert result["results"][0]["passed"] is False
    assert "KeyError" in result["results"][0]["error"]


# ── Top-level failure modes ─────────────────────────────────────────────

def test_syntax_error_reports_failure():
    code = "def bad(:\n    pass\n"
    result = code_runner.run(code, "bad", [{"args": [], "expected": 1}])
    assert result["success"] is False
    assert result["error"]


def test_timeout_is_caught():
    code = "def loop():\n    while True:\n        pass\n"
    result = code_runner.run(code, "loop", [{"args": [], "expected": 1}], timeout=1)
    assert result["success"] is False
    assert "Timeout" in result["error"]


def test_traceback_strips_temp_path():
    # A runtime error should not leak the codeprep temp file path.
    code = "def boom():\n    return 1 / 0\n"
    result = code_runner.run(code, "boom", [{"args": [], "expected": 1}])
    err = result["results"][0]["error"]
    assert "ZeroDivisionError" in err


# ── Class-based harness ─────────────────────────────────────────────────

def test_class_ops_sequence_passes():
    code = (
        "class Counter:\n"
        "    def __init__(self):\n"
        "        self.n = 0\n"
        "    def inc(self):\n"
        "        self.n += 1\n"
        "        return self.n\n"
    )
    tc = {"label": "basic", "init_args": [], "ops": ["inc", "inc"], "op_args": [[], []], "expected": [1, 2]}
    result = code_runner.run_class(code, "Counter", [tc])
    assert result["success"] is True
    assert all(r["passed"] for r in result["results"])


def test_class_init_args_and_failure_short_circuits():
    code = (
        "class Bag:\n"
        "    def __init__(self, cap):\n"
        "        self.cap = cap\n"
        "    def size(self):\n"
        "        return self.cap\n"
    )
    # Expect a wrong value on the first op -> case fails and stops.
    tc = {"label": "wrong", "init_args": [3], "ops": ["size"], "op_args": [[]], "expected": [999]}
    result = code_runner.run_class(code, "Bag", [tc])
    assert result["success"] is True
    assert result["results"][0]["passed"] is False
    assert result["results"][0]["actual"] == 3


# ── Result formatting ───────────────────────────────────────────────────

def test_format_results_for_context_summary():
    code = "def add(a, b):\n    return a + b\n"
    run_result = code_runner.run(code, "add", [{"input": {"a": 1, "b": 2}, "expected": 3}])
    text = code_runner.format_results_for_context(run_result, "add")
    assert "[TEST RESULTS]" in text
    assert "1/1 passed" in text
    assert "PASS" in text


def test_format_results_for_context_top_level_error():
    run_result = {"success": False, "results": [], "error": "boom"}
    text = code_runner.format_results_for_context(run_result, "add")
    assert "Code execution failed" in text
    assert "boom" in text

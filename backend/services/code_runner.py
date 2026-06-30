"""Code execution facade.

The per-language execution engines live in ``services/runners/`` (resolved via
``services.runners.get_runner``). This module keeps two things:

* ``run`` / ``run_class`` — thin Python-only shims retained for backward
  compatibility with existing callers and tests. New code should prefer
  ``get_runner(language).run_tests(...)``.
* ``format_results_for_context`` — language-agnostic rendering of a run result
  into the text summary injected into the interview conversation.
"""

import config
from services.runners.python_runner import PythonRunner

_python = PythonRunner()


def run(user_code: str, function_name: str, test_cases: list, timeout: int = config.CODE_TIMEOUT) -> dict:
    """Execute user_code against function-style test_cases (Python)."""
    return _python.run_tests(user_code, function_name, test_cases, "function", timeout)


def run_class(user_code: str, class_name: str, test_cases: list, timeout: int = config.CODE_TIMEOUT) -> dict:
    """Execute user_code against class-style test_cases (Python)."""
    return _python.run_tests(user_code, class_name, test_cases, "class", timeout)


def format_results_for_context(run_result: dict, function_name: str) -> str:
    """Format run results into a text summary to inject into conversation context."""
    if run_result["error"] and not run_result["results"]:
        return f"[TEST RESULTS]\nCode execution failed:\n{run_result['error']}"

    results = run_result["results"]
    passed = sum(1 for r in results if r["passed"])
    total = len(results)

    lines = ["[TEST RESULTS]", f"Executed against {total} test cases: {passed}/{total} passed."]
    for r in results:
        label_prefix = f"{r['label']} :: " if r.get("label") else ""
        call = r.get("call") or function_name
        if r.get("step"):
            call = f"step {r['step']} {call}"
        if r["passed"]:
            if r.get("expected_error"):
                lines.append(f"  PASS: {label_prefix}{call} -> raised {r['expected_error']}")
            else:
                lines.append(f"  PASS: {label_prefix}{call} -> {repr(r['actual'])}")
        elif r["error"]:
            lines.append(f"  FAIL: {label_prefix}{call} -> {r['error']}")
        elif r.get("expected_error"):
            lines.append(f"  FAIL: {label_prefix}{call} -> expected error containing {repr(r['expected_error'])}")
        else:
            lines.append(f"  FAIL: {label_prefix}{call} -> expected {repr(r['expected'])}, got {repr(r['actual'])}")

    return "\n".join(lines)

"""Tests for multi-language problem seeding and fetch.

Problem 133 (Sum of Digits) carries a hand-authored JavaScript variant in its
YAML, so it exercises the whole data path: the ``languages:`` block is seeded
into its own ``problem_languages`` row, fetched back as a language-specific
problem dict, and its JS test cases run green against a JS solution.
"""

import shutil

import pytest

import config
from services import problems
from services.runners import get_runner

_HAS_NODE = shutil.which(config.NODE_BIN) is not None


def test_javascript_variant_is_seeded():
    langs = problems.available_languages(133)
    assert "python" in langs
    assert "javascript" in langs


def test_python_variant_is_default():
    problem = problems.get_by_id(133)
    assert problem["function_name"] == "digit_sum"


def test_javascript_variant_has_its_own_fields():
    problem = problems.get_by_id(133, "javascript")
    assert problem is not None
    assert problem["function_name"] == "digitSum"
    assert "function digitSum" in problem["starter_code"]
    # Agnostic fields still merge in from the shared problem row.
    assert problem["title"] == "Sum of Digits"


def test_untranslated_problem_returns_none_for_javascript():
    # Problem 1 has no JS variant yet → exact fetch is None (route falls back).
    assert problems.get_by_id(1, "javascript") is None
    assert "javascript" not in problems.available_languages(1)


@pytest.mark.skipif(not _HAS_NODE, reason="Node.js not installed")
def test_javascript_variant_runs_green():
    problem = problems.get_by_id(133, "javascript")
    solution = "function digitSum(n) { return String(n).split('').reduce((s, d) => s + Number(d), 0); }"
    result = get_runner("javascript").run_tests(
        solution, problem["function_name"], problem["test_cases"], problem["test_type"]
    )
    assert result["success"] is True
    assert all(r["passed"] for r in result["results"])

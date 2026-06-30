"""Schema validation for every problem YAML.

This is a contributor safety net: adding a malformed problem file (missing a
required field, a bad ``test_type``, a ``class`` problem with no ``class_name``,
a duplicate id) fails CI with a clear message instead of breaking the app at
runtime.

The invariants encoded here were derived from the existing corpus, so all
shipped problems pass. Keep them in sync if the problem format evolves.
"""

import glob
import os

import pytest
import yaml

import config

PROBLEM_FILES = sorted(glob.glob(os.path.join(config.PROBLEMS_DIR, "*.yaml")))

REQUIRED_FIELDS = ("id", "title", "category", "difficulty", "summary", "description", "test_type")
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
VALID_TEST_TYPES = {"class", "function"}


def _load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def test_problem_files_exist():
    assert PROBLEM_FILES, "no problem YAML files found"


@pytest.mark.parametrize("path", PROBLEM_FILES, ids=[os.path.basename(p) for p in PROBLEM_FILES])
def test_problem_is_valid(path):
    data = _load(path)
    name = os.path.basename(path)

    assert isinstance(data, dict), f"{name}: top-level YAML must be a mapping"

    for field in REQUIRED_FIELDS:
        assert data.get(field) not in (None, ""), f"{name}: missing required field '{field}'"

    assert isinstance(data["id"], int), f"{name}: 'id' must be an integer"
    assert isinstance(data["category"], str) and data["category"].strip(), (
        f"{name}: 'category' must be a non-empty string"
    )
    assert data["difficulty"] in VALID_DIFFICULTIES, f"{name}: difficulty must be one of {VALID_DIFFICULTIES}"

    test_type = data["test_type"]
    assert test_type in VALID_TEST_TYPES, f"{name}: test_type must be one of {VALID_TEST_TYPES}"

    if test_type == "class":
        assert data.get("class_name"), f"{name}: class problems require 'class_name'"
    else:
        assert data.get("function_name"), f"{name}: function problems require 'function_name'"

    test_cases = data.get("test_cases")
    assert isinstance(test_cases, list) and test_cases, f"{name}: 'test_cases' must be a non-empty list"


def test_ids_are_unique():
    ids = [_load(p)["id"] for p in PROBLEM_FILES]
    dupes = {i for i in ids if ids.count(i) > 1}
    assert not dupes, f"duplicate problem ids: {sorted(dupes)}"

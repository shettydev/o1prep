"""Tests for the SQLite storage layer and YAML -> DB seeding."""

import json

from services import code_runner, db, problems


def _json_norm(value):
    """Normalize through JSON the same way DB storage (and the test harness) do."""
    return json.loads(json.dumps(value))


def test_split_and_merge_round_trip():
    problem = {
        "id": 1,
        "title": "Example",
        "category": "stateful",
        "difficulty": "Easy",
        "summary": "s",
        "starter_code": "def f(): pass",
        "test_type": "function",
        "function_name": "f",
        "test_cases": [{"args": [], "expected": 1}],
    }
    agnostic, language = db.split_problem(problem)
    # Language-specific keys go to the language half, everything else stays.
    assert set(language) == {"starter_code", "test_type", "function_name", "test_cases"}
    assert "title" in agnostic and "starter_code" not in agnostic
    assert db.merge_problem(agnostic, language) == problem


def test_seed_count_matches_yaml():
    yaml_count = len(problems.load_yaml_problems())
    seeded = problems.seed(force=True)
    assert seeded == yaml_count
    assert len(problems.load_all()) == yaml_count


def test_get_by_id_is_lossless_vs_yaml():
    # The dict reconstructed from the DB must equal the original YAML dict,
    # modulo JSON normalization. This is the same normalization code_runner
    # already applies to test_cases (a few problems use integer dict keys in
    # `expected`, which JSON represents as strings), so it does not change how
    # tests are executed -- see test_db_test_cases_run_identically.
    yaml_problems = {p["id"]: p for p in problems.load_yaml_problems()}
    mismatches = [pid for pid, y in yaml_problems.items() if problems.get_by_id(pid) != _json_norm(y)]
    assert not mismatches, f"DB reconstruction diverged from YAML for ids: {mismatches}"


def test_db_test_cases_run_identically():
    # Behavioral guarantee: code_runner produces the same results whether fed
    # YAML-direct test_cases or DB-reconstructed ones. Covers the integer-key
    # problems (85, 89) where YAML and JSON dict representations differ.
    yaml_problems = {p["id"]: p for p in problems.load_yaml_problems()}
    for pid in (85, 89, 100):
        if pid not in yaml_problems:
            continue
        y = yaml_problems[pid]
        g = problems.get_by_id(pid)
        if y.get("test_type") != "function":
            continue
        dummy = f"def {y['function_name']}(*a, **k):\n    return None\n"
        assert code_runner.run(dummy, y["function_name"], y["test_cases"]) == \
            code_runner.run(dummy, g["function_name"], g["test_cases"])


def test_reconstructed_class_problem_has_class_fields():
    # Problem 1 (LRU Cache) is class-based.
    p = problems.get_by_id(1)
    assert p["test_type"] == "class"
    assert p["class_name"]
    assert isinstance(p["test_cases"], list) and p["test_cases"]


def test_seed_is_idempotent():
    first = problems.seed(force=True)
    second = problems.seed(force=False)
    assert first == second
    assert len(problems.load_all()) == first


def test_get_by_id_missing_returns_none():
    assert problems.get_by_id(10**9) is None

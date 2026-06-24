"""Pure helpers for the problem agnostic / per-language split.

Storage itself lives in the ORM (see ``services.models`` and
``services.problems``). These helpers have no database or Flask dependency so
they are trivial to unit-test.
"""

# Fields that vary per programming language. Everything else is agnostic.
LANGUAGE_KEYS = ("starter_code", "test_type", "class_name", "function_name", "test_cases")
DEFAULT_LANGUAGE = "python"


def split_problem(problem):
    """Split a full problem dict into (agnostic, language-specific) dicts."""
    language = {k: problem[k] for k in LANGUAGE_KEYS if k in problem}
    agnostic = {k: v for k, v in problem.items() if k not in LANGUAGE_KEYS}
    return agnostic, language


def merge_problem(agnostic_data, language_data):
    """Reconstruct a full problem dict from its two stored halves."""
    return {**agnostic_data, **language_data}

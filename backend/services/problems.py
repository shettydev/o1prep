"""Problem access layer (PostgreSQL).

Problems are stored in the database (see ``services.models``) but the canonical
source of truth is the YAML files in ``problems/``. The DB is seeded from those
files via ``seed()`` / ``scripts/seed_problems.py``.

``load_all`` and ``get_by_id`` return the same full problem dicts that the rest
of the app expects, so routes and the code runner are unaffected by storage.
All functions that touch the database require an active Flask app context.
"""

import os
from glob import glob

import yaml

from config import PROBLEMS_DIR
from services.db import DEFAULT_LANGUAGE, LANGUAGE_KEYS, merge_problem, split_problem
from services.extensions import db
from services.models import Problem, ProblemLanguage


def load_yaml_problems():
    """Read every problem YAML from disk (the canonical source)."""
    problems = []
    for path in sorted(glob(os.path.join(PROBLEMS_DIR, "*.yaml"))):
        with open(path, encoding="utf-8") as f:
            problems.append(yaml.safe_load(f))
    return problems


def _to_dict(problem, language=DEFAULT_LANGUAGE):
    """Merge a Problem row with one language row into a full problem dict."""
    lang = next((pl for pl in problem.languages if pl.language == language), None)
    if lang is None:
        return None
    return merge_problem(problem.data, lang.data)


def seed(force=False):
    """Load the YAML problems into the database.

    Each YAML file carries the language-agnostic fields plus the default-language
    (Python) fields at the top level. Additional languages live under an optional
    ``languages:`` mapping, e.g. ``languages: {javascript: {starter_code, ...}}``;
    each entry becomes its own ``problem_languages`` row, keyed by language.

    Idempotent: existing rows are updated in place (upsert by primary key). With
    ``force=True`` the tables are cleared first so problems deleted from disk are
    also removed. Returns the number of problems seeded.
    """
    yaml_problems = load_yaml_problems()
    if force:
        db.session.query(ProblemLanguage).delete()
        db.session.query(Problem).delete()
        db.session.flush()
    for problem in yaml_problems:
        extra_languages = problem.pop("languages", None) or {}
        agnostic, language = split_problem(problem)
        db.session.merge(
            Problem(
                id=problem["id"],
                title=problem.get("title", ""),
                category=problem.get("category", ""),
                difficulty=problem.get("difficulty", ""),
                data=agnostic,
            )
        )
        db.session.merge(
            ProblemLanguage(
                problem_id=problem["id"],
                language=DEFAULT_LANGUAGE,
                data=language,
            )
        )
        for lang_id, lang_fields in extra_languages.items():
            # Keep only the per-language keys so the row mirrors the default one.
            lang_data = {k: v for k, v in (lang_fields or {}).items() if k in LANGUAGE_KEYS}
            db.session.merge(
                ProblemLanguage(
                    problem_id=problem["id"],
                    language=lang_id,
                    data=lang_data,
                )
            )
    db.session.commit()
    return len(yaml_problems)


def ensure_seeded():
    """Seed from YAML if the problems table is empty (convenience for dev/tests)."""
    if db.session.query(Problem.id).first() is None:
        seed()


def load_all(language=DEFAULT_LANGUAGE):
    rows = db.session.query(Problem).order_by(Problem.id).all()
    return [d for d in (_to_dict(p, language) for p in rows) if d is not None]


def get_by_id(problem_id, language=DEFAULT_LANGUAGE):
    """Return the full problem dict for ``language``, or ``None`` if missing.

    Pass ``language`` to fetch a specific language variant. The returned dict is
    ``None`` when the problem has no row for that language (e.g. a problem that
    has not been translated yet) — callers that just need a problem to display
    can fall back via ``language=DEFAULT_LANGUAGE``.
    """
    if problem_id is None:
        return None
    problem = db.session.get(Problem, problem_id)
    return _to_dict(problem, language) if problem else None


def available_languages(problem_id):
    """Return the language ids that have a row for this problem (default first)."""
    if problem_id is None:
        return []
    problem = db.session.get(Problem, problem_id)
    if problem is None:
        return []
    langs = [pl.language for pl in problem.languages]
    return sorted(langs, key=lambda lang: (lang != DEFAULT_LANGUAGE, lang))


def serialize_for_list(problem):
    return {
        "id": problem["id"],
        "title": problem["title"],
        "category": problem["category"],
        "difficulty": problem["difficulty"],
        "summary": problem.get("summary", ""),
        "starter_code": problem.get("starter_code", ""),
        "key_skills": problem.get("key_skills", []),
    }


def serialize_full(problem, language=DEFAULT_LANGUAGE, available=None):
    return {
        "id": problem["id"],
        "title": problem["title"],
        "category": problem["category"],
        "difficulty": problem["difficulty"],
        "summary": problem.get("summary", ""),
        "description": problem.get("description", ""),
        "scenario": problem.get("scenario", ""),
        "constraints": problem.get("constraints", []),
        "examples": problem.get("examples", []),
        "key_skills": problem.get("key_skills", []),
        "follow_ups": problem.get("follow_ups", []),
        "starter_code": problem.get("starter_code", ""),
        "explanation": problem.get("explanation", ""),
        "references": problem.get("references", []),
        "language": language,
        "available_languages": available if available is not None else [language],
    }


def build_problem_block(problem, language=DEFAULT_LANGUAGE):
    follow_ups = "\n".join(f"- {f}" for f in problem.get("follow_ups", []))
    constraints = "\n".join(f"- {c}" for c in problem.get("constraints", []))
    examples = []
    for example in problem.get("examples", [])[:2]:
        examples.append(f"Input:\n{example.get('input', '').strip()}\n\nOutput:\n{example.get('output', '').strip()}")
    examples_block = "\n\n".join(examples)

    interface_block = ""
    if problem.get("starter_code"):
        interface_block = (
            "\n\nRequired interface (the candidate's code should match this shape):"
            f"\n```{language}\n{problem['starter_code']}\n```"
        )

    return (
        f"\n\nYou MUST use this specific problem for the interview:"
        f"\n\nTitle: {problem['title']}"
        f"\nDifficulty: {problem['difficulty']}"
        f"\nCategory: {problem['category']}"
        f"\n\nScenario:\n{problem.get('scenario', '').strip()}"
        f"\n\nProblem:\n{problem['description']}"
        f"\n\nConstraints:\n{constraints or '- No additional constraints provided.'}"
        f"{interface_block}"
        f"\n\nExample cases:\n{examples_block or 'Use the problem statement and interface above.'}"
        f"\n\nSuggested follow-ups (use if the candidate is doing well):\n{follow_ups or '- No suggested follow-ups.'}"
        f"\n\nPresent this problem in your own words as a natural interviewer would. Do not read it verbatim."
        f"\nBe explicit about the required function or class name if the candidate asks."
    )


def build_study_context(problem):
    """Build the problem context string used by the research/tutor chat."""
    constraints = "\n".join(f"- {c}" for c in problem.get("constraints", []))
    context = (
        f"\n\nThe student is studying this problem:"
        f"\n\nTitle: {problem['title']}"
        f"\nDifficulty: {problem['difficulty']}"
        f"\nCategory: {problem['category']}"
        f"\n\nScenario:\n{problem.get('scenario', '').strip()}"
        f"\n\nProblem:\n{problem.get('description', '').strip()}"
        f"\n\nConstraints:\n{constraints}"
        f"\n\nKey skills: {', '.join(problem.get('key_skills', []))}"
    )
    if problem.get("explanation"):
        context += f"\n\nReference explanation (use to inform your answers):\n{problem['explanation']}"
    if problem.get("references"):
        refs = "\n".join(f"- {ref}" for ref in problem["references"])
        context += f"\n\nReference topics and study material:\n{refs}"
    return context

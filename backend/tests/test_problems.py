"""Tests for problem loading and serialization (services/problems.py)."""

import glob
import os

import config
from services import problems


def _yaml_count():
    return len(glob.glob(os.path.join(config.PROBLEMS_DIR, "*.yaml")))


def test_load_all_returns_every_yaml():
    loaded = problems.load_all()
    assert isinstance(loaded, list)
    assert len(loaded) == _yaml_count()
    assert all(isinstance(p, dict) for p in loaded)


def test_get_by_id_found():
    p = problems.get_by_id(1)
    assert p is not None
    assert p["id"] == 1
    assert p["title"]


def test_get_by_id_none_and_missing():
    assert problems.get_by_id(None) is None
    assert problems.get_by_id(10**9) is None


def test_serialize_for_list_shape():
    p = problems.get_by_id(1)
    s = problems.serialize_for_list(p)
    assert set(s) == {"id", "title", "category", "difficulty", "summary", "starter_code", "key_skills"}


def test_serialize_full_shape():
    p = problems.get_by_id(1)
    s = problems.serialize_full(p)
    for key in ("id", "title", "description", "scenario", "constraints", "examples", "explanation"):
        assert key in s


def test_build_problem_block_mentions_title():
    p = problems.get_by_id(1)
    block = problems.build_problem_block(p)
    assert p["title"] in block
    assert "interview" in block.lower()


def test_build_study_context_mentions_title():
    p = problems.get_by_id(1)
    ctx = problems.build_study_context(p)
    assert p["title"] in ctx

"""Route-level tests for language selection plumbing.

Cover the wiring added so a session can run in a language other than Python:
the language allowlist is exposed, a session remembers its language, the
scratchpad runner dispatches on it, and problem fetches fall back cleanly for
languages that have not been translated yet.
"""

import shutil

import pytest

import config

_HAS_NODE = shutil.which(config.NODE_BIN) is not None


def test_config_exposes_language_allowlist(client):
    cfg = client.get("/api/config").get_json()
    ids = [lang["id"] for lang in cfg["languages"]]
    assert ids[0] == "python"  # default first
    assert "javascript" in ids
    assert cfg["default_language"] == "python"


def test_session_remembers_language(auth_client):
    resp = auth_client.post(
        "/api/sessions",
        json={"problem_id": 1, "mode": "text", "language": "javascript"},
    )
    assert resp.status_code == 200
    sid = resp.get_json()["id"]
    detail = auth_client.get(f"/api/sessions/{sid}").get_json()
    assert detail["language"] == "javascript"


def test_session_defaults_to_python(auth_client):
    sid = auth_client.post("/api/sessions", json={"problem_id": 1, "mode": "text"}).get_json()["id"]
    detail = auth_client.get(f"/api/sessions/{sid}").get_json()
    assert detail["language"] == "python"


def test_session_rejects_unknown_language_falls_back(auth_client):
    sid = auth_client.post(
        "/api/sessions",
        json={"problem_id": 1, "mode": "text", "language": "cobol"},
    ).get_json()["id"]
    detail = auth_client.get(f"/api/sessions/{sid}").get_json()
    assert detail["language"] == "python"


def test_problem_fetch_reports_available_languages(client):
    # Only Python is seeded by default, so a JS request falls back to Python
    # content but still reports which languages actually exist.
    data = client.get("/api/problems/1?language=javascript").get_json()
    assert data["available_languages"] == ["python"]
    assert data["language"] == "python"


def test_run_requires_auth(client):
    assert client.post("/api/run", json={"code": "print(1)"}).status_code == 401


def test_run_python_scratchpad(auth_client):
    resp = auth_client.post("/api/run", json={"code": "print(2 + 2)", "language": "python"})
    body = resp.get_json()
    assert body["exit_code"] == 0
    assert "4" in body["stdout"]


@pytest.mark.skipif(not _HAS_NODE, reason="Node.js not installed")
def test_run_javascript_scratchpad(auth_client):
    resp = auth_client.post(
        "/api/run",
        json={"code": "console.log(2 + 2);", "language": "javascript"},
    )
    body = resp.get_json()
    assert body["exit_code"] == 0
    assert "4" in body["stdout"]

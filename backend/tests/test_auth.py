"""Tests for authentication and per-user session scoping."""


def test_me_anonymous(client):
    assert client.get("/api/auth/me").get_json() == {"authenticated": False}


def test_register_logs_in(client):
    resp = client.post("/api/auth/register", json={"email": "a@b.com", "password": "password123"})
    assert resp.status_code == 200
    assert resp.get_json() == {"authenticated": True, "email": "a@b.com"}
    assert client.get("/api/auth/me").get_json()["authenticated"] is True


def test_register_rejects_short_password(client):
    resp = client.post("/api/auth/register", json={"email": "a@b.com", "password": "short"})
    assert resp.status_code == 400


def test_register_rejects_duplicate_email(client):
    client.post("/api/auth/register", json={"email": "dupe@b.com", "password": "password123"})
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/register", json={"email": "dupe@b.com", "password": "password123"})
    assert resp.status_code == 409


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"email": "x@b.com", "password": "password123"})
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/login", json={"email": "x@b.com", "password": "wrongpass1"})
    assert resp.status_code == 401


def test_login_success(client):
    client.post("/api/auth/register", json={"email": "y@b.com", "password": "password123"})
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/login", json={"email": "y@b.com", "password": "password123"})
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "y@b.com"


def test_sessions_require_auth(client):
    assert client.get("/api/sessions").status_code == 401


def test_problems_are_public(client):
    # Browsing the library does not require auth.
    assert client.get("/api/problems").status_code == 200
    assert len(client.get("/api/problems").get_json()) > 0


def test_session_create_and_list(auth_client):
    resp = auth_client.post("/api/sessions", json={"problem_id": 1, "focus": "stateful", "mode": "text"})
    assert resp.status_code == 200
    sid = resp.get_json()["id"]

    listing = auth_client.get("/api/sessions").get_json()
    assert any(s["id"] == sid for s in listing)

    detail = auth_client.get(f"/api/sessions/{sid}").get_json()
    assert detail["problem_title"] == "LRU Cache"


def test_session_ownership_isolation(app):
    """A session created by one user is invisible to another."""
    # User 1 creates a session.
    c1 = app.test_client()
    c1.post("/api/auth/register", json={"email": "owner@b.com", "password": "password123"})
    sid = c1.post("/api/sessions", json={"problem_id": 1, "mode": "text"}).get_json()["id"]

    # User 2 cannot read or delete it.
    c2 = app.test_client()
    c2.post("/api/auth/register", json={"email": "intruder@b.com", "password": "password123"})
    assert c2.get(f"/api/sessions/{sid}").status_code == 404
    assert c2.get("/api/sessions").get_json() == []

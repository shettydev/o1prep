"""Shared test fixtures.

Tests run against a dedicated PostgreSQL database (created automatically if it
doesn't exist) so they never touch the development database. Problems are seeded
once per session; users and sessions are cleared after each test for isolation.

Override the target with TEST_DATABASE_URL; by default it reuses the configured
DATABASE_URL host/credentials with an ``o1prep_test`` database name.
"""

import os

import pytest
from sqlalchemy import create_engine, text

import config


def _test_db_url():
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    base, _, _name = config.DATABASE_URL.rpartition("/")
    return f"{base}/o1prep_test"


def _ensure_database(url):
    """Create the test database if it does not already exist."""
    base, _, dbname = url.rpartition("/")
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": dbname}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{dbname}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def app():
    url = _test_db_url()
    _ensure_database(url)
    config.DATABASE_URL = url

    from app import create_app
    from services import ai, problems
    from services.extensions import db

    # Session routes guard on a usable AI client. Tests don't exercise real AI
    # calls, so stub get_client to a truthy sentinel (the Claude CLI / OpenAI key
    # is not available in CI).
    ai.get_client = lambda *args, **kwargs: object()

    application = create_app()
    application.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI=url)

    with application.app_context():
        db.drop_all()
        db.create_all()
        problems.seed(force=True)

    yield application

    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def app_context(app):
    """Push an app context per test with a clean slate of user data.

    Cleanup runs at the start (so test order never matters) and the session is
    rolled back / removed at the end so an aborted transaction can't leak into
    the next test. Seeded problems are left intact.
    """
    from services.extensions import db
    from services.models import Session, User

    with app.app_context():
        db.session.rollback()
        db.session.query(Session).delete()
        db.session.query(User).delete()
        db.session.commit()
        try:
            yield
        finally:
            db.session.rollback()
            db.session.remove()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_client(client):
    """A test client with a registered, logged-in user."""
    client.post("/api/auth/register", json={"email": "test@example.com", "password": "password123"})
    return client

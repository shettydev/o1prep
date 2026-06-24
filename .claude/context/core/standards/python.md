<!-- Context: core/standards | Priority: critical | Version: 1.0 | Updated: 2026-06-24 -->

# Universal Python Standards

**Purpose**: Universal Python patterns applicable to any Python project, with notes for the Flask + SQLAlchemy stack used in this codebase
**Scope**: Language-level patterns and project tooling, not framework deep-dives
**Last Updated**: 2026-06-24

---

## Table of Contents

1. [Tooling & Style Baseline](#1-tooling--style-baseline)
2. [Naming Conventions](#2-naming-conventions)
3. [Type Hints](#3-type-hints)
4. [Functions](#4-functions)
5. [Control Flow](#5-control-flow)
6. [Data & Comprehensions](#6-data--comprehensions)
7. [Error Handling](#7-error-handling)
8. [Imports & Module Layout](#8-imports--module-layout)
9. [Flask & SQLAlchemy Patterns](#9-flask--sqlalchemy-patterns)
10. [Testing Principles](#10-testing-principles)

---

## 1. Tooling & Style Baseline

**Rule: Conform to the project's `pyproject.toml`. Run Ruff before committing.**

This project is configured for:

- **Formatter/linter**: [Ruff](https://docs.astral.sh/ruff/) — lint rules `E`, `F`, `W`, `I` (import sorting), `line-length = 120`, `target-version = "py38"`.
- **Indentation**: 4 spaces (never tabs).
- **Quotes**: single quotes for strings (`'auth'`), matching existing code.
- **Long strings**: `E501` (line length) is intentionally ignored — long SQL/prompt strings are fine.

```bash
# ✅ GOOD - lint + auto-fix imports/format before committing
ruff check . --fix
ruff format .
```

**Rule: Match existing style over personal preference.** The codebase predates strict linting; keep changes gentle and consistent with surrounding code.

---

## 2. Naming Conventions

**Rule: Follow PEP 8 naming.**

```python
# ✅ GOOD
def create_session(): ...        # functions/methods: snake_case
user_email = 'a@example.com'     # variables: snake_case
MIN_PASSWORD_LENGTH = 8          # module constants: UPPER_SNAKE_CASE

class Session:                   # classes: PascalCase
    ...

def _credentials():              # private/internal helper: leading underscore
    ...

# ❌ AVOID
def createSession(): ...         # camelCase is not Pythonic
MinPasswordLength = 8            # constants should be UPPER_SNAKE_CASE
```

**Rule: Prefer clear, single-purpose names; avoid redundant prefixes.**

```python
# ✅ GOOD
session = get_session(id)
email, password = _credentials()

# ❌ AVOID - unnecessary verbosity
current_active_session_object = get_session(id)
```

---

## 3. Type Hints

**Rule: Add type hints to public function signatures.** They document intent and enable editor/`mypy` checks. Honor the `py38` target — use `typing.Optional`/`List`/`Dict` rather than `int | None` / `list[int]` syntax unless the project bumps its target.

```python
# ✅ GOOD - py38-compatible hints
from typing import Optional

def get_user(user_id: int) -> Optional[User]:
    return db.session.get(User, user_id)

# ✅ GOOD - hint the non-obvious, infer the obvious
def normalize(email: str) -> str:
    return email.strip().lower()

# ❌ AVOID - py3.10+ syntax under a py38 target
def get_user(user_id: int) -> User | None: ...
```

**Rule: Don't over-annotate locals.** Annotate signatures and ambiguous values; let obvious assignments infer.

---

## 4. Functions

**Rule: Keep functions small, pure where practical, and single-purpose.**

```python
# ✅ GOOD - pure helper, no hidden state
def calculate_total(items: list) -> int:
    return sum(item.price for item in items)

# ❌ AVOID - mutates module-level state
_total = 0
def add_to_total(item):
    global _total
    _total += item.price
```

**Rule: Use keyword arguments for clarity at call sites with multiple/boolean args.**

```python
# ✅ GOOD
login_user(user, remember=True)
create_session(problem_id=pid, mode='practice')

# ❌ AVOID - positional booleans are unreadable
login_user(user, True)
```

**Rule: Never use mutable default arguments.**

```python
# ✅ GOOD
def add_tag(tags: Optional[list] = None):
    tags = tags or []
    ...

# ❌ BAD - shared mutable default across calls
def add_tag(tags=[]):
    tags.append(...)
```

---

## 5. Control Flow

**Rule: Use guard clauses and early returns; avoid deep nesting.**

```python
# ✅ GOOD - early returns
def status(session):
    if session is None:
        return 'not_found'
    if session.busy:
        return 'busy'
    if session.error:
        return 'error'
    return 'ready'

# ❌ BAD - nested else pyramid
def status(session):
    if session is None:
        return 'not_found'
    else:
        if session.busy:
            return 'busy'
        else:
            ...
```

**Rule: Validate inputs at the top of the function (guard clauses).**

```python
# ✅ GOOD
def register():
    email, password = _credentials()
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({'error': 'Password too short'}), 400
    # main logic
```

---

## 6. Data & Comprehensions

**Rule: Prefer comprehensions/generators over manual loops for transforming data.**

```python
# ✅ GOOD
emails = [u.email for u in users if u.is_active]
total = sum(item.price for item in items)          # generator - no intermediate list
by_id = {u.id: u for u in users}

# ❌ AVOID - manual accumulation when a comprehension is clearer
emails = []
for u in users:
    if u.is_active:
        emails.append(u.email)
```

**Rule: Reach for an explicit `for` loop when there are side effects, early exit, or the logic is too complex for a one-liner.** Readability wins over cleverness — don't nest comprehensions three deep.

**Rule: Use `dict`/`set` for membership and lookup, not repeated list scans.**

```python
# ✅ GOOD - O(1) membership
disabled = {'foo', 'bar'}
if key in disabled: ...
```

---

## 7. Error Handling

**Rule: Catch specific exceptions, never bare `except:`.**

```python
# ✅ GOOD
try:
    db.session.commit()
except IntegrityError:
    db.session.rollback()
    return jsonify({'error': 'Email already registered'}), 409

# ❌ BAD - swallows everything, hides bugs
try:
    db.session.commit()
except:
    pass
```

**Rule: Fail loudly or handle deliberately — don't silently discard errors.** Re-raise with context (`raise ... from err`) when wrapping.

**Rule: Use context managers (`with`) for resources** (files, DB engines, locks) so they always close.

```python
# ✅ GOOD
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
```

---

## 8. Imports & Module Layout

**Rule: Order imports in three groups (Ruff `I` enforces this): stdlib, third-party, local.** Blank line between groups, alphabetized within.

```python
# ✅ GOOD
import os
from typing import Optional

import pytest
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

import config
from services.extensions import db
from services.models import User
```

**Rule: Prefer module-level imports.** Use function-local imports only to break import cycles or defer heavy/optional dependencies (as `conftest.py` does to control app/db setup order).

**Rule: One cohesive responsibility per module.** Keep route blueprints, services, and models in their established directories (`routes/`, `services/`).

---

## 9. Flask & SQLAlchemy Patterns

**Rule: Organize routes as Blueprints, one blueprint per domain area.**

```python
# ✅ GOOD - routes/auth.py
bp = Blueprint('auth', __name__)

@bp.route('/api/auth/me')
def me():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'email': current_user.email})
    return jsonify({'authenticated': False})
```

**Rule: Return `(body, status_code)` tuples for non-200 responses; use `jsonify` for JSON.**

```python
return jsonify({'error': 'Not found'}), 404
```

**Rule: Use the shared extension instances** (`from services.extensions import db`) — never create a second `SQLAlchemy()`/engine. Define models against the shared `db`.

**Rule: Always pair `commit()` with `rollback()` on failure**, and let request-scoped sessions be torn down by Flask-SQLAlchemy rather than closing them manually.

**Rule: Guard endpoints with `@login_required`** where authentication is required; read identity from `current_user`, not request params.

**Rule: Never build SQL with string formatting on user input.** Use SQLAlchemy expressions or bound parameters (`text(...)` with params). See `core/standards/security-patterns.md`.

---

## 10. Testing Principles

**Rule: Use `pytest`. Tests live in `tests/`, are importable via `pythonpath = ["."]`.**

**Rule: Follow Arrange–Act–Assert and test both success and failure paths.**

```python
# ✅ GOOD
def test_register_rejects_short_password(client):
    # Arrange / Act
    res = client.post('/api/auth/register',
                      json={'email': 'a@b.com', 'password': 'short'})
    # Assert
    assert res.status_code == 400
    assert 'too short' in res.get_json()['error'].lower()
```

**Rule: Use fixtures for shared setup; isolate state between tests.** This project seeds problems once per session and clears users/sessions after each test (see `tests/conftest.py`). Never let tests touch the development database — use the dedicated test DB / `TEST_DATABASE_URL`.

**Rule: Prefer fixtures (`client`, `auth_client`, `app_context`) over re-instantiating the app in each test.**

**Rule: Name tests `test_<unit>_<behavior>`** so failures read as sentences.

---

## Related Standards

- **Code Quality**: `core/standards/code-quality.md` (general quality standards)
- **Security Patterns**: `core/standards/security-patterns.md` (input validation, SQL injection, secrets)
- **Test Coverage**: `core/standards/test-coverage.md` (testing standards)
- **API Design**: `development/principles/api-design.md` (endpoint design)

---

**Version**: 1.0.0
**Last Updated**: 2026-06-24
**Maintainer**: O(1) Prep / OpenAgents Control

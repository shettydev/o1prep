# Contributing

## Architecture

### Tech Stack

**Backend**: Flask 3.0+, OpenAI GPT-4o, OpenAI Realtime API, PyYAML

**Frontend**: Vanilla JavaScript, CodeMirror 5 (editor), Marked.js (Markdown), KaTeX (math rendering), WebRTC (voice transport)

**Storage**: PostgreSQL (via SQLAlchemy + Flask-Migrate). Problems are seeded from the canonical YAML files in `problems/`; interview sessions and user accounts live in the database. Run Postgres locally with `docker compose up -d`.

**Auth**: Flask-Login with email/password accounts (passwords hashed via `werkzeug.security`). Sessions and history are scoped per user.

### File Structure

```
o1prep/
├── app.py                   # Flask app factory (db, login, blueprints)
├── config.py                # Centralized settings (DATABASE_URL, models, etc.)
├── docker-compose.yml       # Local PostgreSQL service
├── requirements.txt
├── migrations/              # Alembic (Flask-Migrate) migration scripts
├── services/                # Business logic layer
│   ├── ai.py                # OpenAI client + streaming helpers
│   ├── extensions.py        # SQLAlchemy / LoginManager / Migrate singletons
│   ├── models.py            # SQLAlchemy models (Problem, User, Session, ...)
│   ├── sessions.py          # Session persistence (DB, per-user)
│   ├── problems.py          # DB-backed problem access + YAML seeding
│   ├── db.py                # Problem agnostic/per-language split helpers
│   └── code_runner.py       # Python code execution sandbox
├── routes/                  # Flask Blueprints (HTTP layer)
│   ├── auth.py              # Register / login / logout
│   ├── sessions.py          # Session CRUD, chat, transcript routes
│   ├── problems.py          # Problem list/detail routes
│   ├── code.py              # Code execution routes
│   ├── realtime.py          # Voice WebRTC proxy
│   └── research.py          # Study/tutor chat route
├── scripts/
│   └── seed_problems.py     # Seed the database from problem YAMLs
├── tests/                   # pytest suite (code runner, problems, DB, schema)
├── templates/
│   └── index.html           # Single-page app shell
├── static/                  # Flask-served app assets
│   ├── js/
│   │   ├── state.js         # Global state variables
│   │   ├── utils.js         # Shared utilities (SSE reader, resizer, markdown)
│   │   ├── problems.js      # Problem rendering, filtering, command palette
│   │   ├── sessions.js      # Session list, history drawer, progress
│   │   ├── editor.js        # CodeMirror setup, output panel, run/test
│   │   ├── interview.js     # Chat, streaming, messages, timer
│   │   ├── voice.js         # WebRTC, data channel, transcript
│   │   ├── study.js         # Study view, research chat, tutor sidebar
│   │   └── init.js          # DOMContentLoaded init, keyboard shortcuts
│   ├── style.css
│   └── favicon.*
├── docs/                    # Documentation assets (not served by Flask)
│   ├── banner.svg
│   ├── logo.png
│   └── screenshots/         # README screenshots
├── prompts/                 # LLM system prompts
├── problems/                # 150+ YAML problem definitions
│   ├── 01-lru-cache.yaml
│   └── ...
├── user_data/               # (legacy local data; sessions now live in the DB)
└── .env                     # API key (git-ignored)
```

---

## Development Setup

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

cp .env.example .env          # set DATABASE_URL and SECRET_KEY
docker compose up -d          # start PostgreSQL (host port 5433)
flask db upgrade              # create tables (FLASK_APP=app)
python scripts/seed_problems.py   # load problems from YAML
python app.py
```

### Running tests

Tests run against PostgreSQL (a dedicated `o1prep_test` database is created
automatically), so make sure `docker compose up -d` is running first:

```bash
pytest
```

The suite covers the code-execution sandbox, problem loading + DB round-trips,
authentication and per-user session scoping, and a schema check that validates
**every** problem YAML. A malformed problem file fails `pytest` (and CI) with a
clear message, so run it before you push.

### Database migrations

Models live in `services/models.py`. After changing a model, generate and apply
a migration with Flask-Migrate (Alembic):

```bash
flask db migrate -m "describe your change"
flask db upgrade
```

### Linting

```bash
ruff check .          # report issues
ruff check --fix .    # auto-fix import order, etc.
```

CI (GitHub Actions) spins up a PostgreSQL service and runs `ruff check .` and
`pytest` on every push and pull request across Python 3.11 and 3.12. Please make
sure both pass locally first.

---

## Adding Your Own Problems

Add a YAML file to the `problems/` directory following this format:

```yaml
id: 133
title: "My Problem"
category: "stateful"
difficulty: "Medium"
summary: "One-line description."

scenario: |
  Real-world context...

alt_scenarios:
  - "Alternative context..."

description: |
  Formal problem statement...

constraints:
  - "Operations must run in O(1) time"

examples:
  - input: |
      obj = MyClass()
      obj.do_thing(1)
    output: |
      # returns 1

starter_code: |
  class MyClass:
      def do_thing(self, x):
          pass

key_skills:
  - "hash map"

follow_ups:
  - "What if inputs can be negative?"

explanation: |
  Explanation with complexity analysis...

test_type: "class" # or "function"
class_name: "MyClass"

test_cases:
  - label: "basic case"
    init_args: []
    ops: [do_thing]
    op_args:
      - [1]
    expected: [1]
```

Problems are stored in PostgreSQL, seeded from these YAML files. After adding,
editing, or deleting a problem file, re-seed the database:

```bash
python scripts/seed_problems.py            # upsert all problems
python scripts/seed_problems.py --force    # also remove problems deleted from disk
```

The database tables must exist first (`flask db upgrade`). The `pytest` schema
check validates every YAML file before it reaches the DB.

---

## Questions

Open an issue or reach out on [LinkedIn](https://github.com/shettydev).

# Architecture

![System Architecture](system-architecture.png)

## Overview

O(1) Prep is a single-page Flask application that simulates technical coding interviews using OpenAI's GPT-4o. The browser handles all UI through vanilla JavaScript modules, the Flask server provides a JSON/SSE API backed by PostgreSQL, and OpenAI powers both the text interviewer (via Chat Completions) and the voice interviewer (via the Realtime API over WebRTC).

The app is a multi-user web application backed by PostgreSQL (via SQLAlchemy + Flask-Migrate). Problems are seeded into the database from the canonical YAML files in `problems/`; interview sessions and user accounts live in the database, scoped per user. Authentication is email/password via Flask-Login. It can be self-hosted (run Postgres with the included `docker-compose.yml`) or deployed as a hosted service.

---

## System Layers

### Browser (Single-Page App)

The frontend is a single HTML page (`templates/index.html`) with nine JavaScript modules loaded in dependency order. There is no build step, no bundler, and no framework — just vanilla JS with global scope sharing.

| Module | Responsibility |
|--------|---------------|
| `state.js` | Mutable global state: current session, timer, filters, CodeMirror ref, WebRTC handles, transcript buffers |
| `utils.js` | Shared utilities: `escapeHtml`, `renderMarkdown` (Marked + KaTeX), `readSSEStream` (reusable SSE event reader), `buildTestResultsHtml`, `initResizer` (drag-to-resize panel factory) |
| `problems.js` | Problem list UI: fetch, filter, sort, render cards, command palette (`Cmd+K`), category/difficulty filtering |
| `sessions.js` | Session history: fetch past sessions, render history drawer, progress tracking by category, delete sessions |
| `editor.js` | Code editor: CodeMirror 5 (Python mode), auto-save on change, output panel, `POST /api/run` for execution, `POST /api/sessions/:id/run-tests` for test runs |
| `interview.js` | Interview flow: view switching, mode selection (text/voice), start/resume/end sessions, text chat with SSE streaming, code submission, timer, rating detection |
| `voice.js` | Voice mode: `getUserMedia`, `RTCPeerConnection` setup, data channel events, mic toggle, transcript accumulation, `POST .../transcript` to persist voice history |
| `study.js` | Study mode: problem detail rendering, research chat via SSE, tutor sidebar for mid-interview hints |
| `init.js` | Bootstrap: `DOMContentLoaded` wiring, CodeMirror init, filter/search/sort listeners, resizer hooks, API key check, keyboard shortcuts |

**Script load order:** `state` → `utils` → `problems` → `sessions` → `editor` → `interview` → `voice` → `study` → `init`

**External libraries** (loaded from CDN):
- CodeMirror 5.65 — Python editor with bracket matching and auto-close
- Marked 12.0 — Markdown rendering for chat messages
- KaTeX 0.16 — LaTeX math rendering inline and block

### Flask Server

The server is a thin routing layer that delegates all business logic to a `services/` package. `app.py` is a ~20-line factory that registers five Blueprints.

**Entry point:** `app.py` creates the Flask instance, mounts the index route, registers all blueprints from `routes/`, and starts the dev server using settings from `config.py`.

**Configuration:** `config.py` centralizes all settings — model names, temperature/token limits, directory paths, SSE headers, and all system prompts loaded from `prompts/` at import time.

### Routes (HTTP Layer)

Each Blueprint owns a group of related endpoints. Routes handle request parsing, response formatting, and SSE streaming — they do not contain business logic.

| Blueprint | Key Endpoints | Purpose |
|-----------|--------------|---------|
| `routes/sessions.py` | `GET /api/check-key`, `GET/POST /api/sessions`, `POST .../chat`, `POST .../start`, `POST .../end`, `POST .../run-tests`, `PUT .../code`, `POST .../transcript` | Full session lifecycle: create, load, chat (SSE streaming), start interview (SSE), submit code with test execution, save transcripts, end with evaluation |
| `routes/problems.py` | `GET /api/problems`, `GET /api/problems/:id` | Problem listing (with optional category filter) and full problem detail |
| `routes/code.py` | `POST /api/run` | Ad-hoc code execution outside of an interview (editor "Run" button) |
| `routes/realtime.py` | `POST /api/realtime/session` | WebRTC SDP proxy: accepts browser's SDP offer, forwards it to OpenAI's Realtime API with session config, returns SDP answer |
| `routes/research.py` | `POST /api/research/chat` | Study/tutor streaming chat via SSE |

### Services (Business Logic)

Services encapsulate all domain logic and external integrations. Routes import them as namespaces (`ai.get_client()`, `sessions.load()`, etc.).

| Service | Responsibility |
|---------|---------------|
| `services/ai.py` | OpenAI client singleton, streaming chat completions (`stream_chat`), SSE response generator (`sse_stream`), test case generation from conversation context (`generate_test_cases`) |
| `services/sessions.py` | DB CRUD for interview sessions — `create`, `load`, `save`, `delete`, `list_all`, all scoped by `user_id`. Each session is a row with its document in a JSONB column |
| `services/models.py` | SQLAlchemy models: `Problem`, `ProblemLanguage`, `User`, `Session` |
| `services/extensions.py` | Flask extension singletons: SQLAlchemy `db`, `login_manager`, `migrate` |
| `services/problems.py` | Problem access: DB-backed loading (`load_all`, `get_by_id`), YAML seeding (`seed`, `ensure_seeded`), serialization for list/detail views, and context builders for system prompts (`build_problem_block`, `build_study_context`) |
| `services/db.py` | Pure helpers for the problem agnostic/per-language split used to store and reconstruct problem dicts |
| `services/languages.py` | Language registry — single source of truth for the supported languages (id, label, CodeMirror mode, file extension) with `is_supported`/`resolve`/`get`/`all_languages` |
| `services/runners/` | Per-language code execution. `base.Runner` defines the interface (`run_program`, `run_tests`) and shared subprocess/parsing helpers; `PythonRunner`, `JavaScriptRunner`, and `TypeScriptRunner` each own their harness. `get_runner(language)` returns the runner for a validated language id. Every runner emits the same `__RESULTS__<json>` shape so the frontend renderer is language-agnostic |
| `services/code_runner.py` | Facade over the runners: `run`/`run_class` are Python-only shims kept for back-compat; `format_results_for_context` renders a run result into the interview transcript |

---

## Communication Patterns

### 1. JSON over fetch

Standard request-response for CRUD operations: loading problems, managing sessions, saving code, checking the API key. All responses are `application/json`.

### 2. Server-Sent Events (SSE)

Used for streaming interviewer and tutor responses in real time. The frontend's `readSSEStream` utility reads from a `fetch` response body, parsing `data:` lines with this protocol:

| Event | Payload | Meaning |
|-------|---------|---------|
| Content | `{"content": "..."}` | Incremental text chunk from the LLM |
| Test results | `{"test_results": {...}}` | Code execution results (passed/failed/errors) |
| Done | `{"done": true}` | Stream complete |
| Error | `{"error": "..."}` | Something went wrong |

SSE is used by three endpoints: `/api/sessions/:id/chat`, `/api/sessions/:id/start`, and `/api/research/chat`.

### 3. WebRTC (Voice Mode)

Voice interviews bypass the Flask server for audio. The flow:

1. Browser creates an `RTCPeerConnection`, adds a mic audio track, and opens a data channel named `oai-events`
2. Browser generates an SDP offer and sends it as the raw body of `POST /api/realtime/session`
3. Flask's `realtime.py` forwards the offer to OpenAI's Realtime API along with session configuration (model, voice, VAD settings, system prompt)
4. OpenAI returns an SDP answer; Flask passes it back to the browser
5. After the peer connection is established, audio flows directly between the browser and OpenAI — the Flask server is no longer in the path
6. The data channel carries structured events: transcript deltas, user speech transcription, and commands like `conversation.item.create` and `response.create`
7. Accumulated transcripts are periodically saved back to the session via `POST .../transcript`

---

## Data Model

### Problems (`problems/*.yaml` → PostgreSQL)

The canonical source is 150+ YAML files, each defining a complete interview problem:

```yaml
id: 1
title: "LRU Cache"
category: "stateful"
difficulty: "Medium"
summary: "One-line description"
scenario: "Real-world engineering context..."
description: "Formal problem statement..."
constraints: [...]
examples: [...]
starter_code: "..."
key_skills: [...]
follow_ups: [...]
explanation: "Full solution walkthrough..."
test_type: "class"          # or "function"
class_name: "LRUCache"      # if class-based
function_name: "lru_cache"   # if function-based
test_cases: [...]            # pre-written test cases
```

At runtime, problems are read from PostgreSQL, not from disk. The YAML files are seeded into the database via `python scripts/seed_problems.py` (after the schema is created with `flask db upgrade`). The schema is split across two tables so additional programming languages can be added without a migration:

- **`problems`** — language-agnostic fields (title, scenario, constraints, examples, explanation, …) as a JSON blob plus indexed `title`/`category`/`difficulty` columns.
- **`problem_languages`** — per-language fields (`starter_code`, `test_type`, `class_name`/`function_name`, `test_cases`) keyed by `(problem_id, language)`. Only `python` rows are seeded today.

A full problem dict is reconstructed by merging the agnostic row with one language row, so `load_all()` / `get_by_id()` return the same shape the rest of the app expects.

### Users (`users` table)

Email/password accounts (passwords hashed with `werkzeug.security`). Flask-Login manages signed session cookies. Sessions and history are scoped to a `user_id`; reads and deletes enforce ownership.

### Sessions (`sessions` table)

Each interview session is a row owned by a user (`user_id` FK), with its mutable document stored in a JSONB `data` column of this shape:

```json
{
  "id": "a1b2c3d4",
  "user_id": 1,
  "focus": "stateful",
  "mode": "text",
  "status": "active",
  "problem_id": 1,
  "problem_title": "LRU Cache",
  "rating": null,
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "code": "class LRUCache:\n    ..."
}
```

The full message history (including the system prompt) is stored and sent to OpenAI on every chat turn. The `rating` field is set when the interviewer's response contains a rating keyword (Strong Hire, No Hire, etc.).

### Prompts (`prompts/`)

| File | Config Key | Used For |
|------|-----------|----------|
| `interviewer.txt` | `SYSTEM_PROMPT` | Base system prompt for text interviews |
| `session_config.txt` | `SESSION_CONFIG` | Appended to interviewer prompt; also included in voice session instructions |
| `focus_prompts.json` | `FOCUS_PROMPTS` | Category-specific guidance when no specific problem is selected |
| `test_generation.txt` | `TEST_GEN_PROMPT` | Prompt for `generate_test_cases` — asks GPT to produce function name + test case JSON |
| `voice_interviewer.txt` | `VOICE_SYSTEM_PROMPT` | Voice-specific interviewer behavior (conciseness, pacing) |
| `tutor.txt` | `TUTOR_SYSTEM_PROMPT` | Study mode and mid-interview tutor — helps without giving away solutions |

All prompts are loaded once at import time by `config.py`.

---

## Code Execution

When a user runs code or submits it during an interview, the execution follows one of two paths. Both resolve the session's language to a runner via `services.runners.get_runner(language)`, so Python, JavaScript, and TypeScript share the same flow.

### Ad-hoc Run (`POST /api/run`)

The request's `language` selects a runner; the user's raw code is written to a temp file and executed via `run_program()` (Python through `[sys.executable]`, JS through `[node]`, TS through `[tsx]` — always an argument list, never `shell=True`) with a timeout. Stdout and stderr are captured and returned. This is the editor's "Run" button outside of test context.

### Test Execution (`POST /api/sessions/:id/run-tests`)

1. **Language-specific problem**: The session's language picks both the runner and the matching problem variant, so the function/class name and `test_cases` align with the runtime the candidate is writing in
2. **Pre-canned tests first**: If the problem variant has `test_cases`, `get_runner(language).run_tests()` is called directly with those cases
3. **AI-generated tests as fallback**: If no YAML tests exist (random topic interviews), `ai.generate_test_cases()` asks GPT to produce a function name and test cases from the conversation history, then runs them through the same runner
4. **Harness construction**: each runner builds a temporary file that loads the user's code, iterates over test cases, catches exceptions, and prints structured JSON results to stdout via a `__RESULTS__` marker. The JS/TS harness mirrors the Python contract (deep equality, awaited async, `__ref__`/`__sleep__`, `expected_error` matching) so results render identically
5. **Subprocess isolation**: the harness runs in a separate process with `config.CODE_TIMEOUT` (default 5 seconds). This provides process isolation and timeout protection, but is not a security sandbox

---

## Interview Flow (Text Mode)

```
User clicks "Practice"
    → POST /api/sessions (create session with system prompt + problem context)
    → POST /api/sessions/:id/start (SSE: interviewer opens with the problem)
    
User sends messages
    → POST /api/sessions/:id/chat (SSE: message appended, streamed reply)
    
User submits code
    → POST /api/sessions/:id/run-tests (runs tests, results injected into chat)
    → POST /api/sessions/:id/chat (SSE: interviewer responds to test results)
    
User ends interview
    → POST /api/sessions/:id/end (evaluation prompt added, SSE: final debrief)
```

## Interview Flow (Voice Mode)

```
User clicks "Practice" with Voice mode selected
    → POST /api/sessions (create session)
    → POST /api/realtime/session (SDP exchange, WebRTC established)
    → Data channel opens: synthetic kickoff message + response.create
    
User speaks
    → Audio flows directly to OpenAI via WebRTC
    → Interviewer responds via audio
    → Transcripts arrive via data channel events
    
User submits code
    → conversation.item.create sent via data channel with code + test results
    → response.create triggers interviewer reaction via audio
    
User ends interview
    → POST /api/sessions/:id/transcript (save accumulated transcript)
    → WebRTC connection closed, mic stream stopped
```

---

## Directory Structure

```
o1prep/
├── backend/                 # Python API (Flask) — run everything from here
│   ├── app.py               # Flask app factory, index route, blueprint registration
│   ├── config.py            # All settings, model names, prompt loading
│   ├── services/            # Business logic
│   │   ├── ai.py            # OpenAI client, streaming, test generation
│   │   ├── sessions.py      # Session file I/O
│   │   ├── problems.py      # DB-backed problem access + YAML seeding
│   │   ├── db.py            # Problem agnostic/per-language split helpers
│   │   ├── models.py        # SQLAlchemy models (Problem, User, Session, ...)
│   │   ├── extensions.py    # db / login_manager / migrate singletons
│   │   └── code_runner.py   # Subprocess code execution
│   ├── routes/              # HTTP layer (Flask Blueprints)
│   │   ├── auth.py          # Register / login / logout
│   │   ├── sessions.py      # Session CRUD, chat, code, transcript endpoints
│   │   ├── problems.py      # Problem list and detail endpoints
│   │   ├── code.py          # Ad-hoc code execution endpoint
│   │   ├── realtime.py      # WebRTC SDP proxy for voice mode
│   │   └── research.py      # Study/tutor chat endpoint
│   ├── migrations/          # Alembic (Flask-Migrate) migrations
│   ├── scripts/
│   │   └── seed_problems.py # Seed the database from the problem YAMLs
│   ├── templates/           # Legacy server-rendered shell (removed once the
│   │   └── index.html       #   Next.js frontend reaches parity)
│   ├── static/              # Legacy Flask-served app assets (same lifecycle)
│   │   ├── style.css
│   │   ├── favicon.*
│   │   └── js/              # Legacy vanilla-JS modules (~2400 lines total)
│   ├── prompts/             # LLM system prompts (6 files)
│   ├── problems/            # 150+ YAML problem definitions (canonical source)
│   ├── tests/               # pytest suite (code runner, problems, DB, schema)
│   └── .env                 # DATABASE_URL, SECRET_KEY, OpenAI API key (git-ignored)
├── frontend/                # Next.js + TypeScript web client (consumes the API)
├── docker-compose.yml       # Local PostgreSQL service (shared infra)
└── docs/                    # Documentation and screenshots
```

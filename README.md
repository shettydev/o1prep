![O(1) Prep banner](docs/banner.svg)

<div align="center">

[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue?logo=python&logoColor=white)](https://www.python.org/downloads/)
[![Next.js](https://img.shields.io/badge/next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgres-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![AI: Claude / OpenAI / OpenRouter](https://img.shields.io/badge/AI-Claude%20%2F%20OpenAI%20%2F%20OpenRouter-ffb000)]()
[![Self-hostable](https://img.shields.io/badge/self--hostable-brightgreen?logo=docker&logoColor=white)]()

</div>

---

## Why O(1) Prep

Most interview platforms are puzzle grinders. O(1) Prep puts you in a real interview.

- **A back-and-forth, not a quiz** - the interviewer follows up, pushes back on your reasoning, and adds constraints mid-session just like a real one would
- **Feedback that actually tells you something** - you get written scores and specific critique on your approach, code quality, communication, and tradeoffs - not just pass/fail
- **Your own account** - sign in and your sessions, history, and code are saved to your account in the app's database; self-host it and the data stays on infrastructure you control
- **Bring your own engine** - runs on your local Claude Code CLI by default (no API key), or point it at OpenAI or OpenRouter (one key, hundreds of models)
- **150+ problems grounded in real engineering** - each one has a real-world scenario, not just "given an array..."

---

## Quick Start

The repository is a monorepo: the Python API lives in **`backend/`**, the web client in **`frontend/`**, and shared infrastructure (`docker-compose.yml`) at the root.

```bash
git clone <repo-url>
cd o1prep
docker compose up -d                  # start PostgreSQL (from the repo root)

cd backend                            # the Python API lives here
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and set your values. By default the AI engine is your local **Claude Code CLI** — no API key, just run `claude` once to sign in. Set `AI_PROVIDER` to `openai` or `openrouter` to use those instead (see `.env.example` for their keys).

```
DATABASE_URL=postgresql+psycopg://o1prep:o1prep@localhost:5433/o1prep
SECRET_KEY=change-me
AI_PROVIDER=claude              # claude (default) | openai | openrouter
# OPENAI_API_KEY=sk-...         # only when AI_PROVIDER=openai
# OPENROUTER_API_KEY=sk-or-...  # only when AI_PROVIDER=openrouter
```

Create the schema, load the problems, and run — all from `backend/`:

```bash
export FLASK_APP=app
flask db upgrade                      # create tables
python scripts/seed_problems.py       # load the problem library
python app.py
```

This serves the API (and the legacy server-rendered UI) on **http://localhost:5000**.

### Frontend (Next.js)

The web client is a separate Next.js app in `frontend/` that talks to the Flask
API. In a second terminal:

```bash
cd frontend
pnpm install
pnpm dev                              # http://localhost:3000
```

Open **http://localhost:3000**. The dev server proxies `/api/*` to Flask on
`127.0.0.1:5000` (see `frontend/next.config.ts`), so the session cookie stays
same-origin and auth works with no CORS setup. Point it elsewhere with
`API_ORIGIN=http://host:port pnpm dev`.

> On macOS, the AirPlay Receiver squats on port 5000 over IPv6 — the proxy
> targets `127.0.0.1` (IPv4) specifically to avoid it. If you change the Flask
> port, update `API_ORIGIN`.

> **Prerequisites:** Python 3.11+, Node.js 20+ and [pnpm](https://pnpm.io), Docker (for PostgreSQL), an AI engine (the Claude Code CLI needs no key; OpenAI/OpenRouter need an API key), and a modern browser (Chrome/Firefox/Safari).

---

## Table of Contents

- [Picking a Problem](#picking-a-problem)
- [Study Mode](#study-mode)
- [Running an Interview](#running-an-interview)
- [Voice Interviews](#voice-interviews)
- [Code Editor & Execution](#code-editor--execution)
- [How the Interviewer Works](#how-the-interviewer-works)
- [Your History & Progress](#your-history--progress)
- [Problem Library](#problem-library)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [FAQ](#faq)
- [Contributing](CONTRIBUTING.md)
- [License & Attribution](#license--attribution)

---

## Picking a Problem

![Landing page showing the problem list with filters](docs/screenshots/LandingPage-ProblemList.png)

Browse and filter 150+ problems to find what you want to practice. Filters on the left let you narrow by category, difficulty, or whether you've attempted a problem before. Status dots on each card show how you've done - green for a hire signal, yellow for mixed, red for no hire.

Not sure what to pick? Hit **Surprise Me** to start a random interview from whatever's currently visible.

### Filters

**Search** - Filters by title, summary, or skills. `Cmd+K` / `Ctrl+K` opens a full command palette.

**Category tabs** - Filter by topic: stateful, parsing, scheduling, search, streaming, infra, concurrency, api_design, syntax, arrays, strings, linked lists, trees, graphs, dynamic programming, backtracking, debugging.

**Difficulty pills** - Multi-select: Easy, Medium, Hard.

**Warm Up toggle** - Shows only shorter, lower-stakes problems.

**Sort tabs** - Default, Easiest first, Hardest first, Not attempted, A-Z.

### From each problem you can

- Click **Study** to read it in full and chat with an AI tutor before committing to an interview
- Click **Practice** to jump straight into a mock interview
- Click a skill tag to filter the list to related problems

### Command Palette (`Cmd+K` / `Ctrl+K`)

![Command palette for searching problems](docs/screenshots/EasilySearchProblems.png)

Fuzzy search across all problem titles, summaries, skills, and categories. `Enter` to start Practice, `Cmd+Enter` / `Ctrl+Enter` to open Study Mode, `Escape` to close.

---

## Study Mode

Read a problem fully and chat with an AI tutor before you practice - useful when a topic is unfamiliar or you want to think through approaches first.

![Study mode with problem details and research chat](docs/screenshots/StudyMode.png)

Two panels side by side — drag the divider to resize the tutor chat, and its width is remembered. The left panel has the full problem - scenario, constraints, examples, key skills, and follow-up challenges. The right panel is a tutor chat where you can ask anything about the problem without being handed the solution.

Good things to ask the tutor:

- "What data structure would work for O(1) lookup and O(1) deletion?"
- "What's the difference between BFS and DFS here?"
- "What edge cases should I consider?"

When you're ready, go back and hit **Practice** to start the interview.

---

## Running an Interview

![Interview mode with chat, code editor, test results, and tutor sidebar](docs/screenshots/PracticeAndEvaluateResult.png)

Three panels: the interviewer chat on the left, your code editor in the center, and an optional tutor sidebar on the right. On a narrow screen, tabs switch between the chat and the editor.

The interview runs like a real one - you'll clarify the problem, talk through your approach, then implement. The interviewer watches what you submit and responds to it. You can submit code multiple times; each submission gets reviewed.

### Submitting code

1. Write your solution in the editor
2. Click **Submit Code**
3. Your code runs against test cases automatically
4. Results appear in the chat (X/Y passed, with per-test details)
5. The interviewer reads the results and continues from there

### Stuck mid-interview?

Click **Tutor** in the top bar to open a hint sidebar. It runs separately from the interview conversation so you can ask for conceptual help without disrupting the flow. It won't give you the answer directly.

### At the end

The interviewer gives a structured debrief with a hire/no-hire rating, scores across dimensions like code quality, communication, and problem framing, and specific written feedback on what was strong, what was missing, and what a better answer would have looked like.

---

## Voice Interviews

> **Status: temporarily unavailable in the web client.** Voice mode is being reworked to route through a natural-sounding neural TTS provider — the browser's built-in speech synthesis sounded too robotic for a realistic interview. The pipeline (browser speech-to-text → your chosen LLM → text-to-speech) is in place behind the scenes and will return once a good TTS voice is wired in.

The intent: switch to **Voice** mode before starting and talk through your solution out loud — your speech is transcribed live, the interviewer replies through your speakers, and the whole session is saved to your history just like a text one, all while you can still write and **Submit Code**.

---

## Code Editor & Execution

A CodeMirror editor (Python, JavaScript, or TypeScript, picked from the language selector) with syntax highlighting, auto-closing brackets, line numbers, and smart indentation. Switching language loads that language's starter code and runs against its test suite. Your code is auto-saved as you type - you won't lose it if you navigate away.

| Button    | What it does                                                       |
| --------- | ------------------------------------------------------------------ |
| Run       | Executes your code and shows stdout/stderr                         |
| Run Tests | Runs test cases against your solution and shows pass/fail per case |
| Clear     | Clears the editor (asks for confirmation)                          |

> **Note:** Run Tests only works during an active interview - it uses the problem context to generate cases. Run Code works anytime.

---

## How the Interviewer Works

The interviewer runs a structured session, not a quiz. It asks you to clarify the problem, discuss your approach before you code, and then works through the implementation with you - adding constraints, asking follow-up questions, and adjusting based on what you say.

### What the session looks like

| Phase          | What happens                                              |
| -------------- | --------------------------------------------------------- |
| Opening        | Problem is presented; you ask clarifying questions        |
| Approach       | You walk through your plan before writing any code        |
| Implementation | You code; the interviewer interjects and follows up       |
| Follow-ups     | Harder constraints or variations if things are going well |
| Testing        | You discuss edge cases and test coverage                  |
| Debrief        | Structured feedback and a hire signal                     |

### Ratings

| Rating       | What it means                 |
| ------------ | ----------------------------- |
| Strong Hire  | Exceptional performance       |
| Hire         | Solid; meets the bar          |
| Lean Hire    | Good with some gaps           |
| Mixed        | Some strengths, some concerns |
| Lean No Hire | Concerns outweigh strengths   |
| No Hire      | Did not meet the bar          |

Written feedback covers: what was strongest, what would be a concern, what a better answer would have looked like, and 3 concrete areas to work on next.

---

## Your History & Progress

### Picking up where you left off

Click **History** in the top bar to see all past sessions. Click any entry to reload it - your messages and last submitted code are fully restored. You can continue the conversation from exactly where you stopped.

### Tracking what you've covered

Click the **X / Y done** chip to see your progress by category.

![Progress drawer showing completion by category](docs/screenshots/TrackProgress.png)

Each category shows a progress bar and lists the problems you've attempted with their ratings. Status dots on problem cards update as you practice:

- Empty - not attempted
- Green - Hire or Strong Hire
- Yellow - Lean Hire or Mixed
- Red - Lean No Hire or No Hire

---

## Problem Library

150+ problems across 18+ categories:

| Category                | Focus                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| **Stateful**            | LRU caches, time-based KV stores, undo/redo buffers, versioned state        |
| **Parsing**             | Config parsers, expression evaluators, template engines, dependency graphs  |
| **Scheduling**          | Task schedulers, rate limiters, job queues, interval merging                |
| **Search**              | File crawlers, in-memory search indexes, shortest path, autocomplete        |
| **Streaming**           | Moving averages, top-K frequent items, deduplication, windowed aggregation  |
| **Infra**               | Connection pools, retry with backoff, batch coalescing, circuit breakers    |
| **Concurrency**         | Thread-safe queues, worker pools, consistent hashing, rate-limited fetchers |
| **API Design**          | Cursor pagination, query builders, plugin registries, diff/patch engines    |
| **Python Syntax**       | Loops, list comprehensions, slicing, built-in idioms                        |
| **Arrays**              | Two sum, prefix sums, sliding window, binary search                         |
| **Strings**             | Reversal, anagram detection, longest common prefix, pattern matching        |
| **Linked Lists**        | Reverse, merge sorted lists, cycle detection, nth from end                  |
| **Trees**               | Level-order traversal, validate BST, lowest common ancestor, max path sum   |
| **Graphs**              | Number of islands, shortest path, topological sort, cycle detection         |
| **Dynamic Programming** | Coin change, edit distance, longest increasing subsequence, knapsack        |
| **Backtracking**        | Subsets, permutations, N-Queens, word search                                |
| **Debugging**           | Find and fix bugs in broken implementations                                 |

### Each problem includes

- A real-world engineering scenario explaining why this problem comes up
- Alternative contexts that use the same pattern
- Formal problem statement and constraints
- 2-3 worked examples with input/output
- Key skills and follow-up challenges
- Starter code, pre-written test cases, and a full solution explanation with complexity analysis

---

## Keyboard Shortcuts

| Shortcut                             | Action                             |
| ------------------------------------ | ---------------------------------- |
| `Cmd+K` / `Ctrl+K`                   | Open command palette               |
| `Escape`                             | Close palette, drawers, or modals  |
| `↑` / `↓` (palette)                  | Navigate results                   |
| `Enter` (palette)                    | Start Practice on selected problem |
| `Cmd+Enter` / `Ctrl+Enter` (palette) | Open Study Mode                    |
| `Enter` (interview chat)             | Send message                       |
| `Shift+Enter`                        | Insert newline                     |
| `Tab` (editor)                       | Insert 4 spaces                    |

---

## FAQ

**Do I need a paid AI account?**
Not necessarily. The default engine is your local **Claude Code CLI**, which runs on your existing Claude sign-in with no separate API key. If you prefer, set `AI_PROVIDER=openai` or `openrouter` and supply that key instead.

**How much does each interview cost?**
On the default Claude CLI engine it draws on your Claude usage rather than a per-call charge. On OpenAI or OpenRouter it's pay-per-token — roughly $0.10-$0.50 per text session depending on length and the model you pick.

**Can I use other programming languages?**
Yes. Pick Python or JavaScript from the language selector in the editor; the code
runner and test harness support both. JavaScript runs through Node.js (install
it, or set `NODE_BIN`). TypeScript is also wired up (via `tsx`/`TS_CMD`).
Problems are translated per language, so the selector offers whichever languages
a given problem has been authored for.

**Can I pick a different model?**
Yes. The **Settings** (gear) menu lets you choose the model and reasoning effort for new interviews and tutor chats. On OpenRouter you can search its live catalog of hundreds of models; on Claude and OpenAI you pick from that provider's list.

**What happens if I close the browser mid-interview?**
The session is auto-saved every time you send a message or submit code. Open History to resume from where you left off.

**Can I retake the same problem?**
Yes. Multiple sessions on the same problem are tracked separately. The status dot reflects your best performance.

**Why is the feedback so detailed and critical?**
That's what makes it useful. Vague feedback doesn't help you improve. The debrief is written the way a hiring committee would actually talk about your performance.

**Where is my data stored?**
In the application's PostgreSQL database, scoped to your account. If you self-host, that database runs on infrastructure you control. Your messages and code are sent to your configured AI provider (Claude, OpenAI, or OpenRouter) to power the interviewer.

**Can I add my own problems?**
Yes - see [CONTRIBUTING.md](CONTRIBUTING.md) for the full problem YAML format.

---

## License & Attribution

O(1) Prep is released under the [MIT License](LICENSE).

This project is a fork of [codingprep](https://github.com/amrutha97/codingprep) by [Amrutha Gujjar](https://github.com/amrutha97) (MIT-licensed at the time of forking), with substantial modifications. The original work's copyright notice is preserved in the [LICENSE](LICENSE) file, as required by the MIT license. The upstream project has since been made closed-source; this fork continues independently from the MIT-era snapshot and is not affiliated with or endorsed by the original author.

---

## Contact

Questions or feedback? Reach out on [LinkedIn](https://www.linkedin.com/in/shettydev/).

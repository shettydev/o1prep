"""Claude provider — drives the locally installed Claude Code CLI.

This uses the user's existing Claude Code login (Pro/Max subscription or an
API key already configured in the CLI). The app never sees or stores any
credential: it spawns `claude` in headless print mode and the CLI authenticates
itself from `~/.claude` / the OS keychain.

Two flags keep interview sessions clean and cheap:
  --setting-sources ''  -> don't load the user's global settings, plugins, or
                           hooks (otherwise SessionStart hooks inject thousands
                           of tokens of unrelated context into every turn).
  --tools ''            -> disable all tools, so the model can't touch the
                           filesystem or run commands; it's a pure chat engine.

`--system-prompt` fully replaces Claude Code's default agent prompt, so the
model runs purely as our interviewer/tutor persona.

Note: the CLI exposes no temperature or max_tokens knobs, so those arguments are
accepted for signature parity with the OpenAI provider but ignored.
"""

import json
import os
import re
import shutil
import subprocess
import threading
import time

import config

# Matches the CLI's not-logged-in / bad-credential result text.
_LOGIN_ERR = re.compile(r"(not logged in|please run /login|invalid api key|/login\b)", re.I)

# Appended to every system prompt. We render prior turns as a labelled
# transcript inside one user message, so this stops the model echoing a
# "Assistant:" prefix back into its reply.
_REPLY_GUARD = (
    "\n\nReply with only your next message as the assistant. Do not prefix your "
    "reply with a speaker label such as 'Assistant:'."
)


# Models and reasoning-effort levels selectable from the UI.
MODELS = [
    {"id": "sonnet", "label": "Sonnet — balanced"},
    {"id": "opus", "label": "Opus — most capable"},
    {"id": "haiku", "label": "Haiku — fastest"},
]
EFFORTS = ["low", "medium", "high", "max"]
SUPPORTS_EFFORT = True


def available():
    return shutil.which(config.CLAUDE_BIN) is not None


def default_model():
    return config.CLAUDE_MODEL


def default_effort():
    return config.CLAUDE_EFFORT


def valid_model(model):
    return any(m["id"] == model for m in MODELS)


def valid_effort(effort):
    return effort in EFFORTS


def get_client(model=None, effort=None):
    if not available():
        return None
    m = model if valid_model(model) else config.CLAUDE_MODEL
    e = effort if valid_effort(effort) else config.CLAUDE_EFFORT
    return ClaudeClient(m, e)


def _split_messages(messages):
    """Split OpenAI-style messages into (system_text, conversation_turns)."""
    system_parts = [m["content"] for m in messages if m.get("role") == "system"]
    convo = [m for m in messages if m.get("role") != "system"]
    return "\n\n".join(p for p in system_parts if p), convo


def _render_prompt(convo):
    """Flatten conversation turns into a single prompt string.

    The app re-sends the full history every turn (it's stateless from the
    model's side), so we render it as a labelled transcript. A lone user turn
    (e.g. the interview opener) is passed through verbatim.
    """
    if len(convo) == 1 and convo[0].get("role") == "user":
        return convo[0].get("content", "")
    lines = []
    for m in convo:
        label = "Assistant" if m.get("role") == "assistant" else "User"
        lines.append(f"{label}: {m.get('content', '')}")
    return "\n\n".join(lines)


def _result_text(out):
    """Pull the result text from `--output-format json` output, tolerating both
    the single-object form and the array form (which `--verbose` produces).
    Returns None on error or unparseable output."""
    try:
        data = json.loads(out)
    except (json.JSONDecodeError, TypeError):
        return None
    if isinstance(data, list):
        for item in reversed(data):
            if isinstance(item, dict) and item.get("type") == "result":
                return None if item.get("is_error") else (item.get("result") or "")
        return None
    if isinstance(data, dict):
        return None if data.get("is_error") else (data.get("result") or "")
    return None


def _extract_json_object(text):
    """Best-effort parse of a JSON object out of model text (Claude has no
    enforced JSON mode, so it may add fences or prose)."""
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    start = s.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(s[start : i + 1])
                except Exception:
                    return None
    return None


class ClaudeClient:
    def __init__(self, model=None, effort=None):
        self.model = model or config.CLAUDE_MODEL
        self.effort = effort or config.CLAUDE_EFFORT

    def _base_cmd(self, system, stream):
        cmd = [
            config.CLAUDE_BIN,
            "-p",
            "--model",
            self.model,
            "--max-turns",
            "1",
            "--setting-sources",
            "",
            "--tools",
            "",
            "--no-session-persistence",
            "--output-format",
            "stream-json" if stream else "json",
        ]
        if self.effort:
            cmd += ["--effort", self.effort]
        if stream:
            # stream-json output requires --verbose
            cmd += ["--verbose", "--include-partial-messages"]
        if system:
            cmd += ["--system-prompt", system + _REPLY_GUARD]
        return cmd

    def _popen(self, cmd):
        return subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            cwd=config.BASE_DIR,
            env=os.environ.copy(),
        )

    def _spawn_streaming(self, cmd, prompt):
        """Spawn for the streaming path, feeding stdin from a thread so a large
        prompt can't deadlock against an unread stdout pipe."""
        proc = self._popen(cmd)

        def _feed():
            try:
                proc.stdin.write(prompt)
                proc.stdin.close()
            except Exception:
                pass

        threading.Thread(target=_feed, daemon=True).start()
        return proc

    def stream_chat(self, messages, temperature=None, max_tokens=None):
        system, convo = _split_messages(messages)
        prompt = _render_prompt(convo)
        proc = self._spawn_streaming(self._base_cmd(system, stream=True), prompt)

        deadline = time.monotonic() + config.CLAUDE_TIMEOUT
        streamed = False
        final_text = ""
        try:
            for raw in proc.stdout:
                if time.monotonic() > deadline:
                    raise RuntimeError("Claude Code timed out.")
                line = raw.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                kind = obj.get("type")
                if kind == "stream_event":
                    event = obj.get("event", {})
                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta" and delta.get("text"):
                            streamed = True
                            yield delta["text"]
                elif kind == "assistant":
                    blocks = obj.get("message", {}).get("content", [])
                    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
                    if text:
                        final_text = text
                elif kind == "result":
                    final_text = obj.get("result") or final_text
                    if obj.get("is_error"):
                        raise RuntimeError(final_text or "Claude Code returned an error.")
                    break

            # Fallback: if no partial deltas arrived, emit the assembled text
            # (and turn a login/credential message into a clear error).
            if not streamed:
                text = (final_text or "").strip()
                if _LOGIN_ERR.search(text):
                    raise RuntimeError("Claude Code isn't signed in. Run `claude` once in a terminal to log in.")
                if text:
                    yield text
        finally:
            self._cleanup(proc)

    def generate_test_cases(self, messages):
        convo = [m for m in messages if m.get("role") != "system"]
        prompt = _render_prompt(convo)
        proc = self._popen(self._base_cmd(config.TEST_GEN_PROMPT, stream=False))
        try:
            out, _ = proc.communicate(input=prompt, timeout=config.CLAUDE_TIMEOUT)
        except Exception:
            self._cleanup(proc)
            return None, []

        result_text = _result_text(out)
        if result_text is None:
            return None, []

        data = _extract_json_object(result_text)
        if not data:
            return None, []
        fn = data.get("function_name")
        cases = data.get("test_cases", [])
        if not fn or not cases:
            return None, []
        return fn, cases

    @staticmethod
    def _cleanup(proc):
        if proc.poll() is None:
            proc.kill()
        try:
            proc.wait(timeout=5)
        except Exception:
            pass

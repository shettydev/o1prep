import json
import os

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(__file__)

PROBLEMS_DIR = os.path.join(BASE_DIR, "problems")
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")

# PostgreSQL connection. Problems and sessions both live in the database
# (problems seeded from the canonical YAML files in PROBLEMS_DIR). Override with
# DATABASE_URL in the environment; tests point it at a throwaway test database.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://o1prep:o1prep@localhost:5433/o1prep",
)

# Secret key for signed session cookies (Flask-Login). MUST be set to a strong
# random value in any real deployment.
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

# AI provider for text interviews, the tutor, and voice mode:
#   'claude'     -> local Claude Code CLI using your existing login (no API key)
#   'openai'     -> the OpenAI API (OPENAI_API_KEY)
#   'openrouter' -> openrouter.ai, one key for many models (OPENROUTER_API_KEY)
# Voice mode reuses the same text-streaming path, so it runs on whichever
# provider is selected here (the STT -> LLM -> TTS pipeline calls this LLM).
AI_PROVIDER = os.environ.get("AI_PROVIDER", "claude").strip().lower()

# Claude Code CLI provider
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "sonnet")
CLAUDE_EFFORT = os.environ.get("CLAUDE_EFFORT", "high").strip().lower()
CLAUDE_TIMEOUT = int(os.environ.get("CLAUDE_TIMEOUT", "180"))

# OpenAI models
CHAT_MODEL = "gpt-4o"
REALTIME_MODEL = "gpt-4o-realtime-preview"
TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"

# OpenRouter (AI_PROVIDER=openrouter). One key, many models by slug; browse them
# at https://openrouter.ai/models. SITE_URL/SITE_NAME are optional attribution
# headers OpenRouter uses for its dashboard and model rankings.
OPENROUTER_API_URL = "https://openrouter.ai/api/v1"
# Public catalog endpoint (no API key required) used to populate the model list.
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet").strip()
OPENROUTER_SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "").strip()
OPENROUTER_SITE_NAME = os.environ.get("OPENROUTER_SITE_NAME", "O(1) Prep").strip()

# Chat parameters
CHAT_TEMPERATURE = 0.7
CHAT_MAX_TOKENS = 4000
START_MAX_TOKENS = 2000
RESEARCH_TEMPERATURE = 0.6
RESEARCH_MAX_TOKENS = 3000
TEST_GEN_TEMPERATURE = 0.2
TEST_GEN_MAX_TOKENS = 2000

# Code execution. Python runs via the current interpreter; JS/TS shell out to a
# Node/TS toolchain (argument list only, never shell=True). Override the binaries
# via the environment when they are not on PATH.
CODE_TIMEOUT = 5
NODE_BIN = os.environ.get("NODE_BIN", "node")
# TypeScript executor as an argument list (default: `tsx <file>`).
TS_CMD = os.environ.get("TS_CMD", "tsx").split()

# Voice / Realtime
REALTIME_API_URL = "https://api.openai.com/v1/realtime/calls"
VOICE_NAME = "ash"
VAD_THRESHOLD = 0.5
VAD_PREFIX_PADDING_MS = 300
VAD_SILENCE_DURATION_MS = 500

# Flask
FLASK_PORT = 5000
FLASK_DEBUG = True

# SSE headers reused by all streaming endpoints
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


def _load_prompt(filename):
    with open(os.path.join(PROMPTS_DIR, filename), encoding="utf-8") as f:
        return f.read()


SYSTEM_PROMPT = _load_prompt("interviewer.txt")
SESSION_CONFIG = _load_prompt("session_config.txt")
FOCUS_PROMPTS = json.loads(_load_prompt("focus_prompts.json"))
TEST_GEN_PROMPT = _load_prompt("test_generation.txt")
VOICE_SYSTEM_PROMPT = _load_prompt("voice_interviewer.txt")
TUTOR_SYSTEM_PROMPT = _load_prompt("tutor.txt")

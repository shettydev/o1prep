"""OpenRouter provider — routes chat completions through openrouter.ai.

OpenRouter exposes an OpenAI-compatible API, so this reuses the OpenAI SDK
pointed at OpenRouter's base URL. The single OPENROUTER_API_KEY unlocks many
underlying models (Anthropic, OpenAI, Google, Meta, ...) selectable by slug.

Model list is fetched LIVE from OpenRouter's public /models catalog (no key
needed) and cached in-process. The UI shows only a curated "popular few"; the
full ~300+ catalog is searched server-side (see search_models) so the client
never has to hold the whole list. If the catalog fetch fails we fall back to a
small hardcoded seed so the app keeps working offline.

Because the interviewer, tutor, and voice mode all stream through the same
ai.stream_chat path, selecting OpenRouter makes the entire app model-agnostic.
"""

import json
import os
import time

import requests as http_requests

import config

# OpenRouter's public /models list carries no popularity ranking, so "popular"
# is a curated, ordered allowlist of prominent slugs. It is resolved against the
# live catalog (fresh names/context/pricing); slugs no longer offered drop off.
POPULAR_SLUGS = [
    "anthropic/claude-sonnet-5",
    "anthropic/claude-3.7-sonnet",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat",
    "mistralai/mistral-large",
]

# Offline fallback used only when the live catalog can't be fetched.
SEED_MODELS = [
    {"id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet"},
    {"id": "openai/gpt-4o", "label": "GPT-4o"},
    {"id": "openai/gpt-4o-mini", "label": "GPT-4o mini"},
    {"id": "google/gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
    {"id": "meta-llama/llama-3.3-70b-instruct", "label": "Llama 3.3 70B"},
]

EFFORTS = []
SUPPORTS_EFFORT = False
SUPPORTS_SEARCH = True

CATALOG_TTL = 3600  # seconds
_catalog_cache = {"ts": 0.0, "models": None}  # models: list[dict] | None


def _fetch_catalog():
    resp = http_requests.get(config.OPENROUTER_MODELS_URL, timeout=10)
    resp.raise_for_status()
    return resp.json().get("data", [])


def catalog():
    """The live OpenRouter model catalog, cached with a TTL. Returns [] if it
    has never been fetched successfully (callers then use SEED_MODELS)."""
    now = time.time()
    fresh = _catalog_cache["models"] is not None and now - _catalog_cache["ts"] <= CATALOG_TTL
    if not fresh:
        try:
            _catalog_cache["models"] = _fetch_catalog()
            _catalog_cache["ts"] = now
        except Exception:
            # Keep any stale cache; only fall through to [] if we never had one.
            if _catalog_cache["models"] is None:
                return []
    return _catalog_cache["models"] or []


def _price_per_million(pricing):
    # OpenRouter prices are per-token USD strings; surface $/1M tokens for the UI.
    try:
        prompt = round(float(pricing.get("prompt", 0)) * 1_000_000, 2)
        completion = round(float(pricing.get("completion", 0)) * 1_000_000, 2)
        return {"prompt": prompt, "completion": completion}
    except (TypeError, ValueError):
        return None


def _to_option(m):
    return {
        "id": m["id"],
        "label": m.get("name") or m["id"],
        "context_length": m.get("context_length"),
        "pricing": _price_per_million(m.get("pricing") or {}),
    }


def models():
    """The curated 'popular few', resolved against the live catalog."""
    cat = catalog()
    if not cat:
        return SEED_MODELS
    by_id = {m["id"]: m for m in cat}
    out = [_to_option(by_id[slug]) for slug in POPULAR_SLUGS if slug in by_id]
    # Always surface the configured default, even if it's not in the curated set.
    if config.OPENROUTER_MODEL in by_id and not any(o["id"] == config.OPENROUTER_MODEL for o in out):
        out.insert(0, _to_option(by_id[config.OPENROUTER_MODEL]))
    return out or SEED_MODELS


def search_models(query, limit=25):
    """Substring search over the live catalog, ranked prefix/family-first and
    bounded to `limit` so the client never receives the whole list. An empty
    query returns the curated popular few."""
    q = (query or "").strip().lower()
    cat = catalog()
    if not cat:
        return [m for m in SEED_MODELS if not q or q in m["id"].lower() or q in m["label"].lower()][:limit]
    if not q:
        return models()

    scored = []
    for m in cat:
        mid = m["id"].lower()
        name = (m.get("name") or "").lower()
        if q not in mid and q not in name:
            continue
        if mid.startswith(q) or name.startswith(q):
            score = 2
        elif q in mid.rsplit("/", 1)[-1] or q in name:
            score = 1
        else:
            score = 0
        scored.append((score, m))
    scored.sort(key=lambda t: (-t[0], t[1]["id"]))
    return [_to_option(m) for _, m in scored[:limit]]


def default_effort():
    return None


def default_model():
    cat = catalog()
    if cat and any(m["id"] == config.OPENROUTER_MODEL for m in cat):
        return config.OPENROUTER_MODEL
    # Self-heal: the configured default was retired — fall back to the first
    # curated model that still exists (or the configured value when offline).
    ms = models()
    return ms[0]["id"] if ms else config.OPENROUTER_MODEL


def valid_model(model):
    if not model:
        return False
    cat = catalog()
    if cat:
        return any(m["id"] == model for m in cat)
    # Offline: accept the configured default or any seed slug.
    return model == config.OPENROUTER_MODEL or any(s["id"] == model for s in SEED_MODELS)


def _extra_headers():
    # Optional attribution headers OpenRouter uses for its dashboard/rankings.
    headers = {}
    if config.OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = config.OPENROUTER_SITE_URL
    if config.OPENROUTER_SITE_NAME:
        headers["X-Title"] = config.OPENROUTER_SITE_NAME
    return headers


class OpenRouterClient:
    def __init__(self, api_key, model=None):
        from openai import OpenAI  # lazy: only needed when this provider is used

        self._client = OpenAI(
            api_key=api_key,
            base_url=config.OPENROUTER_API_URL,
            default_headers=_extra_headers() or None,
        )
        self.model = model or config.OPENROUTER_MODEL

    def stream_chat(self, messages, temperature=None, max_tokens=None):
        stream = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=temperature if temperature is not None else config.CHAT_TEMPERATURE,
            max_tokens=max_tokens if max_tokens is not None else config.CHAT_MAX_TOKENS,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    def generate_test_cases(self, messages):
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": config.TEST_GEN_PROMPT},
                    *[m for m in messages if m["role"] != "system"],
                ],
                response_format={"type": "json_object"},
                temperature=config.TEST_GEN_TEMPERATURE,
                max_tokens=config.TEST_GEN_MAX_TOKENS,
            )
            result = json.loads(response.choices[0].message.content)
            fn = result.get("function_name")
            cases = result.get("test_cases", [])
            if not fn or not cases:
                return None, []
            return fn, cases
        except Exception:
            return None, []


def get_client(model=None, effort=None):
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return None
    m = model if valid_model(model) else default_model()
    return OpenRouterClient(api_key, m)

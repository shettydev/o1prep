"""OpenRouter provider — routes chat completions through openrouter.ai.

OpenRouter exposes an OpenAI-compatible API, so this reuses the OpenAI SDK
pointed at OpenRouter's base URL. The single OPENROUTER_API_KEY unlocks many
underlying models (Anthropic, OpenAI, Google, Meta, ...) selectable by slug.

Because both the text interviewer/tutor and voice mode stream through the same
`ai.stream_chat` path, selecting AI_PROVIDER=openrouter makes the entire app —
including the STT -> LLM -> TTS voice pipeline — OpenRouter-powered.
"""

import json
import os

import config

# Curated models offered in the UI settings modal. OpenRouter has hundreds more
# (see https://openrouter.ai/models); override the default via OPENROUTER_MODEL.
# Reasoning-effort is model-specific on OpenRouter and not exposed here.
MODELS = [
    {"id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet"},
    {"id": "openai/gpt-4o", "label": "GPT-4o"},
    {"id": "openai/gpt-4o-mini", "label": "GPT-4o mini — faster"},
    {"id": "google/gemini-2.0-flash-001", "label": "Gemini 2.0 Flash"},
    {"id": "meta-llama/llama-3.3-70b-instruct", "label": "Llama 3.3 70B"},
]
EFFORTS = []
SUPPORTS_EFFORT = False


def default_model():
    return config.OPENROUTER_MODEL


def default_effort():
    return None


def valid_model(model):
    # Accept any curated model, plus whatever the deployment configured as the
    # default (so OPENROUTER_MODEL can point at a slug not in the short list).
    return model == config.OPENROUTER_MODEL or any(m["id"] == model for m in MODELS)


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
    m = model if valid_model(model) else config.OPENROUTER_MODEL
    return OpenRouterClient(api_key, m)

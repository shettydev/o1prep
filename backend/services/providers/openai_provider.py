"""OpenAI provider — wraps the OpenAI chat completions API.

Carries the same behaviour the app shipped with: streaming chat for the
interviewer/tutor and JSON-mode test-case generation.
"""

import json
import os

import config

# Models selectable from the UI. OpenAI has no reasoning-effort knob here.
MODELS = [
    {"id": "gpt-4o", "label": "GPT-4o"},
    {"id": "gpt-4o-mini", "label": "GPT-4o mini — faster"},
]
EFFORTS = []
SUPPORTS_EFFORT = False


def default_model():
    return config.CHAT_MODEL


def default_effort():
    return None


def valid_model(model):
    return any(m["id"] == model for m in MODELS)


class OpenAIClient:
    def __init__(self, api_key, model=None):
        from openai import OpenAI  # lazy: only needed when this provider is used

        self._client = OpenAI(api_key=api_key)
        self.model = model or config.CHAT_MODEL

    def stream_chat(self, messages, temperature=None, max_tokens=None):
        stream = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=temperature if temperature is not None else config.CHAT_TEMPERATURE,
            max_tokens=max_tokens if max_tokens is not None else config.CHAT_MAX_TOKENS,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
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
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    m = model if valid_model(model) else config.CHAT_MODEL
    return OpenAIClient(api_key, m)

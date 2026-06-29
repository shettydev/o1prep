"""AI engine dispatcher.

Selects the configured provider (Claude Code CLI or OpenAI) and exposes a
stable interface to the routes. The returned `client` is an opaque provider
object; callers pass it back into the module functions below.

Public API (unchanged from the original OpenAI-only module):
  get_client()                                   -> client or None
  stream_chat(client, messages, temp, max_toks)  -> generator of text deltas
  sse_stream(client, messages, temp, max_toks)   -> generator of SSE data lines
  generate_test_cases(client, messages)          -> (function_name, test_cases)
"""
import json

import config
from services.providers import claude_provider, openai_provider


def _provider():
    if config.AI_PROVIDER == 'claude':
        return claude_provider
    return openai_provider


def get_client(model=None, effort=None):
    return _provider().get_client(model=model, effort=effort)


def config_info():
    """Provider metadata for the UI settings modal: available models, whether
    reasoning effort applies, and the current defaults."""
    p = _provider()
    return {
        'provider': config.AI_PROVIDER,
        'models': p.MODELS,
        'default_model': p.default_model(),
        'supports_effort': p.SUPPORTS_EFFORT,
        'efforts': p.EFFORTS,
        'default_effort': p.default_effort(),
    }


def missing_client_message():
    """Human-readable reason the current provider isn't usable, for API errors."""
    if config.AI_PROVIDER == 'claude':
        return (
            'Claude Code CLI not found. Install it from '
            'https://claude.com/claude-code and run `claude` once to sign in.'
        )
    return 'OPENAI_API_KEY not set. Run: export OPENAI_API_KEY=your_key'


def stream_chat(client, messages, temperature=None, max_tokens=None):
    """Yield text deltas from the provider's streaming chat."""
    yield from client.stream_chat(messages, temperature, max_tokens)


def sse_stream(client, messages, temperature=None, max_tokens=None):
    """Full SSE generator that yields data lines and a done sentinel."""
    try:
        for text in client.stream_chat(messages, temperature, max_tokens):
            yield f"data: {json.dumps({'content': text})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


def generate_test_cases(client, messages):
    """Ask the model to produce structured test cases from the conversation."""
    return client.generate_test_cases(messages)

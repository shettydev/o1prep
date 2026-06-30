"""Language registry.

Single source of truth for the languages the platform supports. Pure metadata
and helpers — no subprocess or execution logic lives here. Runners
(`services/runners/`), the routes layer, and the frontend (`/api/config`) all
resolve language ids through this module so the allowlist is defined once.
"""

DEFAULT_LANGUAGE = "python"

LANGUAGES = {
    "python": {
        "id": "python",
        "label": "Python",
        "codemirror_mode": "python",
        "file_extension": ".py",
        "starter_code_key": "python",
    },
    "javascript": {
        "id": "javascript",
        "label": "JavaScript",
        "codemirror_mode": "javascript",
        "file_extension": ".js",
        "starter_code_key": "javascript",
    },
    "typescript": {
        "id": "typescript",
        "label": "TypeScript",
        "codemirror_mode": "text/typescript",
        "file_extension": ".ts",
        "starter_code_key": "typescript",
    },
}


def is_supported(language) -> bool:
    return isinstance(language, str) and language in LANGUAGES


def resolve(language) -> str:
    return language if is_supported(language) else DEFAULT_LANGUAGE


def get(language) -> dict:
    return LANGUAGES[resolve(language)]


def label(language) -> str:
    """Human-readable name for a language id (resolves unknown ids to the default)."""
    return get(language)["label"]


def all_languages() -> list:
    ordered = [LANGUAGES[DEFAULT_LANGUAGE]]
    ordered += [meta for lid, meta in LANGUAGES.items() if lid != DEFAULT_LANGUAGE]
    return ordered

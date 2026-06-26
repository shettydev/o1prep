"""Runner registry.

`get_runner(language)` returns the singleton runner for a registry-validated
language id. Unsupported ids raise UnsupportedLanguageError so callers can map it
to an HTTP 400.
"""

from services import languages
from services.runners.javascript_runner import JavaScriptRunner
from services.runners.python_runner import PythonRunner
from services.runners.typescript_runner import TypeScriptRunner


class UnsupportedLanguageError(ValueError):
    pass


_RUNNERS = {
    'python': PythonRunner(),
    'javascript': JavaScriptRunner(),
    'typescript': TypeScriptRunner(),
}


def get_runner(language):
    """Return the runner for a supported language id, else raise."""
    if not languages.is_supported(language):
        raise UnsupportedLanguageError(f'Unsupported language: {language!r}')
    return _RUNNERS[language]

"""Runner interface shared by every language.

A Runner executes untrusted user code in a subprocess (argument-list only, never
shell=True) bounded by a timeout. Two entry points:

  run_program(source, timeout)
      Execute raw user code and return {stdout, stderr, exit_code}.

  run_tests(user_code, target_name, test_cases, test_type, timeout)
      Execute user_code against structured test cases and return the result dict
      shape used across the app: {success: bool, results: list, error: str|None}.
      Each entry in `results` matches the contract the frontend renderer and
      code_runner.format_results_for_context already expect.

Every concrete runner emits a `__RESULTS__<json>` line on stdout for run_tests
so result parsing is identical regardless of language.
"""

import json
import os
import subprocess
import tempfile

RESULTS_MARKER = '__RESULTS__'


def write_temp(source, suffix, prefix):
    """Write `source` to a temp file and return its path. Caller unlinks."""
    fd, path = tempfile.mkstemp(suffix=suffix, prefix=prefix)
    with os.fdopen(fd, 'w') as f:
        f.write(source)
    return path


def run_subprocess(argv, timeout):
    """Run an argument list (never shell=True) with captured text output."""
    return subprocess.run(argv, capture_output=True, text=True, timeout=timeout)


def parse_harness_output(stdout, stderr, returncode, clean_fn=None):
    """Turn a finished harness process into the standard result dict.

    A successful harness prints `__RESULTS__<json>`; anything else is treated as
    a top-level failure (syntax error, crash, no output).
    """
    if returncode != 0 and RESULTS_MARKER not in stdout:
        error_msg = stderr.strip() or f'Process exited with code {returncode}'
        if clean_fn:
            error_msg = clean_fn(error_msg.split('\n'))
        return {'success': False, 'results': [], 'error': error_msg}

    if RESULTS_MARKER in stdout:
        json_str = stdout.split(RESULTS_MARKER, 1)[1].strip()
        return {'success': True, 'results': json.loads(json_str), 'error': None}

    return {'success': False, 'results': [], 'error': stderr.strip() or 'No output from test harness'}


class Runner:
    """Abstract language runner. Concrete subclasses implement the two entry points."""

    language: str = ''

    def run_program(self, source: str, timeout: int) -> dict:
        raise NotImplementedError

    def run_tests(self, user_code: str, target_name: str, test_cases: list, test_type: str, timeout: int) -> dict:
        raise NotImplementedError

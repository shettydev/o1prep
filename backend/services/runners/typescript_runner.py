"""TypeScript runner.

Reuses the JavaScript harness (TS is a superset of JS, so the generated harness
source runs unchanged) and executes it through a configurable TS executor —
default `tsx` via `config.TS_CMD`. Invocation is always an argument list, never
shell=True. If the TS toolchain is unavailable the runner returns a clear,
structured error instead of crashing.
"""

import os
from subprocess import TimeoutExpired as _Timeout

import config
from services.runners import base
from services.runners.javascript_runner import build_harness


def _unlink(path):
    try:
        os.unlink(path)
    except OSError:
        pass


class TypeScriptRunner(base.Runner):
    language = "typescript"
    file_extension = ".ts"

    def _command(self, path):
        return list(config.TS_CMD) + [path]

    def _missing_toolchain_msg(self):
        return (
            f"TypeScript execution requires a TS runner. Could not run "
            f"'{' '.join(config.TS_CMD)}'. Install it (e.g. `npm i -g tsx`) or set TS_CMD to your executor."
        )

    def run_program(self, source, timeout=config.CODE_TIMEOUT):
        path = base.write_temp(source, suffix=self.file_extension, prefix="codeprep_run_")
        try:
            result = base.run_subprocess(self._command(path), timeout=timeout)
            return {"stdout": result.stdout, "stderr": result.stderr, "exit_code": result.returncode}
        except _Timeout:
            return {"stdout": "", "stderr": f"Timeout: code took too long (>{timeout}s)", "exit_code": 1}
        except FileNotFoundError:
            return {"stdout": "", "stderr": self._missing_toolchain_msg(), "exit_code": 1}
        except Exception as e:
            return {"stdout": "", "stderr": f"Runner error: {e}", "exit_code": 1}
        finally:
            _unlink(path)

    def run_tests(self, user_code, target_name, test_cases, test_type="function", timeout=config.CODE_TIMEOUT):
        harness = build_harness(user_code, target_name, test_cases, test_type)
        path = base.write_temp(harness, suffix=self.file_extension, prefix="codeprep_")
        try:
            result = base.run_subprocess(self._command(path), timeout=timeout)
            return base.parse_harness_output(result.stdout, result.stderr, result.returncode)
        except _Timeout:
            return {"success": False, "results": [], "error": f"Timeout: code took too long to execute (>{timeout}s)"}
        except FileNotFoundError:
            return {"success": False, "results": [], "error": self._missing_toolchain_msg()}
        except Exception as e:
            return {"success": False, "results": [], "error": f"Runner error: {e}"}
        finally:
            _unlink(path)

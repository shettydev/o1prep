"""Python runner.

Owns the Python test harness (function- and class-style) and executes user code
via `[sys.executable, path]`. This is the original behavior extracted from
services/code_runner.py with no semantic change — the harness templates and
traceback cleaning are byte-for-byte the same.
"""

import json
import os
import sys
from subprocess import TimeoutExpired as _Timeout

import config
from services.runners import base

HARNESS_TEMPLATE = '''
import asyncio
import json
import sys

# ── User code ──
__USER_CODE__

# ── Test harness ──
_fn = __FUNCTION_NAME_REPR__
_tests = json.loads(__TEST_CASES_JSON_REPR__)

def _maybe_await(_value):
    if asyncio.iscoroutine(_value):
        return asyncio.run(_value)
    return _value

def _resolve_refs(_value, _scope):
    if isinstance(_value, dict) and "__ref__" in _value:
        return _scope[_value["__ref__"]]
    if isinstance(_value, list):
        return [_resolve_refs(_item, _scope) for _item in _value]
    if isinstance(_value, dict):
        return {_key: _resolve_refs(_item, _scope) for _key, _item in _value.items()}
    return _value

_results = []
for _i, _tc in enumerate(_tests):
    _label = _tc.get("label")
    _scope = dict(globals())
    _setup = _tc.get("setup_code")
    if _setup:
        exec(_setup, _scope, _scope)
    _inp = _resolve_refs(_tc.get("input", {}), _scope)
    _args = _resolve_refs(_tc.get("args"), _scope)
    _kwargs = _resolve_refs(_tc.get("kwargs"), _scope)
    _exp = _resolve_refs(_tc.get("expected"), _scope)
    _exp_err = _tc.get("expected_error")
    _callable = _tc.get("function_name") or _fn
    try:
        if _args is not None:
            _actual = _maybe_await(_scope[_callable](*_args))
            _call = f"{_callable}({', '.join(repr(_arg) for _arg in _args)})"
        elif _kwargs is not None:
            _actual = _maybe_await(_scope[_callable](**_kwargs))
            _call = _callable + "(" + ", ".join(f"{_k}={repr(_v)}" for _k, _v in _kwargs.items()) + ")"
        else:
            _actual = _maybe_await(_scope[_callable](**_inp))
            _call = _callable + "(" + ", ".join(f"{_k}={repr(_v)}" for _k, _v in _inp.items()) + ")"
        _passed = _exp_err is None and _actual == _exp
        _results.append({"index": _i, "label": _label, "input": _inp, "expected": _exp, "actual": _actual, "passed": _passed, "error": None, "call": _call})
    except Exception as _e:
        _err = f"{type(_e).__name__}: {_e}"
        _passed = _exp_err is not None and _exp_err.lower() in _err.lower()
        _results.append({"index": _i, "label": _label, "input": _inp, "expected": _exp, "actual": None, "passed": _passed, "error": None if _passed else _err, "expected_error": _exp_err, "call": _callable})

print("__RESULTS__" + json.dumps(_results, default=str))
'''


CLASS_HARNESS_TEMPLATE = '''
import asyncio
import json
import sys
import time

# ── User code ──
__USER_CODE__

# ── Test harness ──
_class_name = __CLASS_NAME_REPR__
_tests = json.loads(__TEST_CASES_JSON_REPR__)

def _maybe_await(_value):
    if asyncio.iscoroutine(_value):
        return asyncio.run(_value)
    return _value

def _resolve_refs(_value, _scope):
    if isinstance(_value, dict) and "__ref__" in _value:
        return _scope[_value["__ref__"]]
    if isinstance(_value, list):
        return [_resolve_refs(_item, _scope) for _item in _value]
    if isinstance(_value, dict):
        return {_key: _resolve_refs(_item, _scope) for _key, _item in _value.items()}
    return _value

def _format_arg(_value):
    if isinstance(_value, dict) and "__ref__" in _value:
        return _value["__ref__"]
    return repr(_value)

_results = []
for _i, _tc in enumerate(_tests):
    _label = _tc.get("label")
    _scope = dict(globals())
    _setup = _tc.get("setup_code")
    if _setup:
        exec(_setup, _scope, _scope)

    _init_args = _resolve_refs(_tc.get("init_args", []), _scope)
    _init_kwargs = _resolve_refs(_tc.get("init_kwargs", {}), _scope)
    _raw_init_args = _tc.get("init_args", [])
    _raw_init_kwargs = _tc.get("init_kwargs", {})

    try:
        _obj = globals()[_class_name](*_init_args, **_init_kwargs)
        _scope["obj"] = _obj
    except Exception as _e:
        _err = f"{type(_e).__name__}: {_e}"
        _results.append({
            "index": _i,
            "step": 0,
            "label": _label,
            "expected": None,
            "actual": None,
            "passed": False,
            "error": _err,
            "call": f"{_class_name}(...)",
        })
        continue

    _ops = _tc.get("ops", [])
    _op_args = _tc.get("op_args", [])
    _expected = _tc.get("expected", [])
    _expected_errors = _tc.get("expected_errors", [None] * len(_ops))
    _save_as = _tc.get("save_as", [None] * len(_ops))
    _compare = _tc.get("compare", [True] * len(_ops))
    _case_failed = False

    for _step_index, _op in enumerate(_ops):
        _raw_args = _op_args[_step_index] if _step_index < len(_op_args) else []
        _resolved_args = _resolve_refs(_raw_args, _scope)
        _exp = _resolve_refs(_expected[_step_index], _scope) if _step_index < len(_expected) else None
        _exp_err = _expected_errors[_step_index] if _step_index < len(_expected_errors) else None
        _should_compare = _compare[_step_index] if _step_index < len(_compare) else True

        if _init_kwargs:
            _init_display = ", ".join(
                [*[_format_arg(_arg) for _arg in _raw_init_args], *[f"{_key}={_format_arg(_value)}" for _key, _value in _raw_init_kwargs.items()]]
            )
        else:
            _init_display = ", ".join(_format_arg(_arg) for _arg in _raw_init_args)

        if _op == "__sleep__":
            _call = f"time.sleep({_resolved_args[0]!r})"
        elif _op == "__eval__":
            _call = str(_raw_args[0])
        else:
            _call = f"{_class_name}({_init_display}) :: {_op}({', '.join(_format_arg(_arg) for _arg in _raw_args)})"

        try:
            if _op == "__sleep__":
                time.sleep(_resolved_args[0])
                _actual = None
            elif _op == "__eval__":
                _actual = _maybe_await(eval(_raw_args[0], _scope, _scope))
            else:
                _actual = _maybe_await(getattr(_obj, _op)(*_resolved_args))
            _passed = _exp_err is None and (_actual == _exp if _should_compare else True)
            _error = None
            _save_name = _save_as[_step_index] if _step_index < len(_save_as) else None
            if _save_name:
                _scope[_save_name] = _actual
        except Exception as _e:
            _actual = None
            _err = f"{type(_e).__name__}: {_e}"
            _passed = _exp_err is not None and _exp_err.lower() in _err.lower()
            _error = None if _passed else _err

        _results.append({
            "index": _i,
            "step": _step_index + 1,
            "label": _label,
            "expected": _exp,
            "actual": _actual,
            "passed": _passed,
            "error": _error,
            "expected_error": _exp_err,
            "call": _call,
        })
        if not _passed:
            _case_failed = True
            break

    if _case_failed:
        continue

print("__RESULTS__" + json.dumps(_results, default=str))
'''


def _clean_traceback(lines):
    """Strip temp file paths from traceback to show cleaner errors."""
    cleaned = []
    for line in lines:
        if 'codeprep_' in line and 'File "' in line:
            line = line.replace(line.split('"')[1], '<your code>')
        cleaned.append(line)
    return '\n'.join(cleaned)


def _timeout_result(timeout):
    return f'Timeout: code took too long to execute (>{timeout}s)'


def _unlink(path):
    try:
        os.unlink(path)
    except OSError:
        pass


class PythonRunner(base.Runner):
    language = 'python'

    def run_program(self, source, timeout=config.CODE_TIMEOUT):
        path = base.write_temp(source, suffix='.py', prefix='codeprep_run_')
        try:
            result = base.run_subprocess([sys.executable, path], timeout=timeout)
            return {'stdout': result.stdout, 'stderr': result.stderr, 'exit_code': result.returncode}
        except _Timeout:
            return {'stdout': '', 'stderr': f'Timeout: code took too long (>{timeout}s)', 'exit_code': 1}
        except Exception as e:
            return {'stdout': '', 'stderr': f'Runner error: {e}', 'exit_code': 1}
        finally:
            _unlink(path)

    def run_tests(self, user_code, target_name, test_cases, test_type='function', timeout=config.CODE_TIMEOUT):
        if test_type == 'class':
            harness = (
                CLASS_HARNESS_TEMPLATE
                .replace('__USER_CODE__', user_code)
                .replace('__CLASS_NAME_REPR__', repr(target_name))
                .replace('__TEST_CASES_JSON_REPR__', repr(json.dumps(test_cases)))
            )
        else:
            harness = (
                HARNESS_TEMPLATE
                .replace('__USER_CODE__', user_code)
                .replace('__FUNCTION_NAME_REPR__', repr(target_name))
                .replace('__TEST_CASES_JSON_REPR__', repr(json.dumps(test_cases)))
            )
        return self._run_harness(harness, timeout)

    def _run_harness(self, harness, timeout=config.CODE_TIMEOUT):
        path = base.write_temp(harness, suffix='.py', prefix='codeprep_')
        try:
            result = base.run_subprocess([sys.executable, path], timeout=timeout)
            return base.parse_harness_output(result.stdout, result.stderr, result.returncode, _clean_traceback)
        except _Timeout:
            return {'success': False, 'results': [], 'error': _timeout_result(timeout)}
        except Exception as e:
            return {'success': False, 'results': [], 'error': f'Runner error: {e}'}
        finally:
            _unlink(path)

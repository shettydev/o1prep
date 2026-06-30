"""JavaScript runner.

Executes user JS in a Node subprocess (`[node, path]`, never shell=True) and
mirrors the Python harness contract: function- and class-style cases, deep
equality, expected_error substring matching, and a `__RESULTS__<json>` line whose
objects match the Python result shape so the same frontend renderer works.

Marshaling note: JS has no keyword arguments, so a test case's `input` /
`kwargs` object is passed positionally in declaration order (YAML/JSON preserve
order). This is enough for the function-call problems; problems that embed raw
Python (`setup_code`, `__eval__`) are Python-only by design.

The harness builder is shared with the TypeScript runner (TS is a JS superset,
so the same harness source runs unchanged through a TS executor).
"""

import json
import os
from subprocess import TimeoutExpired as _Timeout

import config
from services.runners import base

_JS_HELPERS = """
function __deepEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true; // null/undefined interchangeable
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!__deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!__deepEqual(a[k], b[k])) return false;
  }
  return true;
}
function __lookup(name) { try { return eval(name); } catch (e) { return undefined; } }
function __resolveRefs(v, scope) {
  if (v && typeof v === 'object' && !Array.isArray(v) && '__ref__' in v) {
    const r = v['__ref__'];
    return (scope && r in scope) ? scope[r] : __lookup(r);
  }
  if (Array.isArray(v)) return v.map((x) => __resolveRefs(x, scope));
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = __resolveRefs(v[k], scope);
    return out;
  }
  return v;
}
function __fmtErr(e) {
  const name = e && e.name ? e.name + ': ' : '';
  const msg = e && e.message != null ? e.message : String(e);
  return name + msg;
}
function __nz(v) { return v === undefined ? null : v; }
function __show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
"""


_FUNCTION_HARNESS = """
// ── User code ──
__USER_CODE__

// ── Test harness ──
(async () => {
  const __tests = __TESTS_JSON__;
  const __fn = __TARGET_JSON__;
  __JS_HELPERS__
  const results = [];
  for (let i = 0; i < __tests.length; i++) {
    const tc = __tests[i];
    const label = tc.label != null ? tc.label : null;
    const scope = {};
    const callableName = tc.function_name || __fn;
    const inp = __resolveRefs(tc.input != null ? tc.input : {}, scope);
    const args = tc.args != null ? __resolveRefs(tc.args, scope) : null;
    const kwargs = tc.kwargs != null ? __resolveRefs(tc.kwargs, scope) : null;
    const exp = __resolveRefs(tc.expected != null ? tc.expected : null, scope);
    const expErr = tc.expected_error != null ? tc.expected_error : null;
    let callArgs;
    if (args !== null) callArgs = args;
    else if (kwargs !== null) callArgs = Object.values(kwargs);
    else callArgs = Object.values(inp);
    const fn = __lookup(callableName);
    try {
      if (typeof fn !== 'function')
        throw new Error("NameError: name '" + callableName + "' is not defined");
      const actual = await fn(...callArgs);
      const callStr = callableName + '(' + callArgs.map(__show).join(', ') + ')';
      const passed = expErr === null && __deepEqual(actual, exp);
      results.push({ index: i, label, input: inp, expected: exp, actual: __nz(actual), passed, error: null, call: callStr });
    } catch (e) {
      const err = __fmtErr(e);
      const passed = expErr !== null && err.toLowerCase().includes(String(expErr).toLowerCase());
      results.push({ index: i, label, input: inp, expected: exp, actual: null, passed, error: passed ? null : err, expected_error: expErr, call: callableName });
    }
  }
  console.log('__RESULTS__' + JSON.stringify(results));
})();
"""


_CLASS_HARNESS = """
// ── User code ──
__USER_CODE__

// ── Test harness ──
(async () => {
  const __tests = __TESTS_JSON__;
  const __className = __TARGET_JSON__;
  __JS_HELPERS__
  const results = [];
  for (let i = 0; i < __tests.length; i++) {
    const tc = __tests[i];
    const label = tc.label != null ? tc.label : null;
    const scope = {};
    const initArgs = __resolveRefs(tc.init_args || [], scope);
    const rawInitArgs = tc.init_args || [];
    const Cls = __lookup(__className);
    let obj;
    try {
      if (typeof Cls !== 'function')
        throw new Error("NameError: name '" + __className + "' is not defined");
      obj = new Cls(...initArgs);
      scope.obj = obj;
    } catch (e) {
      results.push({ index: i, step: 0, label, expected: null, actual: null, passed: false, error: __fmtErr(e), call: __className + '(...)' });
      continue;
    }
    const ops = tc.ops || [];
    const opArgs = tc.op_args || [];
    const expected = tc.expected || [];
    const expectedErrors = tc.expected_errors || ops.map(() => null);
    const saveAs = tc.save_as || ops.map(() => null);
    const compare = tc.compare || ops.map(() => true);
    const initDisplay = rawInitArgs.map(__show).join(', ');
    let caseFailed = false;
    for (let s = 0; s < ops.length; s++) {
      const op = ops[s];
      const rawArgs = s < opArgs.length ? opArgs[s] : [];
      const resolvedArgs = __resolveRefs(rawArgs, scope);
      const exp = s < expected.length ? __resolveRefs(expected[s], scope) : null;
      const expErr = s < expectedErrors.length ? expectedErrors[s] : null;
      const shouldCompare = s < compare.length ? compare[s] : true;
      let callStr;
      if (op === '__sleep__') callStr = 'sleep(' + __show(resolvedArgs[0]) + ')';
      else if (op === '__eval__') callStr = String(rawArgs[0]);
      else callStr = __className + '(' + initDisplay + ') :: ' + op + '(' + (rawArgs || []).map(__show).join(', ') + ')';
      let actual = null, error = null, passed;
      try {
        if (op === '__sleep__') {
          await new Promise((r) => setTimeout(r, Number(resolvedArgs[0]) * 1000));
          actual = null;
        } else if (op === '__eval__') {
          actual = await eval(rawArgs[0]);
        } else {
          if (typeof obj[op] !== 'function')
            throw new Error("AttributeError: '" + __className + "' object has no attribute '" + op + "'");
          actual = await obj[op](...resolvedArgs);
        }
        passed = expErr === null && (shouldCompare ? __deepEqual(actual, exp) : true);
        error = null;
        const saveName = s < saveAs.length ? saveAs[s] : null;
        if (saveName) scope[saveName] = actual;
      } catch (e) {
        actual = null;
        const err = __fmtErr(e);
        passed = expErr !== null && err.toLowerCase().includes(String(expErr).toLowerCase());
        error = passed ? null : err;
      }
      results.push({ index: i, step: s + 1, label, expected: exp, actual: __nz(actual), passed, error, expected_error: expErr, call: callStr });
      if (!passed) { caseFailed = true; break; }
    }
    if (caseFailed) continue;
  }
  console.log('__RESULTS__' + JSON.stringify(results));
})();
"""


def build_harness(user_code, target_name, test_cases, test_type):
    """Build runnable JS harness source. Shared with the TypeScript runner."""
    template = _CLASS_HARNESS if test_type == "class" else _FUNCTION_HARNESS
    return (
        template.replace("__JS_HELPERS__", _JS_HELPERS)
        .replace("__TESTS_JSON__", json.dumps(test_cases))
        .replace("__TARGET_JSON__", json.dumps(target_name))
        .replace("__USER_CODE__", user_code)
    )


def _unlink(path):
    try:
        os.unlink(path)
    except OSError:
        pass


class JavaScriptRunner(base.Runner):
    language = "javascript"
    file_extension = ".js"

    def _command(self, path):
        return [config.NODE_BIN, path]

    def _missing_toolchain_msg(self):
        return (
            f"JavaScript execution requires Node.js. Could not find "
            f"'{config.NODE_BIN}'. Install Node.js or set NODE_BIN to its path."
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

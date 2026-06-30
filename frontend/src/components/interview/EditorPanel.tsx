"use client";

import { useInterview } from "@/store/interview";
import { Editor } from "./Editor";
import { TestResults } from "./TestResults";

function OutputPanel() {
  const tab = useInterview((s) => s.outputTab);
  const open = useInterview((s) => s.outputOpen);
  const running = useInterview((s) => s.running);
  const runResult = useInterview((s) => s.runResult);
  const testResults = useInterview((s) => s.testResults);
  const testError = useInterview((s) => s.testError);
  const setTab = useInterview((s) => s.setOutputTab);
  const setOpen = useInterview((s) => s.setOutputOpen);

  return (
    <div className="shrink-0 border-t border-line bg-bg">
      <div className="flex items-center gap-1 border-b border-line px-2">
        {(["output", "tests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-wider ${
              tab === t && open
                ? "border-b-2 border-amber text-amber"
                : "border-b-2 border-transparent text-text-dim hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto px-2 py-1 text-[11px] text-text-dim hover:text-amber"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▴"}
        </button>
      </div>

      {open && (
        <div className="max-h-[34vh] min-h-[120px] overflow-y-auto p-3 text-[12px]">
          {running && (
            <div className="text-amber">
              running…
              <span className="cursor" />
            </div>
          )}

          {!running && tab === "output" && (
            <pre className="whitespace-pre-wrap break-words">
              {runResult ? (
                <>
                  {runResult.stdout && <span className="text-text">{runResult.stdout}</span>}
                  {runResult.stderr && <span className="text-red">{runResult.stderr}</span>}
                  {!runResult.stdout && !runResult.stderr && (
                    <span className="text-text-faint">(no output)</span>
                  )}
                  {"\n"}
                  <span className={runResult.exit_code === 0 ? "text-green" : "text-red"}>
                    {"> process exited with code " + runResult.exit_code}
                  </span>
                </>
              ) : (
                <span className="text-text-faint">run your code to see output here.</span>
              )}
            </pre>
          )}

          {!running && tab === "tests" && (
            <>
              {testError && (
                <div className="border border-red/40 bg-red/5 px-3 py-2 text-red">{testError}</div>
              )}
              {testResults && <TestResults data={testResults} />}
              {!testError && !testResults && (
                <span className="text-text-faint">
                  click &quot;run tests&quot; to auto-generate and run cases.
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function EditorPanel() {
  const code = useInterview((s) => s.code);
  const setCode = useInterview((s) => s.setCode);
  const language = useInterview((s) => s.language);
  const changeLanguage = useInterview((s) => s.changeLanguage);
  const languages = useInterview((s) => s.config?.languages ?? []);
  const running = useInterview((s) => s.running);
  const runCode = useInterview((s) => s.runCode);
  const runTests = useInterview((s) => s.runTests);
  const clearEditor = useInterview((s) => s.clearEditor);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="border border-line bg-bg-inset px-2 py-1 text-[12px] text-text focus:border-amber focus:outline-none"
        >
          {languages.length === 0 && <option value={language}>{language}</option>}
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={clearEditor} className="tbtn">
            clear
          </button>
          <button onClick={runCode} disabled={running} className="tbtn disabled:opacity-50">
            ▸ run
          </button>
          <button
            onClick={runTests}
            disabled={running}
            className="tbtn tbtn-amber disabled:opacity-50"
          >
            ✔ run tests
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-bg-inset">
        <Editor value={code} onChange={setCode} language={language} />
      </div>

      <OutputPanel />
    </div>
  );
}

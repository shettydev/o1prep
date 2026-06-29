"use client";

import { useState } from "react";
import type { TestCaseResult, TestResults as TR } from "@/lib/types";

function formatCall(r: TestCaseResult, displayName: string, i: number): string {
  if (r.call) return r.label ? `${r.label} :: ${r.call}` : r.call;
  const inputStr = Object.entries(r.input ?? {})
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return `${displayName}(${inputStr}) [case ${i + 1}]`;
}

function CaseRow({
  r,
  displayName,
  index,
}: {
  r: TestCaseResult;
  displayName: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const expectedValue = r.expected_error
    ? `error: ${r.expected_error}`
    : JSON.stringify(r.expected);

  return (
    <div className={`border-l-2 ${r.passed ? "border-green/50" : "border-red/60"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-bg-hover"
      >
        <span className={r.passed ? "text-green" : "text-red"}>
          {r.passed ? "✔" : "✖"}
        </span>
        <code className="truncate text-text">{formatCall(r, displayName, index)}</code>
        <span className="ml-auto shrink-0 text-text-faint">→ {expectedValue}</span>
        <span className="shrink-0 text-text-faint">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-1 bg-bg-inset px-3 py-2 text-[11px]">
          {r.error ? (
            <Row label="Error" value={r.error} err />
          ) : r.expected_error ? (
            <Row label="Expected error" value={r.expected_error} />
          ) : (
            <>
              <Row label="Expected" value={JSON.stringify(r.expected)} />
              <Row label="Got" value={JSON.stringify(r.actual)} err={!r.passed} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, err }: { label: string; value: string; err?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-text-faint">{label}:</span>
      <span className={`break-all ${err ? "text-red" : "text-text-dim"}`}>{value}</span>
    </div>
  );
}

export function TestResults({ data }: { data: TR }) {
  const results = data.results ?? [];

  if (data.error && results.length === 0) {
    return (
      <div className="border border-red/40">
        <div className="flex items-center gap-2 bg-red/10 px-3 py-2 text-[12px] text-red">
          <span>✖</span> execution failed
        </div>
        <pre className="overflow-x-auto bg-bg-inset px-3 py-2 text-[11px] text-red">
          {data.error}
        </pre>
      </div>
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = passed === total && total > 0;

  return (
    <div className="border border-line">
      <div
        className={`flex items-center gap-2 px-3 py-2 text-[12px] ${
          allPassed ? "bg-green/10 text-green" : "bg-red/10 text-red"
        }`}
      >
        <span>{allPassed ? "✔" : "✖"}</span>
        <span className="font-semibold">
          {passed}/{total} tests passed
        </span>
      </div>
      <div className="divide-y divide-line">
        {results.map((r, i) => (
          <CaseRow key={i} r={r} displayName={data.display_name} index={i} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { selectVisibleProblems, useProblems } from "@/store/problems";
import { ProblemCard } from "./ProblemCard";

export function ProblemList() {
  // Subscribe to each field so the memo recomputes only when inputs change.
  const problems = useProblems((s) => s.problems);
  const attempts = useProblems((s) => s.attempts);
  const category = useProblems((s) => s.category);
  const difficulties = useProblems((s) => s.difficulties);
  const warmupOnly = useProblems((s) => s.warmupOnly);
  const search = useProblems((s) => s.search);
  const sort = useProblems((s) => s.sort);
  const loading = useProblems((s) => s.loading);
  const error = useProblems((s) => s.error);

  const visible = useMemo(
    () =>
      selectVisibleProblems({
        problems,
        attempts,
        category,
        difficulties,
        warmupOnly,
        search,
        sort,
      } as Parameters<typeof selectVisibleProblems>[0]),
    [problems, attempts, category, difficulties, warmupOnly, search, sort],
  );

  return (
    <section className="min-w-0 flex-1 p-4 sm:p-6 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-2">
        <span className="label">
          {loading ? "loading…" : `${visible.length} problem${visible.length === 1 ? "" : "s"}`}
        </span>
        <span className="text-[10px] text-text-faint">
          ls -la ./problems<span className="cursor" />
        </span>
      </div>

      {error && (
        <div className="border border-red/40 bg-red/5 p-4 text-[13px] text-red">
          ✕ {error} — is the API up on :5000?
        </div>
      )}

      {loading && !error && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[78px] animate-pulse border border-line bg-bg-raised/50"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="border border-line bg-bg-raised p-8 text-center text-[13px] text-text-dim">
          <span className="text-text-faint">{"// "}</span>no problems match the current filters
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((p, i) => (
            <ProblemCard
              key={p.id}
              problem={p}
              rating={attempts[p.id]?.rating}
              index={i}
            />
          ))}
        </div>
      )}
    </section>
  );
}

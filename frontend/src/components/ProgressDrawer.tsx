"use client";

import { useMemo } from "react";
import { categoryLabel } from "@/lib/constants";
import { useProblems } from "@/store/problems";
import { useUI } from "@/store/ui";
import { Drawer } from "./Drawer";

export function ProgressDrawer() {
  const open = useUI((s) => s.progress);
  const close = useUI((s) => s.close);
  const problems = useProblems((s) => s.problems);
  const attempts = useProblems((s) => s.attempts);

  const { total, done, pct, byCategory } = useMemo(() => {
    const attemptedIds = new Set(Object.keys(attempts).map(Number));
    const cats = new Map<string, { total: number; done: number }>();
    for (const p of problems) {
      const c = cats.get(p.category) ?? { total: 0, done: 0 };
      c.total += 1;
      if (attemptedIds.has(p.id)) c.done += 1;
      cats.set(p.category, c);
    }
    const total = problems.length;
    const done = problems.filter((p) => attemptedIds.has(p.id)).length;
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
      byCategory: [...cats.entries()].sort((a, b) => b[1].done - a[1].done),
    };
  }, [problems, attempts]);

  return (
    <Drawer open={open} onClose={() => close("progress")} title="progress">
      <div className="space-y-5 p-4">
        <div className="border border-line bg-bg-raised p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display glow text-4xl text-amber">{done}</span>
            <span className="text-[12px] text-text-faint">/ {total} attempted</span>
          </div>
          <div className="mt-3 h-2 w-full border border-line bg-bg-inset">
            <div
              className="h-full bg-amber shadow-[0_0_8px_var(--amber-glow)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-text-faint">{pct}%</div>
        </div>

        <div>
          <div className="label mb-2">by topic</div>
          <div className="space-y-1.5">
            {byCategory.map(([cat, c]) => (
              <div key={cat} className="flex items-center gap-3 text-[12px]">
                <span className="w-36 shrink-0 truncate text-text-dim">{categoryLabel(cat)}</span>
                <div className="h-1.5 flex-1 border border-line bg-bg-inset">
                  <div
                    className="h-full bg-amber-dim"
                    style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-text-faint">
                  {c.done}/{c.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

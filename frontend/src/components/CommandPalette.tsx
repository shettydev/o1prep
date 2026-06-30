"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { categoryLabel, problemCode } from "@/lib/constants";
import { useProblems } from "@/store/problems";
import { DifficultyBadge } from "./ui";

/** Rendered only while open (mounted on demand) so state initializes fresh. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const problems = useProblems((s) => s.problems);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? problems.filter((p) => {
          const skills = (p.key_skills ?? []).join(" ").toLowerCase();
          return (
            p.title.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            skills.includes(q) ||
            categoryLabel(p.category).toLowerCase().includes(q)
          );
        })
      : problems;
    return base.slice(0, 40);
  }, [query, problems]);

  // Focus the input once on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the active row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-i="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onQueryChange = (v: string) => {
    setQuery(v);
    setIndex(0);
  };

  const go = (id: number, study: boolean) => {
    onClose();
    router.push(study ? `/study/${id}` : `/interview/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[index];
      if (p) go(p.id, e.metaKey || e.ctrlKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border border-amber-dim bg-bg-raised shadow-[0_0_40px_var(--amber-glow)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <span className="text-amber">$</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="search problems…"
            className="w-full bg-transparent text-[14px] text-text placeholder:text-text-faint focus:outline-none"
          />
          <kbd>esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-text-faint">no matches</div>
          )}
          {results.map((p, i) => (
            <div
              key={p.id}
              data-i={i}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(p.id, false)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${
                i === index ? "bg-amber/10" : ""
              }`}
            >
              <span className={`w-1 self-stretch ${i === index ? "bg-amber" : "bg-transparent"}`} />
              <span className="text-[10px] text-text-faint">{problemCode(p.id)}</span>
              <span className="flex-1 truncate text-text">{p.title}</span>
              <DifficultyBadge difficulty={p.difficulty} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-3 py-2 text-[10px] text-text-faint">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> practice
          </span>
          <span>
            <kbd>⌘↵</kbd> study
          </span>
        </div>
      </div>
    </div>
  );
}

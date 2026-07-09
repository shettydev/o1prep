"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelOption } from "@/lib/types";
import { searchModels } from "@/lib/api";

function fmtCtx(n?: number | null): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ctx`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function fmtPrice(p?: { prompt: number; completion: number } | null): string | null {
  if (!p) return null;
  return `$${p.prompt}/$${p.completion} per M`;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** The curated "popular few" from /api/config — the default list. */
  options: ModelOption[];
  /** When true, typing hits the live server-side catalog search. */
  supportsSearch: boolean;
}

/**
 * Searchable model picker. Shows the popular few by default; typing runs a
 * debounced server search (OpenRouter's ~300-model catalog) that returns a
 * bounded result set, so the client never holds the full list. Falls back to
 * client-side filtering of `options` when the provider has no search endpoint.
 */
export function ModelCombobox({ value, onChange, options, supportsSearch }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState(
    () => options.find((m) => m.id === value)?.label ?? value,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0); // latest-query-wins guard for async results

  const trimmed = query.trim();
  // Results are derived, not stored: only the async server search needs state.
  const results: ModelOption[] = !trimmed
    ? options
    : supportsSearch
      ? serverResults
      : options.filter((m) => {
          const lc = trimmed.toLowerCase();
          return m.id.toLowerCase().includes(lc) || m.label.toLowerCase().includes(lc);
        });
  const activeIdx = results.length ? Math.min(highlight, results.length - 1) : -1;
  const searching = loading && !!trimmed && supportsSearch;

  // Close when clicking outside the widget.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Debounced live catalog search. All state writes happen inside the timeout /
  // promise callbacks, so the effect body itself never sets state synchronously.
  useEffect(() => {
    if (!open || !supportsSearch || !trimmed) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setLoading(true);
      searchModels(trimmed, 25)
        .then((r) => {
          if (mine !== seq.current) return;
          setServerResults(r);
          setHighlight(0);
        })
        .catch(() => {
          if (mine === seq.current) setServerResults([]);
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [trimmed, open, supportsSearch]);

  const openPanel = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  const pick = (m: ModelOption) => {
    onChange(m.id);
    setSelectedLabel(m.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = results[activeIdx];
      if (m) pick(m);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[180px]">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex w-full items-center justify-between gap-2 border border-line bg-bg-inset px-2 py-1.5 text-[12px] text-text focus:border-amber focus:outline-none"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-text-faint">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[280px] border border-line bg-bg-raised shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={supportsSearch ? "search models…" : "filter models…"}
            className="w-full border-b border-line bg-bg-inset px-2 py-1.5 text-[12px] text-text placeholder:text-text-faint focus:outline-none"
          />
          <ul className="max-h-[240px] overflow-y-auto">
            {searching && <li className="px-2 py-2 text-[11px] text-text-faint">searching…</li>}
            {!searching && results.length === 0 && (
              <li className="px-2 py-2 text-[11px] text-text-faint">no models found</li>
            )}
            {!searching &&
              results.map((m, i) => {
                const sub = [fmtCtx(m.context_length), fmtPrice(m.pricing)]
                  .filter(Boolean)
                  .join(" · ");
                const active = m.id === value;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(m)}
                      className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left ${
                        i === activeIdx ? "bg-amber/10" : ""
                      }`}
                    >
                      <span className={`text-[12px] ${active ? "text-amber" : "text-text"}`}>
                        {active ? "✓ " : ""}
                        {m.label}
                      </span>
                      {sub && <span className="text-[10px] text-text-faint">{sub}</span>}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}

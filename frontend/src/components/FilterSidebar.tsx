"use client";

import { useRouter } from "next/navigation";
import { CATEGORIES, DIFFICULTIES, SORTS } from "@/lib/constants";
import { selectVisibleProblems, useProblems } from "@/store/problems";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="label mb-2">{children}</div>;
}

export function FilterSidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const router = useRouter();
  const {
    category,
    difficulties,
    warmupOnly,
    search,
    sort,
    setCategory,
    toggleDifficulty,
    setWarmupOnly,
    setSearch,
    setSort,
    clearFilters,
  } = useProblems();

  const hasFilters =
    category !== "all" ||
    difficulties.length > 0 ||
    warmupOnly ||
    search !== "" ||
    sort !== "default";

  const surprise = () => {
    const visible = selectVisibleProblems(useProblems.getState());
    if (visible.length === 0) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    router.push(`/interview/${pick.id}`);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 border-r border-line bg-bg-inset/40 p-4 lg:h-full lg:w-72 lg:overflow-y-auto">
      {/* Search */}
      <div className="space-y-2">
        <div className="flex items-center border border-line bg-bg-inset px-2.5 focus-within:border-amber">
          <span className="text-text-faint">$</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="grep problems…"
            className="w-full bg-transparent px-2 py-2 text-[13px] text-text placeholder:text-text-faint focus:outline-none"
            autoComplete="off"
          />
          <button
            onClick={onOpenPalette}
            title="Command palette"
            className="border border-line px-1.5 py-0.5 text-[10px] text-text-dim hover:border-amber-dim hover:text-amber"
          >
            ⌘K
          </button>
        </div>
        <button onClick={surprise} className="tbtn tbtn-amber w-full justify-center">
          ⚡ surprise me
        </button>
      </div>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="self-start text-[11px] text-text-faint underline-offset-2 hover:text-amber hover:underline"
        >
          ✕ clear filters
        </button>
      )}

      {/* Topic */}
      <div>
        <SectionLabel>Topic</SectionLabel>
        <div className="flex flex-col">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`border-l-2 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                category === c.slug && !warmupOnly
                  ? "border-amber bg-amber/5 text-amber"
                  : "border-transparent text-text-dim hover:border-line-bright hover:text-text"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <SectionLabel>Difficulty</SectionLabel>
        <div className="flex gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => toggleDifficulty(d)}
              className={`tbtn flex-1 justify-center ${
                difficulties.includes(d) ? "is-active" : ""
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Warm up */}
      <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-text-dim">
        <span
          className={`flex h-4 w-4 items-center justify-center border text-[10px] ${
            warmupOnly ? "border-amber bg-amber text-bg" : "border-line-bright"
          }`}
        >
          {warmupOnly ? "✓" : ""}
        </span>
        <input
          type="checkbox"
          checked={warmupOnly}
          onChange={(e) => setWarmupOnly(e.target.checked)}
          className="sr-only"
        />
        Warm-up only
      </label>

      {/* Sort */}
      <div>
        <SectionLabel>Sort</SectionLabel>
        <div className="flex flex-col">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`border-l-2 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                sort === s.key
                  ? "border-amber bg-amber/5 text-amber"
                  : "border-transparent text-text-dim hover:border-line-bright hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

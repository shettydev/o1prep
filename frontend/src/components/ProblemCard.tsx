"use client";

import Link from "next/link";
import type { ProblemSummary } from "@/lib/types";
import { categoryLabel, problemCode } from "@/lib/constants";
import { DifficultyBadge, StatusDot } from "./ui";

export function ProblemCard({
  problem,
  rating,
  index,
}: {
  problem: ProblemSummary;
  rating?: string | null;
  index: number;
}) {
  const skills = (problem.key_skills ?? []).slice(0, 3);

  return (
    <Link
      href={`/study/${problem.id}`}
      style={{ animationDelay: `${Math.min(index, 16) * 18}ms` }}
      className="group rise relative block border border-line bg-bg-raised px-4 py-3 transition-colors hover:border-amber-dim hover:bg-bg-hover"
    >
      {/* amber corner ticks on hover */}
      <span className="pointer-events-none absolute left-[-1px] top-[-1px] h-2 w-2 border-l border-t border-amber opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="pointer-events-none absolute bottom-[-1px] right-[-1px] h-2 w-2 border-b border-r border-amber opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start gap-3">
        <div className="mt-1.5">
          <StatusDot rating={rating} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[10px] tracking-wider text-text-faint">
              {problemCode(problem.id)}
            </span>
            <span className="truncate font-semibold text-text group-hover:text-amber-bright">
              {problem.title}
            </span>
            <DifficultyBadge difficulty={problem.difficulty} />
          </div>

          <p className="mt-1 line-clamp-1 text-[12px] text-text-dim">
            {problem.summary}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-amber-dim">
              {categoryLabel(problem.category)}
            </span>
            {skills.map((s) => (
              <span
                key={s}
                className="border border-line px-1.5 py-0.5 text-[10px] text-text-faint"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 self-center opacity-60 transition-opacity group-hover:opacity-100">
          <span
            className="tbtn px-2.5 py-1 text-[11px]"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `/study/${problem.id}`;
            }}
          >
            study
          </span>
          <span
            className="tbtn tbtn-amber px-2.5 py-1 text-[11px]"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `/interview/${problem.id}`;
            }}
          >
            ▸ practice
          </span>
        </div>
      </div>
    </Link>
  );
}

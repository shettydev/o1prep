import type { Difficulty } from "@/lib/types";
import { ratingTone } from "@/lib/constants";

const DIFF_COLOR: Record<Difficulty, string> = {
  Easy: "text-green border-green/40",
  Medium: "text-yellow border-yellow/40",
  Hard: "text-red border-red/40",
};

/** Bracketed terminal-style difficulty stamp, e.g. [MEDIUM]. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${DIFF_COLOR[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

const TONE_BG: Record<ReturnType<typeof ratingTone>, string> = {
  green: "bg-green shadow-[0_0_6px_var(--green)]",
  yellow: "bg-yellow shadow-[0_0_6px_var(--yellow)]",
  red: "bg-red shadow-[0_0_6px_var(--red)]",
  dim: "bg-transparent border border-line-bright",
};

/** Attempt-status indicator. Solid glowing dot when attempted, hollow when not. */
export function StatusDot({ rating }: { rating?: string | null }) {
  const tone = ratingTone(rating);
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 ${TONE_BG[tone]}`}
      title={rating ? `last verdict: ${rating}` : "not attempted"}
      aria-hidden
    />
  );
}

import type { Difficulty, SortKey } from "./types";

// Category slugs + display labels — mirrors the old static/js/problems.js
// CATEGORY_LABELS and the sidebar order in templates/index.html.
export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "all", label: "All" },
  { slug: "stateful", label: "Stateful" },
  { slug: "parsing", label: "Parsing" },
  { slug: "scheduling", label: "Scheduling" },
  { slug: "search", label: "Search" },
  { slug: "streaming", label: "Streaming" },
  { slug: "infra", label: "Infra" },
  { slug: "concurrency", label: "Concurrency" },
  { slug: "api_design", label: "API Design" },
  { slug: "syntax", label: "Python Syntax" },
  { slug: "arrays", label: "Arrays" },
  { slug: "strings", label: "Strings" },
  { slug: "linked lists", label: "Linked Lists" },
  { slug: "trees", label: "Trees" },
  { slug: "graphs", label: "Graphs" },
  { slug: "dynamic programming", label: "Dynamic Programming" },
  { slug: "backtracking", label: "Backtracking" },
  { slug: "debugging", label: "Debugging" },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug;
}

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "difficulty-asc", label: "Easiest first" },
  { key: "difficulty-desc", label: "Hardest first" },
  { key: "unattempted", label: "Not attempted" },
  { key: "alpha", label: "A → Z" },
];

/** zero-padded problem id, e.g. CP-007 */
export function problemCode(id: number): string {
  return `CP-${String(id).padStart(3, "0")}`;
}

/** Maps a verdict rating to a signal color token (Easy/green, etc.). */
export function ratingTone(rating: string | null | undefined): "green" | "yellow" | "red" | "dim" {
  if (!rating) return "dim";
  const r = rating.toLowerCase();
  if (r.includes("no_hire") || r.includes("no hire")) {
    return r.includes("lean") ? "yellow" : "red";
  }
  if (r.includes("hire")) return "green";
  return "yellow";
}

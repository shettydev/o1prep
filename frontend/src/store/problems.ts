import { create } from "zustand";
import type {
  AttemptMap,
  Difficulty,
  ProblemSummary,
  SortKey,
} from "@/lib/types";
import { categoryLabel, DIFFICULTY_ORDER } from "@/lib/constants";
import { getProblems, getSessions } from "@/lib/api";

interface ProblemsState {
  // data
  problems: ProblemSummary[];
  attempts: AttemptMap;
  loading: boolean;
  error: string | null;

  // filters
  category: string;
  difficulties: Difficulty[];
  warmupOnly: boolean;
  search: string;
  sort: SortKey;

  // actions
  load: () => Promise<void>;
  setCategory: (c: string) => void;
  toggleDifficulty: (d: Difficulty) => void;
  setWarmupOnly: (v: boolean) => void;
  setSearch: (q: string) => void;
  setSort: (s: SortKey) => void;
  clearFilters: () => void;
}

export const useProblems = create<ProblemsState>((set) => ({
  problems: [],
  attempts: {},
  loading: true,
  error: null,

  category: "all",
  difficulties: [],
  warmupOnly: false,
  search: "",
  sort: "default",

  load: async () => {
    set({ loading: true, error: null });
    try {
      const problems = await getProblems();
      set({ problems, loading: false });
      // Sessions are best-effort (a logged-out user 401s) — never block the list.
      try {
        const sessions = await getSessions();
        const attempts: AttemptMap = {};
        for (const s of sessions) {
          if (s.problem_id != null && !(s.problem_id in attempts)) {
            attempts[s.problem_id] = { rating: s.rating };
          }
        }
        set({ attempts });
      } catch {
        /* not signed in or no history yet — leave attempts empty */
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load problems",
      });
    }
  },

  setCategory: (category) => set({ category, warmupOnly: false }),
  toggleDifficulty: (d) =>
    set((s) => ({
      warmupOnly: false,
      difficulties: s.difficulties.includes(d)
        ? s.difficulties.filter((x) => x !== d)
        : [...s.difficulties, d],
    })),
  setWarmupOnly: (warmupOnly) =>
    set(warmupOnly ? { warmupOnly, category: "all", difficulties: [] } : { warmupOnly }),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  clearFilters: () =>
    set({ category: "all", difficulties: [], warmupOnly: false, search: "", sort: "default" }),
}));

/** Derived: the filtered + sorted list. Pure function of state for easy reuse. */
export function selectVisibleProblems(s: ProblemsState): ProblemSummary[] {
  let list = s.warmupOnly
    ? s.problems.filter((p) => p.category === "warmup")
    : s.category === "all"
      ? s.problems
      : s.problems.filter((p) => p.category === s.category);

  if (s.difficulties.length > 0) {
    list = list.filter((p) => s.difficulties.includes(p.difficulty));
  }

  const q = s.search.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => {
      const skills = (p.key_skills ?? []).join(" ").toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        skills.includes(q) ||
        categoryLabel(p.category).toLowerCase().includes(q)
      );
    });
  }

  switch (s.sort) {
    case "difficulty-asc":
      return [...list].sort(
        (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty],
      );
    case "difficulty-desc":
      return [...list].sort(
        (a, b) => DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty],
      );
    case "alpha":
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    case "unattempted":
      return [...list].sort((a, b) => {
        const aa = a.id in s.attempts ? 1 : 0;
        const bb = b.id in s.attempts ? 1 : 0;
        return aa - bb;
      });
    default:
      return list;
  }
}

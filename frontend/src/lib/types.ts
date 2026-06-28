// Mirrors backend/services/problems.py :: serialize_for_list and the
// /api/sessions payload. Keep these in sync with the Flask serializers.

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemSummary {
  id: number;
  title: string;
  category: string;
  difficulty: Difficulty;
  summary: string;
  starter_code: string;
  key_skills: string[];
}

export interface SessionSummary {
  problem_id: number | null;
  rating: Rating | null;
}

/** Interviewer verdict on a past attempt. Drives the status indicator color. */
export type Rating = "hire" | "lean_hire" | "no_hire" | "lean_no_hire" | string;

/** problem_id -> the most recent attempt's rating. */
export type AttemptMap = Record<number, { rating: Rating | null }>;

export type SortKey =
  | "default"
  | "difficulty-asc"
  | "difficulty-desc"
  | "unattempted"
  | "alpha";

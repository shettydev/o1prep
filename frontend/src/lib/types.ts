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

// ── Interview / editor ──

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface FullProblem extends ProblemSummary {
  description?: string;
  scenario?: string;
  constraints?: string[];
  examples?: { input?: string; output?: string }[];
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

/** One row from a test run — mirrors the harness output in services/runners. */
export interface TestCaseResult {
  passed: boolean;
  call?: string;
  label?: string;
  input?: Record<string, unknown>;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  expected_error?: string;
}

export interface TestResults {
  test_type: "function" | "class";
  display_name: string;
  success: boolean;
  results: TestCaseResult[];
  error?: string | null;
}

export interface LanguageMeta {
  id: string;
  label: string;
  codemirror_mode: string;
  file_extension: string;
}

export interface EngineConfig {
  provider: string;
  models: string[];
  default_model: string;
  supports_effort: boolean;
  efforts: string[];
  default_effort: string;
  languages: LanguageMeta[];
  default_language: string;
}

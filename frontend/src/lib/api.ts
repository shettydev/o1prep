import type {
  EngineConfig,
  FullProblem,
  ProblemSummary,
  RunResult,
  SessionDetail,
  SessionSummary,
  TestResults,
} from "./types";

// All requests go to same-origin /api/* and are proxied to Flask by the
// rewrite in next.config.ts, so the Flask-Login session cookie travels with
// every call. credentials:"include" is belt-and-suspenders for the same-origin
// case and lets a future cross-origin API_ORIGIN keep working.
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** POST JSON. On a non-2xx, throws ApiError carrying the backend's {error} message. */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ── Auth (Flask-Login session cookie) — mirrors backend/routes/auth.py ──

export interface AuthState {
  authenticated: boolean;
  email?: string;
}

export function getMe(): Promise<AuthState> {
  return apiGet<AuthState>("/auth/me");
}

export function login(email: string, password: string): Promise<AuthState> {
  return apiPost<AuthState>("/auth/login", { email, password });
}

export function register(email: string, password: string): Promise<AuthState> {
  return apiPost<AuthState>("/auth/register", { email, password });
}

export function logout(): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>("/auth/logout", {});
}

// ── Engine config + problems ──

export function getConfig(): Promise<EngineConfig> {
  return apiGet<EngineConfig>("/config");
}

export function getProblem(id: number, language?: string): Promise<FullProblem> {
  const q = language ? `?language=${encodeURIComponent(language)}` : "";
  return apiGet<FullProblem>(`/problems/${id}${q}`);
}

// ── Interview session lifecycle ──

export interface CreateSessionInput {
  focus: string;
  mode: "text" | "voice";
  problem_id?: number | null;
  language: string;
  model?: string;
  effort?: string;
}

export function createSession(input: CreateSessionInput): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/sessions", input);
}

export function runCode(code: string, language: string): Promise<RunResult> {
  return apiPost<RunResult>("/run", { code, language });
}

export function runTests(
  sessionId: string,
  code: string,
): Promise<TestResults> {
  return apiPost<TestResults>(`/sessions/${sessionId}/run-tests`, { code });
}

export function saveCode(sessionId: string, code: string): Promise<unknown> {
  return apiPut<unknown>(`/sessions/${sessionId}/code`, { code }).catch(() => null);
}

export function setSessionLanguage(
  sessionId: string,
  language: string,
): Promise<unknown> {
  return apiPut<unknown>(`/sessions/${sessionId}/language`, { language }).catch(
    () => null,
  );
}

export function endSession(sessionId: string): Promise<unknown> {
  return apiPost<unknown>(`/sessions/${sessionId}/end`, {}).catch(() => null);
}

export function getProblems(): Promise<ProblemSummary[]> {
  return apiGet<ProblemSummary[]>("/problems");
}

export function getSessions(): Promise<SessionSummary[]> {
  return apiGet<SessionSummary[]>("/sessions");
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiGet<SessionDetail>(`/sessions/${id}`);
}

export function deleteSession(id: string): Promise<unknown> {
  return fetch(`/api/sessions/${id}`, {
    method: "DELETE",
    credentials: "include",
  }).then((r) => (r.ok ? r.json() : null));
}

import type { ProblemSummary, SessionSummary } from "./types";

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

export function getProblems(): Promise<ProblemSummary[]> {
  return apiGet<ProblemSummary[]>("/problems");
}

export function getSessions(): Promise<SessionSummary[]> {
  return apiGet<SessionSummary[]>("/sessions");
}

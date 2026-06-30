import type { TestResults } from "./types";

export interface SSECallbacks {
  /** Called on every token with the accumulated text and the new delta. */
  onContent?: (full: string, delta: string) => void;
  onTestResults?: (results: TestResults) => void;
  onError?: (message: string) => void;
}

/**
 * POST `body` to a same-origin /api SSE endpoint and dispatch the
 * `data: {json}` events the Flask routes emit ({content}/{test_results}/
 * {done}/{error}). Resolves with the full accumulated assistant text.
 *
 * Port of the old readSSEStream (static/js/utils.js) onto fetch + ReadableStream.
 */
export async function streamSSE(path: string, body: unknown, cb: SSECallbacks): Promise<string> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.error === "string") msg = data.error;
    } catch {
      /* non-JSON error body */
    }
    cb.onError?.(msg);
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (typeof data.content === "string") {
        full += data.content;
        cb.onContent?.(full, data.content);
      }
      if (data.test_results) {
        cb.onTestResults?.(data.test_results as TestResults);
      }
      if (typeof data.error === "string") {
        cb.onError?.(data.error);
      }
    }
  }

  return full;
}

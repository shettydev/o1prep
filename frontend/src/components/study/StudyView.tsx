"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChatMessage, FullProblem } from "@/lib/types";
import { getProblem } from "@/lib/api";
import { streamSSE } from "@/lib/sse";
import { requestSettings } from "@/store/settings";
import { Markdown } from "@/components/interview/Markdown";
import { ProblemDetail } from "./ProblemDetail";

interface ChatBubble {
  id: number;
  role: "user" | "assistant";
  content: string;
}

function ResearchChat({ problemId }: { problemId: number }) {
  const [items, setItems] = useState<ChatBubble[]>([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items]);

  const send = async () => {
    const t = text.trim();
    if (!t || streaming) return;
    setText("");
    const history: ChatMessage[] = items.map((m) => ({ role: m.role, content: m.content }));
    const aid = ++idRef.current;
    setItems((prev) => [
      ...prev,
      { id: ++idRef.current, role: "user", content: t },
      { id: aid, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    try {
      await streamSSE(
        "/research/chat",
        { problem_id: problemId, message: t, history, ...requestSettings() },
        {
          onContent: (full) =>
            setItems((prev) =>
              prev.map((m) => (m.id === aid ? { ...m, content: full } : m)),
            ),
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      setItems((prev) =>
        prev.map((m) => (m.id === aid ? { ...m, content: `_Error: ${msg}_` } : m)),
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="label">◆ research chat</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {items.length === 0 && (
          <p className="text-[12px] leading-relaxed text-text-faint">
            Ask about this problem — concepts, approaches, complexity, data
            structures. The tutor guides without giving away the full solution.
          </p>
        )}
        {items.map((m) => (
          <div key={m.id}>
            <div className="label mb-1">
              {m.role === "assistant" ? (
                <span className="text-amber-dim">tutor</span>
              ) : (
                <span className="text-text-faint">you</span>
              )}
            </div>
            {m.role === "assistant" ? (
              m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <span className="label text-amber-dim">
                  thinking<span className="cursor" />
                </span>
              )
            ) : (
              <div className="whitespace-pre-wrap text-[12px] text-text">{m.content}</div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-line p-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="ask about the problem…"
          rows={2}
          className="w-full resize-none border border-line bg-bg-inset px-2.5 py-2 text-[12px] text-text placeholder:text-text-faint focus:border-amber focus:outline-none"
        />
        <button
          onClick={send}
          disabled={streaming}
          className="tbtn tbtn-amber mt-2 w-full justify-center disabled:opacity-50"
        >
          send
        </button>
      </div>
    </div>
  );
}

export function StudyView({ problemId }: { problemId: number }) {
  const router = useRouter();
  const [problem, setProblem] = useState<FullProblem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<"problem" | "chat">("problem");

  useEffect(() => {
    let alive = true;
    getProblem(problemId)
      .then((p) => {
        if (alive) {
          setProblem(p);
          setStatus("ready");
        }
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [problemId]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-[13px] text-text-dim">
          <span className="text-amber">$</span> loading problem<span className="cursor" />
        </div>
      </main>
    );
  }

  if (status === "error" || !problem) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5">
        <div className="border border-red/40 bg-red/5 px-4 py-3 text-[13px] text-red">
          ✕ problem not found
        </div>
        <Link href="/" className="tbtn tbtn-amber">
          ← back to problems
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-bg px-4 py-2.5">
        <Link href="/" className="tbtn">
          ← back
        </Link>
        <div className="min-w-0 flex-1 truncate text-center text-[13px] text-text">
          {problem.title}
        </div>
        <button
          onClick={() => router.push(`/interview/${problem.id}`)}
          className="tbtn tbtn-amber"
        >
          ▸ practice
        </button>
      </header>
      {/* Mobile tab switch — detail and chat can't share a narrow viewport. */}
      <div className="flex border-b border-line md:hidden">
        {(["problem", "chat"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] uppercase tracking-wider ${
              tab === t
                ? "border-b-2 border-amber text-amber"
                : "border-b-2 border-transparent text-text-dim"
            }`}
          >
            {t === "problem" ? "▤ problem" : "◆ chat"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${tab === "problem" ? "block" : "hidden"} min-w-0 flex-1 overflow-y-auto border-r border-line md:block`}
        >
          <ProblemDetail problem={problem} />
        </div>
        <aside
          className={`${tab === "chat" ? "flex" : "hidden"} w-full shrink-0 flex-col bg-bg-inset/40 md:flex md:w-96`}
        >
          <ResearchChat problemId={problem.id} />
        </aside>
      </div>
    </main>
  );
}

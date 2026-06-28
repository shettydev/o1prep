"use client";

import { useEffect, useRef, useState } from "react";
import { useInterview } from "@/store/interview";
import { Markdown } from "./Markdown";

export function TutorSidebar() {
  const open = useInterview((s) => s.tutorOpen);
  const items = useInterview((s) => s.tutorItems);
  const streaming = useInterview((s) => s.tutorStreaming);
  const tutorSend = useInterview((s) => s.tutorSend);
  const toggle = useInterview((s) => s.toggleTutor);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items]);

  if (!open) return null;

  const onSend = () => {
    const t = text.trim();
    if (!t || streaming) return;
    setText("");
    tutorSend(t);
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-bg-inset/40">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="label">◆ tutor</span>
        <button onClick={toggle} className="text-text-dim hover:text-amber" title="Close">
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {items.length === 0 && (
          <p className="text-[12px] leading-relaxed text-text-faint">
            Ask for hints, concept explanations, or complexity guidance. The tutor
            won&apos;t give away the solution.
          </p>
        )}
        {items.map((m) =>
          m.role === "tests" ? null : (
            <div key={m.id}>
              <div className="label mb-1">
                {m.role === "assistant" ? (
                  <span className="text-amber-dim">tutor</span>
                ) : (
                  <span className="text-text-faint">you</span>
                )}
              </div>
              {m.role === "assistant" ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <div className="whitespace-pre-wrap text-[12px] text-text">{m.content}</div>
              )}
            </div>
          ),
        )}
        {streaming && items[items.length - 1]?.role !== "assistant" && (
          <div className="label text-amber-dim">
            thinking<span className="cursor" />
          </div>
        )}
      </div>

      <div className="border-t border-line p-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="ask for a hint…"
          rows={2}
          className="w-full resize-none border border-line bg-bg-inset px-2.5 py-2 text-[12px] text-text placeholder:text-text-faint focus:border-amber focus:outline-none"
        />
        <button
          onClick={onSend}
          disabled={streaming}
          className="tbtn tbtn-amber mt-2 w-full justify-center disabled:opacity-50"
        >
          send
        </button>
      </div>
    </aside>
  );
}

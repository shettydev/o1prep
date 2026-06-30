"use client";

import { useEffect, useRef, useState } from "react";
import { useInterview, type ChatItem } from "@/store/interview";
import { Markdown } from "./Markdown";
import { TestResults } from "./TestResults";

function MessageBlock({ item }: { item: ChatItem }) {
  if (item.role === "tests") {
    return (
      <div>
        <div className="label mb-1.5">test runner</div>
        <TestResults data={item.tests} />
      </div>
    );
  }
  const isAssistant = item.role === "assistant";
  return (
    <div className="rise">
      <div className="label mb-1.5">
        {isAssistant ? (
          <span className="text-amber-dim">▸ interviewer</span>
        ) : (
          <span className="text-text-faint">$ you</span>
        )}
      </div>
      <div
        className={`border px-3 py-2.5 ${
          isAssistant ? "border-line bg-bg-raised" : "border-line/60 bg-bg-inset/50"
        }`}
      >
        {isAssistant || item.content.includes("```") ? (
          <Markdown>{item.content}</Markdown>
        ) : (
          <div className="whitespace-pre-wrap text-[13px] text-text">{item.content}</div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const items = useInterview((s) => s.items);
  const streaming = useInterview((s) => s.streaming);
  const send = useInterview((s) => s.send);
  const submitCode = useInterview((s) => s.submitCode);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items]);

  const onSend = () => {
    const t = text.trim();
    if (!t || streaming) return;
    setText("");
    send(t);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-r border-line">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {items.map((item) => (
          <MessageBlock key={item.id} item={item} />
        ))}
        {streaming && items[items.length - 1]?.role !== "assistant" && (
          <div className="label text-amber-dim">
            ▸ interviewer is typing
            <span className="cursor" />
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="$ type your response…"
          rows={2}
          className="w-full resize-none border border-line bg-bg-inset px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-amber focus:outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => submitCode(text.trim())}
            disabled={streaming}
            className="tbtn disabled:opacity-50"
          >
            ⇧ submit code
          </button>
          <button
            onClick={onSend}
            disabled={streaming}
            className="tbtn tbtn-amber disabled:opacity-50"
          >
            send ↵
          </button>
        </div>
      </div>
    </div>
  );
}

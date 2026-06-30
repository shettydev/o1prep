"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInterview } from "@/store/interview";
import { BootScreen } from "@/components/BootScreen";
import { InterviewTopBar } from "./InterviewTopBar";
import { ChatPanel } from "./ChatPanel";
import { EditorPanel } from "./EditorPanel";
import { TutorSidebar } from "./TutorSidebar";

export function InterviewView({
  problemId,
  sessionId,
}: {
  problemId?: number;
  sessionId?: string;
}) {
  const status = useInterview((s) => s.status);
  const error = useInterview((s) => s.error);
  const init = useInterview((s) => s.init);
  const resume = useInterview((s) => s.resume);
  const reset = useInterview((s) => s.reset);
  // On narrow screens we can't show chat + editor side by side, so toggle.
  const [mobileTab, setMobileTab] = useState<"chat" | "code">("chat");

  useEffect(() => {
    if (sessionId) resume(sessionId);
    else if (problemId != null) init(problemId);
    return () => reset();
  }, [problemId, sessionId, init, resume, reset]);

  return (
    <BootScreen active={status === "booting"} text="starting interview">
      {status === "error" ? (
        <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="max-w-md border border-red/40 bg-red/5 p-5 text-[13px] text-red">
            ✕ {error ?? "Failed to start the interview."}
            <div className="mt-2 text-text-faint">
              An AI provider must be configured on the backend to run interviews.
            </div>
          </div>
          <Link href="/" className="tbtn tbtn-amber">
            ← back to problems
          </Link>
        </main>
      ) : (
        <ReadyView mobileTab={mobileTab} setMobileTab={setMobileTab} />
      )}
    </BootScreen>
  );
}

function ReadyView({
  mobileTab,
  setMobileTab,
}: {
  mobileTab: "chat" | "code";
  setMobileTab: (t: "chat" | "code") => void;
}) {
  return (
    <main className="flex h-screen flex-col">
      <InterviewTopBar />

      {/* Mobile tab switch — chat and editor can't share a narrow viewport. */}
      <div className="flex border-b border-line md:hidden">
        {(["chat", "code"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2 text-[11px] uppercase tracking-wider ${
              mobileTab === t
                ? "border-b-2 border-amber text-amber"
                : "border-b-2 border-transparent text-text-dim"
            }`}
          >
            {t === "chat" ? "▸ chat" : "‹/› code"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${mobileTab === "chat" ? "flex" : "hidden"} w-full flex-col md:flex md:w-[38%] md:min-w-[320px]`}
        >
          <ChatPanel />
        </div>
        <div
          className={`${mobileTab === "code" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}
        >
          <EditorPanel />
        </div>
        <TutorSidebar />
      </div>
    </main>
  );
}

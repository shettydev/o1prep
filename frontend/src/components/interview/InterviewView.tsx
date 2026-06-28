"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useInterview } from "@/store/interview";
import { InterviewTopBar } from "./InterviewTopBar";
import { ChatPanel } from "./ChatPanel";
import { EditorPanel } from "./EditorPanel";
import { TutorSidebar } from "./TutorSidebar";

export function InterviewView({ problemId }: { problemId: number }) {
  const status = useInterview((s) => s.status);
  const error = useInterview((s) => s.error);
  const init = useInterview((s) => s.init);
  const reset = useInterview((s) => s.reset);

  useEffect(() => {
    init(problemId);
    return () => reset();
  }, [problemId, init, reset]);

  if (status === "booting") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-[13px] text-text-dim">
          <span className="text-amber">$</span> initializing interview session
          <span className="cursor" />
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="max-w-md border border-red/40 bg-red/5 p-5 text-[13px] text-red">
          ✕ {error ?? "Failed to start the interview."}
          <div className="mt-2 text-text-faint">
            An OpenAI API key must be configured on the backend to run interviews.
          </div>
        </div>
        <Link href="/" className="tbtn tbtn-amber">
          ← back to problems
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <InterviewTopBar />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[38%] min-w-[320px] md:flex md:flex-col">
          <ChatPanel />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorPanel />
        </div>
        <TutorSidebar />
      </div>
    </main>
  );
}

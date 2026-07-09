"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInterview } from "@/store/interview";
// TODO(voice): voice mode is disabled pending a natural-sounding TTS provider.
// The browser Web Speech synth sounds robotic; deep research favours proxying a
// neural TTS (Deepgram Aura-2 / ElevenLabs Flash / OpenAI gpt-4o-mini-tts /
// self-hosted Kokoro) through Flask behind the existing Speaker seam. The full
// pipeline (store/voice.ts, lib/voice/*, VoiceControls.tsx) is intact — re-enable
// by uncommenting the voice toggle below and the <VoiceControls/> mount in ChatPanel.
// import { useVoice } from "@/store/voice";

function useTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function InterviewTopBar() {
  const router = useRouter();
  const title = useInterview((s) => s.problem?.title ?? "Technical Interview");
  const toggleTutor = useInterview((s) => s.toggleTutor);
  const tutorOpen = useInterview((s) => s.tutorOpen);
  const end = useInterview((s) => s.end);
  // TODO(voice): re-enable when neural TTS lands.
  // const voiceActive = useVoice((s) => s.active);
  // const toggleVoice = useVoice((s) => s.toggle);
  const time = useTimer();

  const leave = () => router.push("/");
  const finish = async () => {
    await end();
    router.push("/");
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-bg px-4 py-2.5">
      <button onClick={leave} className="tbtn">
        ← back
      </button>
      <div className="min-w-0 flex-1 text-center">
        <span className="truncate text-[13px] text-text">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* TODO(voice): voice mode disabled until a natural TTS provider is wired.
        <button
          onClick={toggleVoice}
          className={`tbtn ${voiceActive ? "is-active" : ""}`}
          title="Toggle voice mode"
        >
          {voiceActive ? "🎙 voice on" : "🎙 voice"}
        </button>
        */}
        <button
          onClick={toggleTutor}
          className={`tbtn ${tutorOpen ? "is-active" : ""}`}
          title="Toggle tutor"
        >
          ◆ tutor
        </button>
        <span className="border border-line px-2.5 py-1 text-[12px] tabular-nums text-amber glow">
          {time}
        </span>
        <button
          onClick={finish}
          className="tbtn"
          style={{ color: "var(--red)", borderColor: "var(--red-dim)" }}
        >
          ■ end
        </button>
      </div>
    </header>
  );
}

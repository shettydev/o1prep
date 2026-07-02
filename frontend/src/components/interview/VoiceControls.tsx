"use client";

import { useEffect } from "react";
import { useVoice, type VoiceStatus } from "@/store/voice";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  off: "",
  listening: "listening…",
  thinking: "thinking…",
  speaking: "interviewer speaking…",
  idle: "muted",
  error: "",
};

// Colour + pulse per state so the candidate always knows whose turn it is.
const STATUS_TONE: Record<VoiceStatus, string> = {
  off: "text-text-faint",
  listening: "text-green",
  thinking: "text-amber-dim",
  speaking: "text-amber",
  idle: "text-text-faint",
  error: "text-red",
};

/**
 * Voice-mode status strip. Renders above the chat composer only while voice is
 * active; the transcript itself reuses the normal ChatPanel message list. On
 * unmount (leaving the interview) it tears the pipeline down so the mic stops.
 */
export function VoiceControls() {
  const active = useVoice((s) => s.active);
  const status = useVoice((s) => s.status);
  const muted = useVoice((s) => s.muted);
  const interim = useVoice((s) => s.interim);
  const error = useVoice((s) => s.error);
  const toggleMute = useVoice((s) => s.toggleMute);
  const disable = useVoice((s) => s.disable);

  // Stop the mic/synth if the component unmounts while a session is live.
  useEffect(() => () => useVoice.getState().disable(), []);

  if (error && !active) {
    return (
      <div className="border-t border-red/40 bg-red/5 px-3 py-2 text-[11px] text-red">
        ✕ {error}
      </div>
    );
  }

  if (!active) return null;

  const pulsing = status === "listening" || status === "speaking";

  return (
    <div className="border-t border-line bg-bg-raised px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status === "listening"
              ? "bg-green"
              : status === "speaking"
                ? "bg-amber"
                : status === "thinking"
                  ? "bg-amber-dim"
                  : "bg-text-faint"
          } ${pulsing ? "animate-pulse" : ""}`}
        />
        <span className={`label ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleMute} className="tbtn" title={muted ? "Unmute mic" : "Mute mic"}>
            {muted ? "▶ unmute" : "❚❚ mute"}
          </button>
          <button
            onClick={disable}
            className="tbtn"
            style={{ color: "var(--red)", borderColor: "var(--red-dim)" }}
            title="Exit voice mode"
          >
            ■ voice off
          </button>
        </div>
      </div>

      {interim && (
        <div className="mt-1.5 truncate text-[12px] text-text-dim">
          <span className="text-text-faint">$ </span>
          {interim}
        </div>
      )}
    </div>
  );
}

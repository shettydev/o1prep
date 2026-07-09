import { create } from "zustand";
import { useInterview } from "@/store/interview";
import { Recognizer, sttSupported } from "@/lib/voice/stt";
import { Speaker, ttsSupported } from "@/lib/voice/tts";
import { setVoiceSink } from "@/lib/voice/sink";

/**
 * Voice-mode orchestrator: the turn loop around the existing text interview.
 *
 *   mic -> STT (Recognizer) -> useInterview.send() -> LLM stream -> TTS (Speaker)
 *
 * The LLM turn is NOT re-implemented here: send() runs the same streamSSE path
 * as text mode and, because we register a Speaker as the voice sink, its tokens
 * are spoken as they arrive. This store only drives the state machine:
 *
 *   listening -> thinking -> speaking -> listening
 *
 * We deliberately stop the mic while thinking/speaking (no barge-in) to avoid
 * the synth's own audio echoing back into recognition.
 */

export type VoiceStatus = "off" | "listening" | "thinking" | "speaking" | "idle" | "error";

interface VoiceState {
  active: boolean;
  status: VoiceStatus;
  muted: boolean;
  interim: string;
  error: string | null;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  toggleMute: () => void;
}

// Held outside the store: these are imperative browser objects, not UI state.
let speaker: Speaker | null = null;
let recognizer: Recognizer | null = null;

export const useVoice = create<VoiceState>((set, get) => {
  const beginListening = () => {
    if (!get().active || get().muted) return;
    set({ status: "listening", interim: "" });
    recognizer?.start();
  };

  const handleFinal = async (text: string) => {
    if (!get().active) return;
    recognizer?.stop();
    set({ status: "thinking", interim: "" });
    // send() feeds the Speaker via the sink; onSpeakingStart/onDrain advance the
    // machine. Await guards the case where send is a no-op or produces no speech.
    await useInterview
      .getState()
      .send(text)
      .catch(() => {});
    if (get().active && get().status === "thinking") beginListening();
  };

  const handleRecError = (err: string) => {
    // "no-speech"/"aborted" are benign — just keep listening. Mic permission
    // problems are terminal for voice mode.
    if (err === "not-allowed" || err === "service-not-allowed") {
      get().disable();
      set({ status: "error", error: "Microphone blocked. Allow mic access to use voice mode." });
      return;
    }
    if (get().active && !get().muted && get().status === "listening") beginListening();
  };

  return {
    active: false,
    status: "off",
    muted: false,
    interim: "",
    error: null,

    enable: () => {
      if (get().active) return;
      if (!sttSupported() || !ttsSupported()) {
        set({
          status: "error",
          error: "Voice mode needs the Web Speech API (Chrome or Edge). Use text mode instead.",
        });
        return;
      }

      speaker = new Speaker({
        onSpeakingStart: () => set({ status: "speaking", interim: "" }),
        onDrain: () => beginListening(),
      });
      setVoiceSink(speaker);
      recognizer = new Recognizer({
        onInterim: (t) => set({ interim: t }),
        onFinal: (t) => handleFinal(t),
        onError: (e) => handleRecError(e),
      });

      set({ active: true, status: "thinking", muted: false, interim: "", error: null });

      // Speak the interviewer's opening if it's already on screen; if it's still
      // streaming, the in-flight tokens will feed the freshly-registered sink.
      const iv = useInterview.getState();
      const lastAssistant = [...iv.items].reverse().find((m) => m.role === "assistant");
      if (!iv.streaming && lastAssistant && lastAssistant.role === "assistant") {
        speaker.pushText(lastAssistant.content);
        speaker.flush();
      } else if (!iv.streaming) {
        beginListening();
      }
    },

    disable: () => {
      recognizer?.dispose();
      recognizer = null;
      speaker?.interrupt();
      setVoiceSink(null);
      speaker = null;
      set({ active: false, status: "off", interim: "", muted: false });
    },

    toggle: () => {
      if (get().active) get().disable();
      else get().enable();
    },

    toggleMute: () => {
      const muted = !get().muted;
      set({ muted });
      if (muted) {
        recognizer?.stop();
        if (get().status === "listening") set({ status: "idle", interim: "" });
      } else if (get().status === "idle") {
        beginListening();
      }
    },
  };
});

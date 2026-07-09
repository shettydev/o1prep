/**
 * Text-to-speech adapter over the browser Web Speech API (SpeechSynthesis).
 *
 * This is the "TTS" leg of the STT -> LLM -> TTS voice pipeline. It is written
 * behind a tiny surface (`pushText`, `flush`, `interrupt`, callbacks) so a
 * premium provider (ElevenLabs/Cartesia) can replace it later without the voice
 * store knowing the difference.
 *
 * Streaming-friendly: `pushText` receives assistant token deltas and speaks
 * complete sentences as soon as they form, so audio starts before the model has
 * finished — the rest is spoken on `flush`.
 */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Break the buffer at sentence boundaries so we can start speaking early while
// keeping natural prosody. Keeps trailing text (no boundary yet) buffered.
const SENTENCE_RE = /[^.!?\n]+[.!?\n]+(\s|$)|[^.!?\n]+$/g;

// Strip markdown so the synth doesn't read "asterisk asterisk" or backticks.
// Fenced code blocks are announced rather than spelled out character by char.
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SpeakerCallbacks {
  /** Fired when playback transitions from silent to speaking. */
  onSpeakingStart?: () => void;
  /** Fired when the queue drains after having spoken (nothing left to say). */
  onDrain?: () => void;
}

export class Speaker {
  private buffer = "";
  private queue: string[] = [];
  private speaking = false;
  private finished = false; // flush() called: drain when queue empties
  private cb: SpeakerCallbacks;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(cb: SpeakerCallbacks = {}) {
    this.cb = cb;
    // Pick a stable English voice if one is available; getVoices can be async.
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      this.voice = voices.find((v) => v.lang?.startsWith("en")) ?? voices[0] ?? null;
    };
    pick();
    if (typeof window !== "undefined") window.speechSynthesis.onvoiceschanged = pick;
  }

  /** Feed a streamed token delta; speaks whole sentences as they complete. */
  pushText(delta: string) {
    this.finished = false;
    this.buffer += delta;
    this.drainSentences(false);
  }

  /** Signal the turn is complete; speak whatever remains in the buffer. */
  flush() {
    this.finished = true;
    this.drainSentences(true);
    // Nothing was ever queued (e.g. empty response) — report drain immediately.
    if (!this.speaking && this.queue.length === 0) this.cb.onDrain?.();
  }

  /** Stop immediately and discard anything pending (barge-in / disable). */
  interrupt() {
    this.buffer = "";
    this.queue = [];
    this.speaking = false;
    this.finished = false;
    if (ttsSupported()) window.speechSynthesis.cancel();
  }

  private drainSentences(toEnd: boolean) {
    const matches = this.buffer.match(SENTENCE_RE) ?? [];
    if (matches.length === 0) return;

    // Unless flushing, keep the last fragment buffered until it's terminated.
    const lastTerminated = /[.!?\n]\s*$/.test(this.buffer);
    const take = toEnd || lastTerminated ? matches.length : matches.length - 1;

    let consumed = 0;
    for (let i = 0; i < take; i++) {
      const sentence = matches[i].trim();
      consumed += matches[i].length;
      if (sentence) this.queue.push(sentence);
    }
    this.buffer = this.buffer.slice(consumed);
    this.pump();
  }

  private pump() {
    if (this.speaking || this.queue.length === 0 || !ttsSupported()) return;
    const raw = this.queue.shift()!;
    const text = cleanForSpeech(raw);
    if (!text) {
      // Nothing speakable (e.g. a lone code fence) — skip without stalling.
      if (this.queue.length > 0) this.pump();
      else if (this.finished) this.cb.onDrain?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    const wasSilent = !this.speaking;
    this.speaking = true;
    if (wasSilent) this.cb.onSpeakingStart?.();

    u.onend = () => {
      this.speaking = false;
      if (this.queue.length > 0) {
        this.pump();
      } else if (this.finished) {
        this.cb.onDrain?.();
      }
    };
    u.onerror = u.onend;
    window.speechSynthesis.speak(u);
  }
}

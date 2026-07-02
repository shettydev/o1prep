/**
 * Speech-to-text adapter over the browser Web Speech API (SpeechRecognition).
 *
 * The "STT" leg of the STT -> LLM -> TTS voice pipeline. Behind the same kind of
 * thin surface as the Speaker, so a server-side STT (Deepgram/Whisper) can drop
 * in later. Chrome/Edge implement this natively; Safari/Firefox are spotty —
 * callers should gate on `sttSupported()` and fall back to text mode.
 */

// The API ships under a webkit-prefixed constructor in Chromium.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function ctor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  return ctor() !== null;
}

export interface RecognizerCallbacks {
  /** Interim (non-final) transcript, for live display while the user speaks. */
  onInterim?: (text: string) => void;
  /** A completed utterance the user finished speaking. */
  onFinal?: (text: string) => void;
  /** Non-fatal recognition error (e.g. "no-speech"); caller may restart. */
  onError?: (error: string) => void;
}

export class Recognizer {
  private rec: SpeechRecognitionLike | null = null;
  private cb: RecognizerCallbacks;
  private running = false;

  constructor(cb: RecognizerCallbacks = {}, lang = "en-US") {
    this.cb = cb;
    const C = ctor();
    if (!C) return;
    const rec = new C();
    rec.lang = lang;
    rec.continuous = false; // one utterance per turn — resolves on a pause
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.cb.onInterim?.(interim);
      if (final.trim()) this.cb.onFinal?.(final.trim());
    };
    rec.onerror = (e) => {
      this.running = false;
      this.cb.onError?.(e.error);
    };
    rec.onend = () => {
      this.running = false;
    };
    this.rec = rec;
  }

  start() {
    if (!this.rec || this.running) return;
    try {
      this.rec.start();
      this.running = true;
    } catch {
      /* start() throws if already started; ignore */
    }
  }

  stop() {
    if (!this.rec) return;
    try {
      this.rec.stop();
    } catch {
      /* ignore */
    }
    this.running = false;
  }

  dispose() {
    if (!this.rec) return;
    this.rec.onresult = null;
    this.rec.onerror = null;
    this.rec.onend = null;
    try {
      this.rec.abort();
    } catch {
      /* ignore */
    }
    this.rec = null;
  }
}

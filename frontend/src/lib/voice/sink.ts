/**
 * A one-slot registry that decouples the interview store from voice mode.
 *
 * The interview store owns the single LLM streaming path (`start`/`send`/
 * `submitCode` via streamSSE). When voice mode is active it registers a sink
 * here; the store feeds every assistant token delta to `pushText` and calls
 * `flush` when the turn ends. In text mode the sink is null and the store's
 * calls are no-ops — so there is exactly one code path for the model turn.
 */

export interface VoiceSink {
  pushText: (delta: string) => void;
  flush: () => void;
}

let active: VoiceSink | null = null;

export function setVoiceSink(sink: VoiceSink | null) {
  active = sink;
}

export function getVoiceSink(): VoiceSink | null {
  return active;
}

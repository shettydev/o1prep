import { create } from "zustand";
import type { EngineConfig, FullProblem, RunResult, TestResults } from "@/lib/types";
import * as api from "@/lib/api";
import { streamSSE } from "@/lib/sse";
import { getVoiceSink } from "@/lib/voice/sink";
import { requestSettings, useSettings } from "@/store/settings";

export type ChatItem =
  | { id: string; role: "user" | "assistant"; content: string }
  | { id: string; role: "tests"; tests: TestResults };

type OutputTab = "output" | "tests";

interface InterviewState {
  // session
  sessionId: string | null;
  problem: FullProblem | null;
  config: EngineConfig | null;
  language: string;
  code: string;
  status: "booting" | "ready" | "error";
  error: string | null;

  // chat
  items: ChatItem[];
  streaming: boolean;

  // output panel
  outputTab: OutputTab;
  outputOpen: boolean;
  running: boolean;
  runResult: RunResult | null;
  testResults: TestResults | null;
  testError: string | null;

  // tutor
  tutorOpen: boolean;
  tutorItems: ChatItem[];
  tutorStreaming: boolean;

  // actions
  init: (problemId: number) => Promise<void>;
  resume: (sessionId: string) => Promise<void>;
  start: () => Promise<void>;
  setCode: (code: string) => void;
  changeLanguage: (lang: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  submitCode: (note: string) => Promise<void>;
  runCode: () => Promise<void>;
  runTests: () => Promise<void>;
  clearEditor: () => void;
  setOutputTab: (t: OutputTab) => void;
  setOutputOpen: (v: boolean) => void;
  toggleTutor: () => void;
  tutorSend: (text: string) => Promise<void>;
  end: () => Promise<void>;
  reset: () => void;
}

let uid = 0;
const nextId = () => `m${uid++}`;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
// "Latest wins" guard: every init() bumps this; a run that's been superseded
// (e.g. React StrictMode's double mount, or fast re-navigation) bails at its
// next await so we never create duplicate sessions or double the /start stream.
let initSeq = 0;

function placeholder(lang: string) {
  const c = lang === "javascript" || lang === "typescript" ? "//" : "#";
  return `${c} Write your solution here\n\n`;
}
function isPlaceholder(code: string) {
  const trimmed = (code || "").trim();
  return trimmed === "" || /^(#|\/\/)\s*Write your solution here$/.test(trimmed);
}

// Append/replace the trailing assistant bubble while streaming tokens in.
function upsertAssistant(items: ChatItem[], id: string, content: string): ChatItem[] {
  const idx = items.findIndex((m) => m.id === id);
  if (idx === -1) return [...items, { id, role: "assistant", content }];
  const next = items.slice();
  next[idx] = { id, role: "assistant", content };
  return next;
}

export const useInterview = create<InterviewState>((set, get) => ({
  sessionId: null,
  problem: null,
  config: null,
  language: "python",
  code: "",
  status: "booting",
  error: null,

  items: [],
  streaming: false,

  outputTab: "output",
  outputOpen: false,
  running: false,
  runResult: null,
  testResults: null,
  testError: null,

  tutorOpen: false,
  tutorItems: [],
  tutorStreaming: false,

  init: async (problemId) => {
    const seq = ++initSeq;
    const current = () => seq === initSeq;
    set({ status: "booting", error: null, items: [], tutorItems: [] });
    try {
      const config = await api.getConfig();
      const savedLang = useSettings.getState().language;
      const language = config.languages.some((l) => l.id === savedLang)
        ? savedLang
        : config.default_language;
      const problem = await api.getProblem(problemId, language).catch(() => null);
      if (!current()) return;
      const session = await api.createSession({
        focus: problem?.category ?? "general",
        mode: "text",
        problem_id: problemId,
        language,
        ...requestSettings(),
      });
      if (!current()) return;
      set({
        config,
        language,
        problem,
        sessionId: session.id,
        code: problem?.starter_code || placeholder(language),
        status: "ready",
      });
      await get().start();
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Could not start the interview session.",
      });
    }
  },

  setCode: (code) => {
    set({ code });
    const { sessionId } = get();
    if (!sessionId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => api.saveCode(sessionId, code), 1500);
  },

  changeLanguage: async (lang) => {
    const { sessionId, code, problem } = get();
    if (lang === get().language) return;
    if (
      !isPlaceholder(code) &&
      !window.confirm(`Switch to ${lang}? This replaces the editor with ${lang} starter code.`)
    ) {
      return;
    }
    set({ language: lang });
    if (sessionId) await api.setSessionLanguage(sessionId, lang);
    let starter = placeholder(lang);
    if (problem) {
      const full = await api.getProblem(problem.id, lang).catch(() => null);
      if (full?.starter_code) starter = full.starter_code;
    }
    set({ code: starter, runResult: null, testResults: null, testError: null });
  },

  resume: async (sessionId) => {
    const seq = ++initSeq;
    const current = () => seq === initSeq;
    set({ status: "booting", error: null, items: [], tutorItems: [] });
    try {
      const config = await api.getConfig();
      const detail = await api.getSession(sessionId);
      if (!current()) return;
      const problem = detail.problem_id
        ? await api.getProblem(detail.problem_id, detail.language).catch(() => null)
        : null;
      if (!current()) return;
      const language = detail.language || config.default_language;
      const items: ChatItem[] = detail.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          id: nextId(),
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));
      set({
        config,
        language,
        problem,
        sessionId: detail.id,
        code: detail.code || placeholder(language),
        items,
        status: "ready",
      });
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Could not load that session.",
      });
    }
  },

  start: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const aid = nextId();
    set({ streaming: true });
    try {
      await streamSSE(
        `/sessions/${sessionId}/start`,
        {},
        {
          onContent: (full, delta) => {
            set((s) => ({ items: upsertAssistant(s.items, aid, full) }));
            getVoiceSink()?.pushText(delta);
          },
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      set((s) => ({ items: upsertAssistant(s.items, aid, `_Error: ${msg}_`) }));
    } finally {
      getVoiceSink()?.flush();
      set({ streaming: false });
    }
  },

  send: async (text) => {
    const { sessionId, streaming } = get();
    if (!sessionId || streaming || !text.trim()) return;
    const aid = nextId();
    set((s) => ({
      streaming: true,
      items: [...s.items, { id: nextId(), role: "user", content: text }],
    }));
    try {
      await streamSSE(
        `/sessions/${sessionId}/chat`,
        { message: text },
        {
          onContent: (full, delta) => {
            set((s) => ({ items: upsertAssistant(s.items, aid, full) }));
            getVoiceSink()?.pushText(delta);
          },
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      set((s) => ({ items: upsertAssistant(s.items, aid, `_Error: ${msg}_`) }));
    } finally {
      getVoiceSink()?.flush();
      set({ streaming: false });
    }
  },

  submitCode: async (note) => {
    const { sessionId, streaming, code, language } = get();
    if (!sessionId || streaming || isPlaceholder(code)) return;
    const text = note.trim() || "Here's my solution:";
    const display = `${text}\n\n\`\`\`${language}\n${code}\n\`\`\``;
    const aid = nextId();
    set((s) => ({
      streaming: true,
      items: [...s.items, { id: nextId(), role: "user", content: display }],
    }));
    try {
      await streamSSE(
        `/sessions/${sessionId}/chat`,
        { message: text, code },
        {
          onTestResults: (tests) =>
            set((s) => ({ items: [...s.items, { id: nextId(), role: "tests", tests }] })),
          onContent: (full, delta) => {
            set((s) => ({ items: upsertAssistant(s.items, aid, full) }));
            getVoiceSink()?.pushText(delta);
          },
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      set((s) => ({ items: upsertAssistant(s.items, aid, `_Error: ${msg}_`) }));
    } finally {
      getVoiceSink()?.flush();
      set({ streaming: false });
    }
  },

  runCode: async () => {
    const { code, language } = get();
    if (isPlaceholder(code)) return;
    set({ outputOpen: true, outputTab: "output", running: true, runResult: null });
    try {
      const runResult = await api.runCode(code, language);
      set({ runResult });
    } catch (e) {
      set({
        runResult: {
          stdout: "",
          stderr: e instanceof Error ? e.message : "run failed",
          exit_code: 1,
        },
      });
    } finally {
      set({ running: false });
    }
  },

  runTests: async () => {
    const { sessionId, code } = get();
    if (!sessionId || isPlaceholder(code)) return;
    set({
      outputOpen: true,
      outputTab: "tests",
      running: true,
      testResults: null,
      testError: null,
    });
    try {
      const testResults = await api.runTests(sessionId, code);
      set({ testResults });
    } catch (e) {
      set({ testError: e instanceof Error ? e.message : "test run failed" });
    } finally {
      set({ running: false });
    }
  },

  clearEditor: () => {
    if (window.confirm("Clear the editor?")) set({ code: placeholder(get().language) });
  },

  setOutputTab: (outputTab) => set({ outputTab, outputOpen: true }),
  setOutputOpen: (outputOpen) => set({ outputOpen }),
  toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),

  tutorSend: async (text) => {
    const { problem, tutorStreaming, tutorItems } = get();
    if (tutorStreaming || !text.trim()) return;
    const history = tutorItems.map((m) =>
      m.role === "tests" ? { role: "user", content: "" } : { role: m.role, content: m.content },
    );
    const aid = nextId();
    set((s) => ({
      tutorStreaming: true,
      tutorItems: [...s.tutorItems, { id: nextId(), role: "user", content: text }],
    }));
    try {
      await streamSSE(
        "/research/chat",
        { problem_id: problem?.id ?? null, message: text, history, ...requestSettings() },
        {
          onContent: (full) =>
            set((s) => ({ tutorItems: upsertAssistant(s.tutorItems, aid, full) })),
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream error";
      set((s) => ({ tutorItems: upsertAssistant(s.tutorItems, aid, `_Error: ${msg}_`) }));
    } finally {
      set({ tutorStreaming: false });
    }
  },

  end: async () => {
    const { sessionId } = get();
    if (sessionId) await api.endSession(sessionId);
  },

  reset: () =>
    set({
      sessionId: null,
      problem: null,
      items: [],
      tutorItems: [],
      code: "",
      status: "booting",
      error: null,
      runResult: null,
      testResults: null,
      testError: null,
      outputOpen: false,
      tutorOpen: false,
    }),
}));

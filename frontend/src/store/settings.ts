import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EngineConfig } from "@/lib/types";
import { getConfig } from "@/lib/api";

interface SettingsState {
  config: EngineConfig | null;
  // user choices — empty string means "use the server default"
  model: string;
  effort: string;
  language: string;

  loadConfig: () => Promise<void>;
  set: (patch: { model?: string; effort?: string; language?: string }) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      config: null,
      model: "",
      effort: "",
      language: "",
      loadConfig: async () => {
        try {
          const config = await getConfig();
          set({ config });
        } catch {
          /* leave config null — callers fall back to plain defaults */
        }
      },
      set: (patch) => set(patch),
    }),
    {
      name: "engineSettings",
      // Only persist the user's choices, never the fetched config.
      partialize: (s) => ({ model: s.model, effort: s.effort, language: s.language }),
    },
  ),
);

/** {model?, effort?} to merge into request bodies — only keys the user chose. */
export function requestSettings(): { model?: string; effort?: string } {
  const { model, effort } = useSettings.getState();
  const out: { model?: string; effort?: string } = {};
  if (model) out.model = model;
  if (effort) out.effort = effort;
  return out;
}

/** The saved language if still supported, else the server/plain default. */
export function effectiveLanguage(): string {
  const { language, config } = useSettings.getState();
  const langs = config?.languages ?? [];
  if (language && langs.some((l) => l.id === language)) return language;
  return config?.default_language ?? "python";
}

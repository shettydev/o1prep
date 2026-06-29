import { create } from "zustand";

type Panel = "history" | "progress" | "settings";

interface UIState {
  history: boolean;
  progress: boolean;
  settings: boolean;
  open: (p: Panel) => void;
  close: (p: Panel) => void;
  toggle: (p: Panel) => void;
}

export const useUI = create<UIState>((set) => ({
  history: false,
  progress: false,
  settings: false,
  open: (p) => set({ [p]: true } as Partial<UIState>),
  close: (p) => set({ [p]: false } as Partial<UIState>),
  toggle: (p) => set((s) => ({ [p]: !s[p] }) as Partial<UIState>),
}));

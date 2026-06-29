import { create } from "zustand";
import * as api from "@/lib/api";

type AuthStatus = "loading" | "authed" | "anon";

interface AuthStore {
  status: AuthStatus;
  email: string | null;

  check: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  status: "loading",
  email: null,

  check: async () => {
    try {
      const me = await api.getMe();
      set(
        me.authenticated
          ? { status: "authed", email: me.email ?? null }
          : { status: "anon", email: null },
      );
    } catch {
      // API unreachable — treat as signed out so the overlay (with its error
      // affordance) shows rather than hanging on the boot screen.
      set({ status: "anon", email: null });
    }
  },

  // login/register throw ApiError on failure so the form can show the message.
  login: async (email, password) => {
    const res = await api.login(email, password);
    set({ status: "authed", email: res.email ?? null });
  },
  register: async (email, password) => {
    const res = await api.register(email, password);
    set({ status: "authed", email: res.email ?? null });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* ignore — sign out locally regardless */
    }
    set({ status: "anon", email: null });
  },
}));

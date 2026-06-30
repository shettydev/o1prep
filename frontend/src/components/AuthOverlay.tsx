"use client";

import { useState } from "react";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Logo } from "@/components/Logo";

type Mode = "login" | "register";

export function AuthOverlay() {
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy =
    mode === "login"
      ? { sub: "authenticate to continue", cta: "sign in", alt: "create an account" }
      : { sub: "register a new operator", cta: "create account", alt: "sign in instead" };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
      // success: the gate re-renders into the app automatically.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="text-4xl" />
          <div className="mt-2 text-[11px] text-text-faint">
            <span className="text-green">●</span> secure shell // {copy.sub}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 border border-line bg-bg-raised p-5 shadow-[0_0_30px_rgba(0,0,0,0.6)]"
        >
          <label className="block">
            <span className="label">email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mt-1 w-full border border-line bg-bg-inset px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-amber focus:outline-none"
              placeholder="operator@domain.dev"
            />
          </label>

          <label className="block">
            <span className="label">password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              className="mt-1 w-full border border-line bg-bg-inset px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-amber focus:outline-none"
              placeholder={mode === "register" ? "min 8 characters" : "••••••••"}
            />
          </label>

          {error && (
            <div className="border border-red/40 bg-red/5 px-3 py-2 text-[12px] text-red">
              ✕ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="tbtn tbtn-amber w-full justify-center py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "authenticating…" : `▸ ${copy.cta}`}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-text-dim">
          <button
            onClick={toggle}
            className="text-amber-dim underline-offset-2 hover:text-amber hover:underline"
          >
            {copy.alt}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useProblems } from "@/store/problems";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
import { Logo } from "@/components/Logo";

/**
 * Global top bar for the landing view. Mode toggle + history/settings get fully
 * wired in later phases; here they establish the chrome and the progress chip
 * reflects real attempt data.
 */
export function TopBar() {
  const total = useProblems((s) => s.problems.length);
  const done = useProblems((s) => Object.keys(s.attempts).length);
  const email = useAuth((s) => s.email);
  const signOut = useAuth((s) => s.logout);
  const openPanel = useUI((s) => s.open);
  const [mode, setMode] = useState<"text" | "voice">("text");

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur-sm sm:px-6">
      {/* Wordmark */}
      <div className="flex items-baseline gap-2">
        <Logo className="text-xl sm:text-2xl" />
        <span className="hidden text-[11px] text-text-faint sm:inline">interview://terminal</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* TODO: Mode toggle — voice is wired in a later phase; cosmetic for now. */}
        {/*<div className="hidden border border-line sm:flex">
          {(["text", "voice"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${
                mode === m ? "bg-amber/10 text-amber" : "text-text-dim hover:text-text"
              }`}
            >
              {m}
            </button>
          ))}
        </div>*/}

        {/* Progress chip → progress drawer */}
        <button
          onClick={() => openPanel("progress")}
          className="hidden items-center gap-2 border border-line px-3 py-1.5 text-[11px] text-text-dim hover:border-line-bright hover:text-text sm:flex"
          title="Progress"
        >
          <span className="text-green">▸</span>
          <span>
            <span className="text-text">{done}</span>
            <span className="text-text-faint"> / {total}</span> done
          </span>
        </button>

        <button onClick={() => openPanel("history")} className="tbtn" title="Past interviews">
          ⟲<span className="hidden sm:inline"> history</span>
        </button>
        <button onClick={() => openPanel("settings")} className="tbtn" title="Engine settings">
          ⚙<span className="hidden sm:inline"> settings</span>
        </button>

        {/* Signed-in identity + sign out */}
        {email && (
          <span
            className="hidden max-w-[160px] truncate text-[11px] text-text-faint md:inline"
            title={`signed in as ${email}`}
          >
            {email}
          </span>
        )}
        <button onClick={signOut} className="tbtn" title="Sign out">
          ⏻<span className="hidden sm:inline"> exit</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";

// Module-level: the first boot of a full page-load gets the full typewriter
// ceremony; later in-app navigations run fast so repeat visits don't drag.
// Resets naturally on a hard reload (which is a genuine cold boot).
let warmBoot = false;

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Terminal boot screen that gates `children`. While `active` (real work in
 * flight) OR the type-out animation hasn't finished, it shows a typewriter
 * status line; once both are done it reveals `children`. The animation IS the
 * minimum delay — it runs concurrently with the work, never added on top, so
 * fast loads still feel intentional and slow loads add nothing.
 */
export function BootScreen({
  active,
  text,
  children,
}: {
  active: boolean;
  text: string;
  children: React.ReactNode;
}) {
  const [typed, setTyped] = useState(0);
  const [typedDone, setTypedDone] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced = reducedMotion();
    const warm = warmBoot;
    const speed = warm ? 28 : 50; // ms/char
    const hold = reduced ? 120 : warm ? 160 : 600; // settle beat after the line

    let timer: ReturnType<typeof setTimeout>;
    let holdTimer: ReturnType<typeof setTimeout>;

    // Settle on the finished line, then reveal after the hold.
    const settle = () => {
      setTypedDone(true);
      holdTimer = setTimeout(() => {
        setDone(true);
        warmBoot = true;
      }, hold);
    };

    if (reduced) {
      // Show the whole line at once (no per-char motion), then a tiny floor.
      timer = setTimeout(() => {
        setTyped(text.length);
        settle();
      }, 0);
      return () => {
        clearTimeout(timer);
        clearTimeout(holdTimer);
      };
    }

    let i = 0;
    const tick = () => {
      i += 1;
      setTyped(i);
      if (i >= text.length) {
        settle();
        return;
      }
      // Burst-type: jitter ±40%, and blow through spaces so it chunks at words.
      const ch = text[i - 1];
      const delay = ch === " " ? speed * 0.3 : speed * (0.6 + Math.random() * 0.8);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, speed);
    return () => {
      clearTimeout(timer);
      clearTimeout(holdTimer);
    };
  }, [text]);

  if (!active && done) return <>{children}</>;

  const busy = active && done; // line typed out but the work is still running

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      role="status"
      aria-busy={active}
    >
      {/* announced once to assistive tech; the visible line is decorative motion */}
      <span className="sr-only">{text}</span>
      <div aria-hidden className="font-mono text-[13px] tracking-wide text-text-dim sm:text-sm">
        <span className="text-amber">O(1) ▸ </span>
        <span className="text-text">{text.slice(0, typed)}</span>
        {typedDone ? <span className="cursor" /> : <span className="text-amber">▋</span>}
        {busy && <span className="dots ml-0.5 text-text-faint" />}
        {typedDone && !busy && (
          <span className="rise ml-3 text-[0.85em] text-text-faint">~ O(1)</span>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

const TYPE_MS = 40; // ms/char
const SETTLE_MS = 400; // hold on the finished line before revealing
const FLY_MS = 440; // caret travel
const FLY_EASE = "cubic-bezier(0.2, 0, 0, 1)"; // emphasized: fast out, long settle

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

type Phase = "boot" | "fly" | "done";

/**
 * Root boot screen for the app. Types `establishing session`, then reveals
 * `children`. On a true full reload of the problems-list page while signed in,
 * the boot caret physically flies up into the navbar logo and becomes its
 * caret (a FLIP shared-element move). Everywhere else it reveals instantly once
 * the line is typed. Any measurement failure degrades gracefully to an instant
 * reveal — it never leaves the app stuck.
 */
export function AppBoot({
  active,
  authed,
  children,
}: {
  active: boolean;
  authed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [typed, setTyped] = useState(0);
  const [typedDone, setTypedDone] = useState(false);
  const [animComplete, setAnimComplete] = useState(false); // typed + settle done
  const [phase, setPhase] = useState<Phase>("boot");
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties | null>(null);
  const [revealing, setRevealing] = useState(false);

  const TEXT = "establishing session";
  const bootCaretRef = useRef<HTMLSpanElement | null>(null);
  const flyRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  // ── Typewriter (concurrent with the auth check) ──
  useEffect(() => {
    const reduced = reducedMotion();
    let timer: ReturnType<typeof setTimeout>;
    let holdTimer: ReturnType<typeof setTimeout>;

    const settle = () => {
      setTypedDone(true);
      holdTimer = setTimeout(() => setAnimComplete(true), reduced ? 120 : SETTLE_MS);
    };

    if (reduced) {
      timer = setTimeout(() => {
        setTyped(TEXT.length);
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
      if (i >= TEXT.length) {
        settle();
        return;
      }
      const ch = TEXT[i - 1];
      const delay = ch === " " ? TYPE_MS * 0.3 : TYPE_MS * (0.6 + Math.random() * 0.8);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, TYPE_MS);
    return () => {
      clearTimeout(timer);
      clearTimeout(holdTimer);
    };
  }, []);

  // ── Reveal (instant, or the caret-fly) once typing+settle AND auth resolve ──
  useEffect(() => {
    if (startedRef.current || !animComplete || active) return;
    startedRef.current = true;

    const flyEligible = !reducedMotion() && pathname === "/" && authed;

    const revealInstant = () => raf().then(() => setPhase("done"));

    if (!flyEligible) {
      revealInstant();
      return;
    }

    const fly = async () => {
      try {
        // Measure the launch point while the boot caret is still on screen.
        const fromEl = bootCaretRef.current;
        if (!fromEl) return revealInstant();
        const from = fromEl.getBoundingClientRect();

        // Render the app (hidden) + hold an empty caret slot in the logo.
        document.documentElement.classList.add("caret-flying");
        setPhase("fly");

        // Wait for the monospace font + layout to settle, then measure the slot.
        await (document.fonts?.ready ?? Promise.resolve());
        await raf();
        await raf();
        const toEl = document.querySelector<HTMLElement>("[data-brand-caret]");
        if (!toEl) throw new Error("no destination caret");
        const to = toEl.getBoundingClientRect();

        // Place the travelling cursor at the launch point, sized to the
        // destination so the arrival is pixel-exact.
        setFlyStyle({
          position: "fixed",
          left: Math.round(from.left),
          top: Math.round(from.top),
          width: Math.round(to.width),
          height: Math.round(to.height),
          background: "var(--amber)",
          boxShadow: "0 0 8px var(--amber-glow)",
          transformOrigin: "top left",
          zIndex: 60,
          pointerEvents: "none",
        });
        await raf();

        const el = flyRef.current;
        if (!el) throw new Error("no fly element");

        const dx = Math.round(to.left - from.left);
        const dy = Math.round(to.top - from.top);
        const s0 = from.height / to.height; // start at boot-caret size, grow to logo
        const lift = -Math.min(46, Math.hypot(dx, dy) * 0.12); // gentle arc

        // The app "develops in" over the back half of the flight.
        setTimeout(() => setRevealing(true), FLY_MS * 0.45);

        const anim = el.animate(
          [
            { transform: `translate(0px,0px) scale(${s0})` },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(${(s0 + 1) / 2})`,
              offset: 0.5,
            },
            { transform: `translate(${dx}px,${dy}px) scale(1)` },
          ],
          { duration: FLY_MS, easing: FLY_EASE, fill: "forwards" },
        );
        await anim.finished;

        // Same-frame handoff: the real logo caret takes over (and starts blinking).
        document.documentElement.classList.remove("caret-flying");
        setPhase("done");
      } catch {
        document.documentElement.classList.remove("caret-flying");
        setRevealing(true);
        setPhase("done");
      }
    };

    fly();
    // Safety net: never stay stuck on the boot screen.
    const bail = setTimeout(() => {
      document.documentElement.classList.remove("caret-flying");
      setPhase("done");
    }, 4000);
    return () => clearTimeout(bail);
  }, [animComplete, active, authed, pathname]);

  const showFly = phase === "fly";

  return (
    <>
      {/* The app mounts once the boot ends and STAYS mounted (no remount across
          fly→done, so it never re-fetches). Hidden+inert during the fly. */}
      {phase !== "boot" && (
        <div
          inert={phase === "fly" && !revealing}
          style={
            phase === "done"
              ? undefined
              : { opacity: revealing ? 1 : 0, transition: "opacity 300ms ease" }
          }
        >
          {children}
        </div>
      )}

      {/* The boot line — fades out as the caret launches. */}
      {phase !== "done" && (
        <main
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          role="status"
          aria-busy={active}
          style={{
            opacity: showFly ? 0 : 1,
            transition: showFly ? "opacity 150ms ease" : undefined,
            pointerEvents: showFly ? "none" : undefined,
          }}
        >
          <span className="sr-only">{TEXT}</span>
          <div aria-hidden className="font-mono text-[13px] tracking-wide text-text-dim sm:text-sm">
            <span className="text-amber">O(1) ▸ </span>
            <span className="text-text">{TEXT.slice(0, typed)}</span>
            {/* a solid block (measurable + matches the travelling cursor exactly) —
                blinks once settled, solid while flying */}
            <span
              ref={bootCaretRef}
              aria-hidden
              className={typedDone && !showFly ? "blink" : ""}
              style={{
                display: "inline-block",
                width: "0.5em",
                height: "0.95em",
                marginLeft: "0.08em",
                transform: "translateY(0.12em)",
                background: "var(--amber)",
                boxShadow: "0 0 8px var(--amber-glow)",
              }}
            />
          </div>
        </main>
      )}

      {/* The travelling caret (portal at body root → no transformed ancestor). */}
      {showFly &&
        flyStyle &&
        typeof document !== "undefined" &&
        createPortal(<div ref={flyRef} aria-hidden style={flyStyle} />, document.body)}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionSummary } from "@/lib/types";
import { deleteSession, getSessions } from "@/lib/api";
import { useUI } from "@/store/ui";
import { Drawer } from "./Drawer";
import { StatusDot } from "./ui";

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Mounted only while the drawer is open, so it fetches fresh on each open. */
function HistoryList({ onResume }: { onResume: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    getSessions()
      .then((d) => alive && setSessions(d))
      .catch(() => alive && setSessions([]));
    return () => {
      alive = false;
    };
  }, []);

  const remove = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  };

  if (sessions === null) {
    return <div className="p-4 text-[12px] text-text-faint">loading…</div>;
  }
  if (sessions.length === 0) {
    return (
      <div className="p-6 text-center text-[13px] text-text-dim">
        <span className="text-text-faint">{"// "}</span>no past interviews yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {sessions.map((s) => (
        <div key={s.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-hover">
          <StatusDot rating={s.rating} />
          <button onClick={() => onResume(s.id)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[13px] text-text group-hover:text-amber-bright">
              {s.problem_title || s.focus || "Technical Interview"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-faint">
              <span>{when(s.started_at)}</span>
              <span>·</span>
              <span>{s.message_count} msgs</span>
              {s.mode === "voice" && <span className="text-amber-dim">· voice</span>}
              {s.status === "completed" && <span className="text-green">· done</span>}
            </div>
          </button>
          <button
            onClick={() => remove(s.id)}
            title="Delete"
            className="shrink-0 px-1.5 text-text-faint opacity-0 transition-opacity hover:text-red group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function HistoryDrawer() {
  const open = useUI((s) => s.history);
  const close = useUI((s) => s.close);
  const router = useRouter();

  const resume = (id: string) => {
    close("history");
    router.push(`/interview/session/${id}`);
  };

  return (
    <Drawer open={open} onClose={() => close("history")} title="past interviews">
      {open && <HistoryList onResume={resume} />}
    </Drawer>
  );
}

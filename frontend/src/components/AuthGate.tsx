"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { AuthOverlay } from "./AuthOverlay";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const check = useAuth((s) => s.check);

  useEffect(() => {
    check();
  }, [check]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[13px] text-text-dim">
          <span className="text-amber">$</span> establishing session
          <span className="cursor" />
        </div>
      </div>
    );
  }

  if (status === "anon") return <AuthOverlay />;

  return <>{children}</>;
}

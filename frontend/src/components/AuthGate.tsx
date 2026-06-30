"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { AuthOverlay } from "./AuthOverlay";
import { BootScreen } from "./BootScreen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const check = useAuth((s) => s.check);

  useEffect(() => {
    check();
  }, [check]);

  return (
    <BootScreen active={status === "loading"} text="establishing session">
      {status === "anon" ? <AuthOverlay /> : children}
    </BootScreen>
  );
}

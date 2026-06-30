"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { AuthOverlay } from "./AuthOverlay";
import { AppBoot } from "./AppBoot";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const check = useAuth((s) => s.check);

  useEffect(() => {
    check();
  }, [check]);

  return (
    <AppBoot active={status === "loading"} authed={status === "authed"}>
      {status === "anon" ? <AuthOverlay /> : children}
    </AppBoot>
  );
}

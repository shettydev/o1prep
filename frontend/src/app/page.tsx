"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProblemList } from "@/components/ProblemList";
import { CommandPalette } from "@/components/CommandPalette";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { ProgressDrawer } from "@/components/ProgressDrawer";
import { SettingsModal } from "@/components/SettingsModal";
import { useProblems } from "@/store/problems";
import { useSettings } from "@/store/settings";

export default function Home() {
  const load = useProblems((s) => s.load);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    load();
    loadConfig();
  }, [load, loadConfig]);

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <TopBar />
      {/* On desktop the page is pinned to the viewport and each panel scrolls
          on its own; on mobile it falls back to normal page scroll. */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <FilterSidebar onOpenPalette={() => setPaletteOpen(true)} />
        <ProblemList />
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <HistoryDrawer />
      <ProgressDrawer />
      <SettingsModal />
    </main>
  );
}

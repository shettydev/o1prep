"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProblemList } from "@/components/ProblemList";
import { CommandPalette } from "@/components/CommandPalette";
import { useProblems } from "@/store/problems";

export default function Home() {
  const load = useProblems((s) => s.load);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

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
    <main className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col lg:flex-row">
        <FilterSidebar onOpenPalette={() => setPaletteOpen(true)} />
        <ProblemList />
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </main>
  );
}

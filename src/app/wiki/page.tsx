import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { WikiExplorer } from "./wiki-explorer";
import { createClient } from "@/lib/supabase/server";
import { getAllWikiEntriesForListing } from "@/lib/db/wiki";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "百科 — Mathiverse",
  description:
    "数学百科词条：源自 Wikipedia，AI 精修，配合 Manim 动画直观理解数学与计算机科学概念。",
};

export default async function WikiPage() {
  const supabase = await createClient();
  const entries = supabase ? await getAllWikiEntriesForListing(supabase) : [];

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-5xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal tracking-[-0.5px] text-[#141413]">
            百科
          </h1>
          <p className="text-[#6c6a64] text-sm">
            源自 Wikipedia · AI 精修 · 让数学动起来
          </p>
          <p className="text-[#6c6a64]/60 text-xs">
            {entries.length} 个词条
          </p>
        </div>

        <WikiExplorer entries={entries} />
      </main>
    </div>
  );
}

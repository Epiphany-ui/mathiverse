import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { WikiExplorer } from "./wiki-explorer";
import { createClient } from "@/lib/supabase/server";
import { getAllWikiEntriesForListing } from "@/lib/db/wiki";
import Link from "next/link";
import { Suspense } from "react";
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
          <p className="text-[#6c6a64]/60 text-xs mb-4">
            {entries.length} 个词条
          </p>
          <Link href="/wiki/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#cc785c] text-white text-sm hover:bg-[#a9583e] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            创建词条
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 p-5 h-40 skeleton-shimmer"
                />
              ))}
            </div>
          }
        >
          <WikiExplorer entries={entries} />
        </Suspense>
      </main>
    </div>
  );
}

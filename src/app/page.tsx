import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { FeedGrid } from "@/components/community/feed-grid";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
  Code2,
  Play,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildFeedItems } from "@/lib/db/queries";

export default async function Home() {
  const supabase = await createClient();
  const feedItems = supabase ? await buildFeedItems(supabase, "hot") : [];

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center z-10 max-w-4xl mx-auto">
        <p className="text-xs font-medium tracking-[1.5px] uppercase text-[#6c6a64] mb-6">
          AI 驱动 · Manim 渲染 · 社区驱动
        </p>

        <h1 className="font-[family-name:var(--font-cormorant)] text-5xl md:text-7xl font-normal leading-[1.05] tracking-[-1.5px] text-[#141413] max-w-2xl">
          让数学在你眼前
          <br />
          动起来
        </h1>

        <p className="mt-6 text-lg text-[#3d3d3a] max-w-lg leading-relaxed">
          用自然语言描述数学概念，AI 生成 Manim 动画代码，
          <br />
          本地渲染为视频，发布到社区与全世界的数学爱好者交流。
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link href="/sandbox">
            <Button
              size="lg"
              className="h-12 px-8 text-sm font-medium gap-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg"
            >
              <Sparkles className="w-4 h-4" />
              开始创作
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Button>
          </Link>
          <Link href="/explore">
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-sm font-medium gap-2 bg-white border-[#e6dfd8] text-[#141413] hover:bg-[#faf9f5] rounded-lg"
            >
              <Play className="w-4 h-4" />
              浏览社区
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-12 text-center">
          {[
            { label: "可视化作品", value: `${feedItems.filter((i) => i.type === "visualization").length || "—"}` },
            { label: "教程文章", value: `${feedItems.filter((i) => i.type === "article").length || "—"}` },
            { label: "创作者", value: "—" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-normal font-[family-name:var(--font-cormorant)] text-[#141413]">
                {stat.value}
              </p>
              <p className="text-sm text-[#6c6a64]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Feed Section ─── */}
      <section className="relative z-10 px-6 pb-24 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-normal tracking-[-0.3px] text-[#141413]">
            热门内容
          </h2>
          <div className="flex items-center gap-1 ml-4">
            <Button variant="ghost" size="sm" className="gap-1.5 text-[#cc785c] bg-[#efe9de] rounded-lg">
              <TrendingUp className="w-4 h-4" />
              热门
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-[#6c6a64] rounded-lg">
              <Clock className="w-4 h-4" />
              最新
            </Button>
          </div>
          <div className="flex-1" />
          <Link href="/explore">
            <Button variant="ghost" size="sm" className="gap-1 text-[#6c6a64]">
              发现更多
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <FeedGrid items={feedItems} />
      </section>

      {/* ─── CTA ─── */}
      <section className="relative z-10 px-6 pb-32 max-w-2xl mx-auto w-full text-center">
        <GlassCard className="p-12 space-y-6" hover={false}>
          <Code2 className="w-10 h-10 mx-auto text-[#cc785c]" />
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-normal tracking-[-0.5px] text-[#141413]">
            准备好创作第一个可视化了吗？
          </h2>
          <p className="text-[#3d3d3a] max-w-sm mx-auto leading-relaxed">
            不需要会写代码。用自然语言描述你想看的数学动画，AI 生成
            Manim 代码，一键渲染发布。
          </p>
          <Link href="/sandbox">
            <Button
              size="lg"
              className="h-12 px-8 gap-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg"
            >
              <Sparkles className="w-4 h-4" />
              免费开始
            </Button>
          </Link>
        </GlassCard>
      </section>
    </div>
  );
}

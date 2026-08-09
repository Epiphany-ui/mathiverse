import { AppHeader } from "@/components/layout/app-header";
import { FeedGrid } from "@/components/community/feed-grid";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { TiltCard } from "@/components/shared/tilt-card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  Code2,
  Play,
  PenLine,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildFeedItems } from "@/lib/db/queries";

export default async function Home() {
  const supabase = await createClient();
  const feedItems = supabase ? await buildFeedItems(supabase, "hot") : [];

  return (
    <div className="min-h-screen flex flex-col relative">
      <AppHeader />

      {/* ─── Hero — Framer-style atmosphere blobs + Stripe-style tight type ─── */}
      <section className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center z-10 max-w-7xl mx-auto overflow-hidden">
        {/* Framer-style atmosphere blobs — large, bold, colorful */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 animate-float-slow"
          style={{ background: "radial-gradient(circle, #cc785c 0%, transparent 70%)" }} />
        <div className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full blur-[100px] opacity-15 animate-float"
          style={{ background: "radial-gradient(circle, #5db8a6 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-[20%] w-[400px] h-[400px] rounded-full blur-[80px] opacity-12 animate-float-fast"
          style={{ background: "radial-gradient(circle, #e8a55a 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[25%] w-[300px] h-[300px] rounded-full blur-[90px] opacity-10"
          style={{ background: "radial-gradient(circle, #7c5ce7 0%, transparent 70%)" }} />

        {/* Badge */}
        <div className="animate-fly-in-up opacity-0" style={{ animationDelay: "0.6s" }}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#e6dfd8] bg-white/60 backdrop-blur-sm text-xs font-medium tracking-[1.5px] uppercase text-[#6c6a64] mb-8">
            <Sparkles className="w-3 h-3 text-[#cc785c]" />
            AI 驱动 · Manim 渲染 · 社区驱动
          </span>
        </div>

        {/* Hero headline — tight tracking, bold scale */}
        <h1 className="font-[family-name:var(--font-cormorant)] text-7xl sm:text-8xl md:text-[100px] font-normal leading-[0.9] tracking-[-3px] text-[#141413] max-w-5xl">
          <span className="block overflow-hidden pb-2">
            <span className="block animate-fly-in-left opacity-0" style={{ animationDelay: "0.1s" }}>
              让数学在你眼前
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="block animate-fly-in-right opacity-0" style={{ animationDelay: "0.4s" }}>
              <span
                className="animate-char-bounce inline-block"
                style={{ color: "#cc785c", animationDelay: "1.3s" }}
              >
                动
              </span>
              <span className="text-[#141413]">起来</span>
            </span>
          </span>
        </h1>

        {/* Subtitle — Stripe-style thin weight */}
        <div className="animate-fly-in-up opacity-0 mt-10" style={{ animationDelay: "2s" }}>
          <p className="text-lg text-[#3d3d3a] max-w-xl leading-relaxed font-light tracking-[-0.2px]">
            用自然语言描述数学概念，AI 生成 Manim 动画代码，
            <br />
            本地渲染为视频，发布到社区与全世界的数学爱好者交流。
          </p>
        </div>

        {/* CTAs */}
        <div className="animate-fly-in-up opacity-0 mt-10" style={{ animationDelay: "2.3s" }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/sandbox">
              <Button
                size="lg"
                className="h-12 px-8 text-sm font-medium tracking-[-0.2px] gap-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-full hover-lift btn-press"
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
                className="h-12 px-8 text-sm font-medium tracking-[-0.2px] gap-2 bg-white/80 backdrop-blur-sm border-[#e6dfd8] text-[#141413] hover:bg-[#faf9f5] rounded-full hover-lift btn-press"
              >
                <Play className="w-4 h-4" />
                浏览社区
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-fly-in-up opacity-0 mt-24" style={{ animationDelay: "2.6s" }}>
          <div className="grid grid-cols-3 gap-16 text-center">
            {[
              { label: "可视化作品", value: `${feedItems.filter((i) => i.type === "visualization").length || "—"}` },
              { label: "教程文章", value: `${feedItems.filter((i) => i.type === "article").length || "—"}` },
              { label: "创作者", value: "—" },
            ].map((stat, i) => (
              <div key={stat.label} className={`reveal reveal-d${i + 1}`}>
                <p className="text-3xl font-normal font-[family-name:var(--font-cormorant)] tracking-[-0.5px] text-[#141413]">
                  {stat.value}
                </p>
                <p className="text-sm text-[#6c6a64] mt-1 font-light">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <ScrollReveal delay={3}>
          <div className="section-ornament mt-28 w-full max-w-xs mx-auto">
            <PenLine className="w-4 h-4" />
          </div>
        </ScrollReveal>
      </section>

      {/* ─── Feed Section ─── */}
      <section className="relative z-10 px-6 pb-20 max-w-6xl mx-auto w-full">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-10">
            <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-normal tracking-[-0.5px] text-[#141413]">
              热门内容
            </h2>
            <div className="flex items-center gap-2">
              <Link href="/explore">
                <Button variant="ghost" size="sm" className="gap-1 text-[#cc785c] bg-[#efe9de] rounded-full hover:bg-[#e8e0d2] transition-colors">
                  热门
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="gap-1 text-[#6c6a64] rounded-full">
                最新
              </Button>
            </div>
            <div className="flex-1" />
            <Link href="/explore">
              <Button variant="ghost" size="sm" className="gap-1 text-[#6c6a64] hover:text-[#141413] group">
                发现更多
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </ScrollReveal>

        <FeedGrid items={feedItems} />
      </section>

      {/* ─── CTA Section — dark surface card (Anthropic pattern) ─── */}
      <ScrollReveal>
        <section className="relative z-10 px-6 pb-32 max-w-2xl mx-auto w-full text-center">
          <TiltCard className="p-14 space-y-6 rounded-2xl border border-[#e6dfd8] bg-[#efe9de]/70 backdrop-blur-sm">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-2xl bg-[#cc785c]/10 flex items-center justify-center animate-float">
                <Code2 className="w-8 h-8 text-[#cc785c]" />
              </div>
            </div>
            <h2 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal tracking-[-0.5px] text-[#141413]">
              准备好创作第一个可视化了吗？
            </h2>
            <p className="text-[#3d3d3a] max-w-sm mx-auto leading-relaxed text-base font-light">
              不需要会写代码。用自然语言描述你想看的数学动画，AI 生成
              Manim 代码，一键渲染发布。
            </p>
            <Link href="/sandbox">
              <Button
                size="lg"
                className="h-12 px-8 gap-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-full hover-lift btn-press"
              >
                <Sparkles className="w-4 h-4" />
                免费开始
              </Button>
            </Link>
          </TiltCard>
        </section>
      </ScrollReveal>
    </div>
  );
}

import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { FeedGrid } from "@/components/community/feed-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  ArrowRight,
  Code2,
  Play,
} from "lucide-react";
import Link from "next/link";
import { buildFeedItems } from "@/lib/db/mock-data";

export default function Home() {
  const feedItems = buildFeedItems("hot");

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />

      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />

        <Badge
          variant="outline"
          className="mb-6 px-4 py-1.5 text-sm border-primary/30 text-primary/90 animate-pulse"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          AI 驱动 · Manim 渲染
        </Badge>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-3xl leading-tight">
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            让数学
          </span>
          <br />
          在你眼前动起来
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
          探索由 AI 生成、Manim 渲染的数学可视化动画。
          <br />
          用自然语言描述想法，一键生成专业级动画，与全世界的数学爱好者交流。
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Link href="/sandbox" className="flex-1">
            <Button
              size="lg"
              className="w-full h-14 text-base gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/20"
            >
              <Sparkles className="w-5 h-5" />
              开始创作
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="/explore" className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base gap-2 glass hover:bg-white/5"
            >
              <Play className="w-5 h-5" />
              浏览社区
            </Button>
          </Link>
        </div>

        {/* Hero Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-center">
          {[
            { label: "可视化作品", value: "1,234" },
            { label: "创作者", value: "567" },
            { label: "教程文章", value: "89" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold text-foreground">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Feed Section ─── */}
      <section className="relative z-10 px-6 pb-20 max-w-6xl mx-auto w-full">
        {/* Feed Tabs */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" className="gap-2 text-primary">
            <TrendingUp className="w-4 h-4" />
            热门
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            最新
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            关注
          </Button>
          <div className="flex-1" />
          <Link href="/explore">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              发现更多
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Actual Feed Grid */}
        <FeedGrid items={feedItems} />
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative z-10 px-6 pb-32 max-w-2xl mx-auto w-full text-center">
        <GlassCard className="p-12 space-y-6">
          <Code2 className="w-12 h-12 mx-auto text-primary/70" />
          <h2 className="text-3xl font-bold">
            准备好创作你的第一个可视化了吗？
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            不需要会写代码。用自然语言描述你想看的数学动画，AI 帮你生成
            Manim 代码，一键渲染发布。
          </p>
          <Link href="/sandbox">
            <Button
              size="lg"
              className="h-12 px-8 gap-2 bg-gradient-to-r from-primary to-secondary"
            >
              <Sparkles className="w-5 h-5" />
              免费开始
            </Button>
          </Link>
        </GlassCard>
      </section>
    </div>
  );
}

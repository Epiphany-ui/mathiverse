import { AppHeader } from "@/components/layout/app-header";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { LikeButton } from "@/components/shared/like-button";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { TagBadge } from "@/components/content/tag-badge";
import { CommentList } from "@/components/community/comment-list";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { GlassCard } from "@/components/shared/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Clock,
  ArrowLeft,
  FileText,
  Play,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getArticleById,
  getVisualizationById,
  getCommentsForTarget,
} from "@/lib/db/queries";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const article = await getArticleById(supabase, id);
  if (!article) notFound();

  const comments = await getCommentsForTarget(supabase, "article", id);

  // Fetch embedded visualizations
  const embeddedVizs = await Promise.all(
    (article.embeddedViz ?? []).map((vizId) =>
      getVisualizationById(supabase, vizId),
    ),
  );
  const validVizs = embeddedVizs.filter(Boolean);

  // View count
  supabase.rpc("increment_views", {
    target_type: "article",
    target_id: id,
  }).then(() => {}, () => {});

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Atmosphere blob */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-20 right-[10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
          style={{ background: "radial-gradient(circle, #5db8a6 0%, transparent 70%)" }}
        />
      </div>

      <AppHeader />

      <main className="flex-1 pt-20 px-6 max-w-3xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Back */}
        <ScrollReveal>
          <Link href="/explore">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full">
              <ArrowLeft className="w-4 h-4" />
              返回发现
            </Button>
          </Link>
        </ScrollReveal>

        {/* ── Cover — Notion-style pastel block ── */}
        <ScrollReveal delay={0}>
          <div className="aspect-[21/9] rounded-2xl flex items-center justify-center relative overflow-hidden border border-[#e6dfd8] bg-[#dcecfa]/30">
            {/* Decorative glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[80px] opacity-15"
              style={{ background: "radial-gradient(circle, #5db8a6 0%, transparent 70%)" }}
            />
            <div className="relative z-10 text-center px-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium text-[#5db8a6] bg-[#5db8a6]/10 mb-4">
                <FileText className="w-3 h-3" />
                文章
              </span>
              <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal tracking-[-0.5px] text-[#141413] max-w-2xl leading-tight">
                {article.title}
              </h1>
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-[#6c6a64] font-light">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {article.viewsCount} 次阅读
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {timeAgo(article.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Author — pastel card */}
        <ScrollReveal delay={0}>
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[#e6dfd8] bg-[#dcecfa]/20 backdrop-blur-sm">
            <Link href={`/u/${article.author?.username}`}>
              <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="w-9 h-9 ring-2 ring-white">
                  {article.author?.avatarUrl ? (
                    <AvatarImage src={article.author.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-[#181715] text-white text-xs">
                    {article.author?.displayName?.slice(0, 1) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-medium text-[#141413]">
                    {article.author?.displayName ?? "未知作者"}
                  </span>
                  <span className="text-xs text-[#6c6a64] block">
                    @{article.author?.username ?? "unknown"}
                  </span>
                </div>
              </div>
            </Link>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <LikeButton targetType="article" targetId={id} count={article.likesCount} />
              <BookmarkButton targetType="article" targetId={id} />
            </div>
          </div>
        </ScrollReveal>

        {/* Tags */}
        {article.tags.length > 0 && (
          <ScrollReveal>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* ── Body — book-style typography ── */}
        <ScrollReveal delay={1}>
          <article className="prose-custom">
            <div className="drop-cap text-[#3d3d3a] leading-relaxed text-base">
              <MarkdownRenderer content={article.bodyMd} />
            </div>
          </article>
        </ScrollReveal>

        {/* ── Embedded Visualizations ── */}
        {validVizs.length > 0 && (
          <>
            <ScrollReveal>
              <div className="section-ornament w-full max-w-xs mx-auto my-8">
                <Play className="w-4 h-4" />
              </div>
              <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-normal tracking-[-0.3px] text-[#141413] text-center mb-6">
                文中可视化
              </h2>
            </ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {validVizs.map((viz, i) => (
                <ScrollReveal key={viz!.id} delay={i}>
                  <Link href={`/v/${viz!.id}`}>
                    <GlassCard className="overflow-hidden group cursor-pointer border-[#e6dfd8] bg-[#ffe8d4]/20">
                      <div className="flex items-center p-4 gap-4">
                        <div className="w-20 h-14 rounded-lg flex items-center justify-center shrink-0 bg-[#cc785c]/10 group-hover:bg-[#cc785c]/20 transition-colors">
                          <Play className="w-6 h-6 text-[#cc785c] group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-[#cc785c] transition-colors">
                            {viz!.title}
                          </h3>
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </>
        )}

        <Separator className="bg-[#e6dfd8]" />

        {/* Comments */}
        <ScrollReveal>
          <div className="rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 backdrop-blur-sm p-6">
            <CommentList
              comments={comments}
              targetType="article"
              targetId={id}
            />
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}

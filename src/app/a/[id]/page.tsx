import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { LikeButton } from "@/components/shared/like-button";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { TagBadge } from "@/components/content/tag-badge";
import { CommentList } from "@/components/community/comment-list";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Clock,
  Bookmark,
  ArrowLeft,
  Play,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getArticleById,
  getCommentsForTarget,
  getVisualizationById,
} from "@/lib/db/queries";
import type { Visualization } from "@/types";

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
  if (!supabase) {
    notFound();
  }

  const article = await getArticleById(supabase, id);

  if (!article) {
    notFound();
  }

  // Fire-and-forget view increment (non-blocking)
  supabase.rpc("increment_views", {
    target_type: "article",
    target_id: id,
  }).then(
    () => {},
    () => {},
  );

  const comments = await getCommentsForTarget(supabase, "article", id);

  // Resolve embedded visualizations
  const embeddedVizs = await Promise.all(
    (article.embeddedViz ?? []).map((vizId) => getVisualizationById(supabase, vizId)),
  ).then((results) => results.filter(Boolean) as Visualization[]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-3xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Back */}
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            返回发现
          </Button>
        </Link>

        {/* Cover */}
        <div className="aspect-video bg-[#efe9de] rounded-xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(204,120,92,0.15),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(93,184,166,0.12),transparent_70%)]" />
          <div className="relative z-10 text-center">
            <h1 className="text-3xl font-bold px-8">{article.title}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              by {article.author?.displayName ?? "未知作者"}
            </p>
          </div>
        </div>

        {/* Article Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" /> {article.viewsCount} 次阅读
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="w-4 h-4" /> {article.collectionsCount} 收藏
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {timeAgo(article.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-4 py-2">
            <Link href={`/u/${article.author?.username}`}>
              <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#cc785c] text-white text-xs">
                    {article.author?.displayName?.slice(0, 1) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-medium">
                    {article.author?.displayName ?? "未知作者"}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    @{article.author?.username ?? "unknown"}
                  </span>
                </div>
              </div>
            </Link>
            <div className="flex-1" />
            <LikeButton targetType="article" targetId={id} count={article.likesCount} />
            <BookmarkButton targetType="article" targetId={id} />
          </div>

          <Separator />

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {/* Article Body */}
        <MarkdownRenderer content={article.bodyMd} />

        {/* Embedded Visualizations */}
        {article.embeddedViz.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">嵌入的可视化</h2>
            <div className="grid grid-cols-1 gap-4">
              {embeddedVizs.map((viz) => (
                  <Link key={viz.id} href={`/v/${viz.id}`}>
                    <GlassCard className="overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors">
                      <div className="flex items-center p-4 gap-4">
                        <div className="w-32 h-20 bg-[#efe9de] rounded-lg flex items-center justify-center shrink-0 relative transition-all">
                          <Play className="w-6 h-6 text-white/50 group-hover:text-white/80 group-hover:scale-110 transition-all" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {viz.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {viz.description}
                          </p>
                          <span className="text-xs text-muted-foreground/60">
                            {viz.viewsCount} 观看 · {viz.likesCount} 赞
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Comments */}
        <CommentList
          comments={comments}
          targetType="article"
          targetId={id}
        />
      </main>
    </div>
  );
}

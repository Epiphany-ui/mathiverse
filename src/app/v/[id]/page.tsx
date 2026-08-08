import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { CodeViewer } from "@/components/content/code-viewer";
import { VideoPlayer } from "@/components/content/video-player";
import { LikeButton } from "@/components/shared/like-button";
import { ForkButton } from "@/components/shared/fork-button";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { TagBadge } from "@/components/content/tag-badge";
import { CommentList } from "@/components/community/comment-list";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Clock,
  GitBranch,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getVisualizationById,
  getCommentsForTarget,
  getProfile,
} from "@/lib/db/mock-data";

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

export default async function VisualizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viz = getVisualizationById(id);

  if (!viz) {
    notFound();
  }

  const comments = getCommentsForTarget("visualization", id);
  const forkedFrom =
    viz.forkedFrom ? getVisualizationById(viz.forkedFrom) : null;

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-5xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Back button */}
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            返回发现
          </Button>
        </Link>

        {/* Video */}
        <GlassCard className="overflow-hidden" hover={false}>
          {viz.videoUrl ? (
            <VideoPlayer src={viz.videoUrl} poster={viz.posterUrl ?? undefined} />
          ) : (
            <div className="aspect-video bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Eye className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                视频尚未渲染 · 在沙箱中渲染后即可在此观看
              </p>
            </div>
          )}
        </GlassCard>

        {/* Info */}
        <div className="space-y-4">
          {/* Title + Stats */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{viz.title}</h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {viz.viewsCount} 次观看
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> {timeAgo(viz.createdAt)}
              </span>
              {viz.duration > 0 && (
                <span className="flex items-center gap-1">
                  时长 {viz.duration}s
                </span>
              )}
            </div>
          </div>

          {/* Author + Actions */}
          <div className="flex items-center gap-4 py-2">
            <Link href={`/u/${viz.author?.username}`}>
              <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs">
                    {viz.author?.displayName?.slice(0, 1) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-medium">
                    {viz.author?.displayName ?? "未知作者"}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    @{viz.author?.username ?? "unknown"}
                  </span>
                </div>
              </div>
            </Link>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <LikeButton count={viz.likesCount} />
              <ForkButton vizId={id} count={viz.forksCount} />
              <BookmarkButton />
            </div>
          </div>

          {/* Fork attribution */}
          {forkedFrom && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2">
              <GitBranch className="w-3.5 h-3.5" />
              Forked from
              <Link
                href={`/v/${forkedFrom.id}`}
                className="text-primary hover:underline font-medium"
              >
                {forkedFrom.title}
              </Link>
              by
              <Link
                href={`/u/${forkedFrom.author?.username}`}
                className="hover:underline"
              >
                @{forkedFrom.author?.username}
              </Link>
            </div>
          )}

          <Separator />

          {/* Description */}
          {viz.description && (
            <p className="text-muted-foreground leading-relaxed">
              {viz.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {viz.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          {/* Source Code */}
          <CodeViewer code={viz.sourceCode} />
        </div>

        <Separator />

        {/* Comments */}
        <CommentList
          comments={comments}
          targetType="visualization"
          targetId={id}
        />
      </main>
    </div>
  );
}

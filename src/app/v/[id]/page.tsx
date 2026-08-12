import { AppHeader } from "@/components/layout/app-header";
import { CodeViewer } from "@/components/content/code-viewer";
import { VideoPlayer } from "@/components/content/video-player";
import { LikeButton } from "@/components/shared/like-button";
import { ForkButton } from "@/components/shared/fork-button";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { ShareButton } from "@/components/shared/share-button";
import { TagBadge } from "@/components/content/tag-badge";
import { CommentList } from "@/components/community/comment-list";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Clock,
  GitBranch,
  ArrowLeft,
  Code2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocalRendererUrl } from "@/lib/utils";
import {
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

export default async function VisualizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const viz = await getVisualizationById(supabase, id);
  if (!viz) notFound();

  const comments = await getCommentsForTarget(supabase, "visualization", id);
  const forkedFrom = viz.forkedFrom
    ? await getVisualizationById(supabase, viz.forkedFrom)
    : null;

  // View count — fire and forget
  supabase.rpc("increment_views", {
    target_type: "visualization",
    target_id: id,
  }).then(() => {}, () => {});

  // If videoUrl is a local renderer URL, proxy it so it plays in local dev
  const isLocalVideoUrl = isLocalRendererUrl(viz.videoUrl);
  const playableVideoUrl = isLocalVideoUrl
    ? `/api/video-proxy?url=${encodeURIComponent(viz.videoUrl!)}`
    : viz.videoUrl;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Framer-style atmosphere blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-12"
          style={{ background: "radial-gradient(circle, #cc785c 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[30%] -left-32 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
          style={{ background: "radial-gradient(circle, #5db8a6 0%, transparent 70%)" }}
        />
      </div>

      <AppHeader />

      <main className="flex-1 pt-20 px-6 max-w-5xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Back button */}
        <ScrollReveal>
          <Link href="/explore">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full">
              <ArrowLeft className="w-4 h-4" />
              返回发现
            </Button>
          </Link>
        </ScrollReveal>

        {/* ── Video Card — large, Framer atmosphere ── */}
        <ScrollReveal delay={0}>
          <div className="rounded-2xl overflow-hidden border border-[#e6dfd8] bg-white/60 backdrop-blur-sm shadow-sm">
            {playableVideoUrl ? (
              <VideoPlayer
                src={playableVideoUrl}
                poster={viz.posterUrl ?? undefined}
              />
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                {/* Decorative blobs inside placeholder */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[60px] opacity-20"
                  style={{ background: "radial-gradient(circle, #cc785c 0%, transparent 70%)" }}
                />
                <div className="relative z-10 w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center animate-breathe">
                  <Eye className="w-8 h-8 text-[#cc785c]/50" />
                </div>
                <p className="relative z-10 text-[#6c6a64] text-sm">
                  视频尚未渲染 · 在沙箱中渲染后即可在此观看
                </p>
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* ── Info Section ── */}
        <div className="space-y-6">
          {/* Title */}
          <ScrollReveal delay={1}>
            <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal tracking-[-0.5px] text-[#141413] leading-tight">
              {viz.title}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-[#6c6a64] font-light">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {viz.viewsCount} 次观看
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> {timeAgo(viz.createdAt)}
              </span>
              {viz.duration > 0 && <span>时长 {viz.duration}s</span>}
            </div>
          </ScrollReveal>

          {/* Author + Actions — pastel card */}
          <ScrollReveal delay={1}>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-[#e6dfd8] bg-[#ffe8d4]/30 backdrop-blur-sm">
              <Link href={`/u/${viz.author?.username}`}>
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="w-10 h-10 ring-2 ring-white">
                    {viz.author?.avatarUrl ? (
                      <AvatarImage src={viz.author.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-[#cc785c] text-white text-sm">
                      {viz.author?.displayName?.slice(0, 1) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-medium text-[#141413]">
                      {viz.author?.displayName ?? "未知作者"}
                    </span>
                    <span className="text-xs text-[#6c6a64] block">
                      @{viz.author?.username ?? "unknown"}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <LikeButton targetType="visualization" targetId={id} count={viz.likesCount} />
                <ForkButton vizId={id} count={viz.forksCount} />
                <BookmarkButton targetType="visualization" targetId={id} />
                <ShareButton />
              </div>
            </div>
          </ScrollReveal>

          {/* Fork attribution */}
          {forkedFrom && (
            <ScrollReveal>
              <div className="flex items-center gap-2 text-xs text-[#6c6a64] px-4 py-2 rounded-lg bg-[#e6e0f5]/30 border border-[#e6dfd8]">
                <GitBranch className="w-3.5 h-3.5" />
                Forked from{" "}
                <Link href={`/v/${forkedFrom.id}`} className="text-[#cc785c] hover:underline font-medium">
                  {forkedFrom.title}
                </Link>
                {" "}by{" "}
                <Link href={`/u/${forkedFrom.author?.username}`} className="hover:underline">
                  @{forkedFrom.author?.username}
                </Link>
              </div>
            </ScrollReveal>
          )}

          <Separator className="bg-[#e6dfd8]" />

          {/* Description */}
          {viz.description && (
            <ScrollReveal>
              <p className="text-[#3d3d3a] leading-relaxed font-light">
                {viz.description}
              </p>
            </ScrollReveal>
          )}

          {/* Tags */}
          <ScrollReveal>
            <div className="flex flex-wrap gap-2">
              {viz.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </ScrollReveal>

          {/* Source Code — dark card */}
          <ScrollReveal>
            <div className="rounded-xl overflow-hidden border border-[#181715]/20">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#181715] text-[#faf9f5] text-xs">
                <Code2 className="w-3.5 h-3.5 text-[#cc785c]" />
                <span className="font-mono">scene.py</span>
              </div>
              <div className="bg-[#1f1e1b]">
                <CodeViewer code={viz.sourceCode} />
              </div>
            </div>
          </ScrollReveal>
        </div>

        <Separator className="bg-[#e6dfd8]" />

        {/* Comments — pastel card */}
        <ScrollReveal>
          <div className="rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 backdrop-blur-sm p-6">
            <CommentList
              comments={comments}
              targetType="visualization"
              targetId={id}
            />
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}

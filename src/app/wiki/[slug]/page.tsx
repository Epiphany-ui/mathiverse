import { AppHeader } from "@/components/layout/app-header";
import { LikeButton } from "@/components/shared/like-button";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { TagBadge } from "@/components/content/tag-badge";
import { CommentList } from "@/components/community/comment-list";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WikiBody } from "@/components/wiki/wiki-body";
import { KnowledgeGraph } from "@/components/wiki/knowledge-graph";
import {
  Eye,
  Clock,
  ArrowLeft,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getWikiEntryBySlug,
  getConnectedEntries,
} from "@/lib/db/wiki";
import { getCommentsForTarget } from "@/lib/db/queries";
import { WIKI_CATEGORIES } from "@/lib/wiki/categories";

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

interface WikiEntryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: WikiEntryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  // Use lightweight query — only need title, summary, coverUrl for metadata
  const entry = supabase
    ? await supabase
        .from("wiki_entries")
        .select("title, summary, cover_url")
        .eq("slug", slug)
        .eq("is_published", true)
        .single()
        .then(({ data }) => data)
    : null;
  if (!entry) return { title: "词条未找到 — Mathiverse" };

  return {
    title: `${entry.title} — Mathiverse 百科`,
    description: entry.summary ?? "",
    openGraph: {
      title: `${entry.title} — Mathiverse 百科`,
      description: entry.summary ?? "",
      images: entry.cover_url ? [entry.cover_url] : [],
    },
  };
}

export default async function WikiEntryPage({ params }: WikiEntryPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const entry = await getWikiEntryBySlug(supabase, slug);
  if (!entry) notFound();

  // Parallelize: comments, knowledge graph, and related entries are all independent
  const [comments, graphData, related] = await Promise.all([
    getCommentsForTarget(supabase, "wiki", entry.id),
    (async () => {
      const admin = getAdminClient();
      return admin
        ? await getConnectedEntries(admin, entry.id)
        : await getConnectedEntries(supabase, entry.id);
    })(),
    // Lightweight: only select needed columns, skip bodyMd
    supabase
      .from("wiki_entries")
      .select("id, slug, title, category, cover_url, tags, views_count, likes_count, created_at, updated_at")
      .eq("category", entry.category)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) =>
        (data ?? [])
          .map((row) => ({
            id: row.id, slug: row.slug, title: row.title,
            category: row.category, coverUrl: row.cover_url,
            tags: row.tags ?? [], viewsCount: row.views_count ?? 0,
            likesCount: row.likes_count ?? 0, createdAt: row.created_at,
            updatedAt: row.updated_at,
          }))
          .filter((relatedEntry) => relatedEntry.id !== entry.id)
          .slice(0, 3),
      ),
  ]);

  // Fire-and-forget view count
  supabase
    .rpc("increment_views", {
      target_type: "wiki",
      target_id: entry.id,
    })
    .then(() => {}, () => {});

  const categoryMeta = WIKI_CATEGORIES.find((c) => c.id === entry.category);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Atmosphere blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-12"
          style={{
            background: `radial-gradient(circle, ${categoryMeta?.color ?? "#cc785c"} 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute top-[30%] -left-32 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
          style={{
            background: "radial-gradient(circle, #5db8a6 0%, transparent 70%)",
          }}
        />
      </div>

      <AppHeader />

      <main className="flex-1 pt-20 px-6 max-w-4xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Back button */}
        <ScrollReveal>
          <Link href="/wiki">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 -ml-2 rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
              返回百科
            </Button>
          </Link>
        </ScrollReveal>

        {/* Hero cover block */}
        <ScrollReveal delay={0}>
          <div
            className="relative rounded-2xl overflow-hidden border border-[#e6dfd8] aspect-[21/9] flex items-center justify-center"
            style={{
              background: entry.coverUrl
                ? undefined
                : `linear-gradient(135deg, ${categoryMeta?.color ?? "#cc785c"}10, ${categoryMeta?.color ?? "#cc785c"}05)`,
            }}
          >
            {entry.coverUrl && (
              <img
                src={entry.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
            )}
            <div className="relative z-10 text-center space-y-3 px-8">
              <span
                className="inline-block text-xs font-medium px-3 py-1 rounded-full"
                style={{
                  color: categoryMeta?.color,
                  background: `${categoryMeta?.color}20`,
                }}
              >
                {categoryMeta?.label ?? entry.category}
              </span>
              <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal tracking-[-0.5px] text-[#141413] leading-tight">
                {entry.title}
              </h1>
              <div className="flex items-center justify-center gap-4 text-sm text-[#6c6a64] font-light">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {entry.viewsCount} 次阅读
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {timeAgo(entry.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Action row */}
        <ScrollReveal delay={0}>
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <LikeButton
                targetType="wiki"
                targetId={entry.id}
                count={entry.likesCount}
              />
              <BookmarkButton targetType="wiki" targetId={entry.id} />
            </div>
            <div className="flex-1" />
            <span className="text-xs text-[#6c6a64] flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {entry.commentsCount} 条评论
            </span>
          </div>
        </ScrollReveal>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <ScrollReveal>
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* Body — Markdown + KaTeX */}
        <ScrollReveal>
          <article className="prose-custom">
            <div className="drop-cap text-[#3d3d3a] leading-relaxed text-base">
              <WikiBody
                slug={entry.slug}
                title={entry.title}
                bodyMd={entry.bodyMd}
              />
            </div>
          </article>
        </ScrollReveal>

        {/* Wikipedia attribution — CC BY-SA */}
        {entry.wikipediaUrl && (
          <ScrollReveal>
            <GlassCard className="p-4 border-[#e6dfd8]" hover={false}>
              <div className="flex items-center gap-3 text-xs text-[#6c6a64]">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>
                  内容改编自 Wikipedia
                  {entry.wikipediaTitle && (
                    <>
                      {" "}—{" "}
                      <a
                        href={entry.wikipediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#cc785c] hover:underline inline-flex items-center gap-0.5"
                      >
                        {entry.wikipediaTitle}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                  ，基于 CC BY-SA 许可
                </span>
              </div>
            </GlassCard>
          </ScrollReveal>
        )}

        {/* Related entries */}
        {related.length > 0 && (
          <ScrollReveal>
            <div className="space-y-4">
              <div className="section-ornament">
                <span className="text-sm font-medium text-[#6c6a64]">
                  相关词条
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {related.map((r: { id: string; slug: string; title: string; category: string }) => {
                  const rm = WIKI_CATEGORIES.find((c) => c.id === r.category);
                  return (
                    <Link key={r.id} href={`/wiki/${r.slug}`}>
                      <GlassCard
                        className="p-4 cursor-pointer border-[#e6dfd8] h-full"
                        hover
                      >
                        <span
                          className="text-xs font-medium"
                          style={{ color: rm?.color }}
                        >
                          {rm?.label}
                        </span>
                        <h4 className="font-medium text-sm text-[#141413] mt-1 line-clamp-1">
                          {r.title}
                        </h4>
                      </GlassCard>
                    </Link>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        )}

        <Separator className="bg-[#e6dfd8]" />

        {/* Knowledge Graph */}
        <ScrollReveal>
          <KnowledgeGraph
            centerSlug={entry.slug}
            centerTitle={entry.title}
            nodes={[
              {
                id: entry.id,
                slug: entry.slug,
                title: entry.title,
                category: entry.category,
                color: categoryMeta?.color ?? "#cc785c",
                viewsCount: entry.viewsCount,
                isCenter: true,
              },
              ...graphData.entries
                .filter((e) => e.id !== entry.id)
                .slice(0, 20)
                .map((e) => ({
                  id: e.id,
                  slug: e.slug,
                  title: e.title,
                  category: e.category,
                  color: WIKI_CATEGORIES.find((c) => c.id === e.category)?.color ?? "#6c6a64",
                  viewsCount: e.viewsCount,
                  isCenter: false,
                })),
            ]}
            edges={graphData.edges
              .filter(
                (e, i, arr) =>
                  arr.findIndex(
                    (x) =>
                      (x.sourceId === e.sourceId && x.targetId === e.targetId) ||
                      (x.sourceId === e.targetId && x.targetId === e.sourceId),
                  ) === i,
              )
              .map((e) => ({
                source: e.sourceId,
                target: e.targetId,
                label: e.label,
                strength: e.strength,
              }))}
          />
        </ScrollReveal>

        <Separator className="bg-[#e6dfd8]" />

        {/* Comments */}
        <ScrollReveal>
          <div className="rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 backdrop-blur-sm p-6">
            <CommentList
              comments={comments}
              targetType="wiki"
              targetId={entry.id}
            />
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}

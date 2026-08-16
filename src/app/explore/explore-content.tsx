"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { FeedGrid } from "@/components/community/feed-grid";
import { TagBadge } from "@/components/content/tag-badge";
import { Button } from "@/components/ui/button";
import { Compass, TrendingUp, Clock, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildFeedItems } from "@/lib/db/queries";
import type { FeedSort, FeedItem } from "@/types";

/** Aggregate the most-used tags across the loaded feed — real data instead
 *  of a hardcoded list that goes stale. */
function derivePopularTags(items: FeedItem[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function ExploreContent() {
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag") ?? "";
  const [sort, setSort] = useState<FeedSort>("hot");
  const [activeTag, setActiveTag] = useState(initialTag);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>([]);

  // Check auth state once on mount
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(!!user);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    buildFeedItems(supabase, sort)
      .then((all) => {
        if (cancelled) return;
      setPopularTags(derivePopularTags(all));
      if (activeTag) {
        const filtered = all
          .filter((item) =>
            item.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase()),
          )
          .sort((a, b) => {
            if (sort === "new" || sort === "followed") {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2);
          });
        setItems(filtered);
      } else {
        setItems(all);
      }
      setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, activeTag]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-6xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 animate-spring">
          <div className="relative">
            <Compass className="w-8 h-8 text-primary animate-float" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">发现</h1>
            <p className="text-muted-foreground mt-1">
              探索社区中最精彩的数学可视化作品
            </p>
          </div>
        </div>

        {/* Sort Tabs */}
        <div className="flex items-center gap-2">
          <Button
            variant={sort === "hot" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setSort("hot")}
          >
            <TrendingUp className="w-4 h-4" />
            热门
          </Button>
          <Button
            variant={sort === "new" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setSort("new")}
          >
            <Clock className="w-4 h-4" />
            最新
          </Button>
          {loggedIn && (
            <Button
              variant={sort === "followed" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setSort("followed")}
            >
              <Users className="w-4 h-4" />
              关注
            </Button>
          )}

          {activeTag && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 ml-2 text-primary border-primary/30"
              onClick={() => setActiveTag("")}
            >
              <X className="w-3.5 h-3.5" />
              清除筛选: {activeTag}
            </Button>
          )}
        </div>

        {/* Popular Tags */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            热门标签
          </h2>
          <div className="flex flex-wrap gap-2">
            {popularTags.length > 0 ? (
              popularTags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  active={activeTag === tag}
                  onSelect={() => setActiveTag(activeTag === tag ? "" : tag)}
                />
              ))
            ) : (
              !loading && (
                <p className="text-xs text-muted-foreground/60">
                  还没有作品发布，标签将随社区内容自动出现
                </p>
              )
            )}
          </div>
        </section>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {activeTag
            ? `"${activeTag}" 标签下 ${items.length} 个内容`
            : `共 ${items.length} 个内容`}
        </p>

        {/* Feed Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sort === "followed" && !loggedIn ? (
          <div className="text-center py-20 space-y-3">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">登录后查看关注动态</p>
            <a
              href="/auth/login?redirect=/explore"
              className="inline-block text-sm text-primary hover:underline"
            >
              去登录
            </a>
          </div>
        ) : (
          <FeedGrid items={items} />
        )}
      </main>
    </div>
  );
}

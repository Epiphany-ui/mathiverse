"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { FeedGrid } from "@/components/community/feed-grid";
import { TagBadge } from "@/components/content/tag-badge";
import { Button } from "@/components/ui/button";
import { Compass, TrendingUp, Clock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildFeedItems } from "@/lib/db/queries";
import type { FeedSort, FeedItem } from "@/types";

const POPULAR_TAGS = [
  "傅里叶变换", "梯度下降", "排序算法", "欧拉公式",
  "概率分布", "椭圆曲线", "线性代数", "信号处理",
  "机器学习", "几何",
];

export function ExploreContent() {
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag") ?? "";
  const [sort, setSort] = useState<FeedSort>("hot");
  const [activeTag, setActiveTag] = useState(initialTag);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    buildFeedItems(supabase, sort)
      .then((all) => {
        if (cancelled) return;
      if (activeTag) {
        const filtered = all
          .filter((item) =>
            item.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase()),
          )
          .sort((a, b) => {
            if (sort === "new") {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2);
          });
        setItems(filtered);
      } else {
        setItems(all);
      }
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
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
              >
                <TagBadge
                  tag={tag}
                  active={activeTag === tag}
                />
              </button>
            ))}
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
        ) : (
          <FeedGrid items={items} />
        )}
      </main>
    </div>
  );
}

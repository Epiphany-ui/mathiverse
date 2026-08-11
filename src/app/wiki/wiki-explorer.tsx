"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Search, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { cn } from "@/lib/utils";
import { WIKI_CATEGORIES } from "@/lib/wiki/categories";
import type { WikiEntry, WikiCategory } from "@/types";

interface WikiExplorerProps {
  entries: WikiEntry[];
}

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

export function WikiExplorer({ entries }: WikiExplorerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "all";
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const filtered = useMemo(() => {
    let result = entries;
    if (activeCategory !== "all") {
      result = result.filter((e) => e.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [entries, activeCategory, query]);

  const categoryMeta = (cat: WikiCategory) =>
    WIKI_CATEGORIES.find((c) => c.id === cat);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md mx-auto w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6a64]" />
        <Input
          placeholder="搜索词条..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-white border-[#e6dfd8] focus:border-[#cc785c]/50 rounded-full"
        />
      </div>

      {/* Category tabs */}
      <div className="flex justify-center gap-2 flex-wrap">
        <Button
          variant={activeCategory === "all" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-full gap-1.5"
          onClick={() => setActiveCategory("all")}
        >
          <BookOpen className="w-3.5 h-3.5" />
          全部
        </Button>
        {WIKI_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategory === cat.id ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => setActiveCategory(cat.id)}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry, i) => {
            const meta = categoryMeta(entry.category);
            return (
              <ScrollReveal key={entry.id} delay={i % 3} direction="up">
                <Link href={`/wiki/${entry.slug}`}>
                  <GlassCard
                    className={cn(
                      "p-5 cursor-pointer h-full flex flex-col gap-3",
                      "border-[#e6dfd8]",
                    )}
                    hover
                  >
                    {/* Category + time */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color: meta?.color,
                          background: `${meta?.color}15`,
                        }}
                      >
                        {meta?.label ?? entry.category}
                      </span>
                      <span className="text-xs text-[#6c6a64]/60">
                        {timeAgo(entry.updatedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-semibold text-[#141413] leading-tight">
                      {entry.title}
                    </h3>

                    {/* Summary */}
                    {entry.summary && (
                      <p className="text-sm text-[#6c6a64] line-clamp-2 leading-relaxed">
                        {entry.summary}
                      </p>
                    )}

                    {/* Footer stats */}
                    <div className="flex items-center gap-3 mt-auto text-xs text-[#6c6a64]/60">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {entry.viewsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {entry.likesCount}
                      </span>
                    </div>
                  </GlassCard>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-[#e6dfd8] mx-auto mb-4" />
          <p className="text-[#6c6a64] text-sm">
            {entries.length === 0 ? "暂无词条" : "未找到相关词条"}
          </p>
        </div>
      )}
    </div>
  );
}

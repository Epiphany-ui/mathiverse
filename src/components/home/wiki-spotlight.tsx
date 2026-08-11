import Link from "next/link";
import { BookOpen, Eye, Heart } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { WIKI_CATEGORIES } from "@/lib/wiki/categories";
import type { WikiEntry } from "@/types";

interface WikiSpotlightProps {
  entries: WikiEntry[];
}

export function WikiSpotlight({ entries }: WikiSpotlightProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="wiki-spotlight-title" className="space-y-6">
      {/* Section heading */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="h-px flex-1 max-w-12 bg-gradient-to-r from-transparent to-[#e6dfd8]" />
          <BookOpen className="w-4 h-4 text-[#cc785c]" />
          <span className="text-xs font-medium tracking-[0.15em] text-[#6c6a64] uppercase">
            百科精选
          </span>
          <div className="h-px flex-1 max-w-12 bg-gradient-to-l from-transparent to-[#e6dfd8]" />
        </div>
        <h2
          id="wiki-spotlight-title"
          className="font-[family-name:var(--font-cormorant)] text-2xl font-normal text-[#141413]"
        >
          知识可视化
        </h2>
        <p className="text-sm text-[#6c6a64]">
          源自 Wikipedia · AI 精修 · 每个词条都配有动画灵感
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {entries.slice(0, 3).map((entry, i) => {
          const meta = WIKI_CATEGORIES.find((c) => c.id === entry.category);
          return (
            <ScrollReveal key={entry.id} delay={i} direction="up">
              <Link href={`/wiki/${entry.slug}`}>
                <GlassCard
                  className="p-5 cursor-pointer h-full flex flex-col gap-3 border-[#e6dfd8]"
                  hover
                >
                  {/* Category pill */}
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full self-start"
                    style={{
                      color: meta?.color,
                      background: `${meta?.color}15`,
                    }}
                  >
                    {meta?.label ?? entry.category}
                  </span>

                  {/* Title */}
                  <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-semibold text-[#141413] leading-tight">
                    {entry.title}
                  </h3>

                  {/* Summary */}
                  {entry.summary && (
                    <p className="text-sm text-[#6c6a64] line-clamp-2 leading-relaxed flex-1">
                      {entry.summary}
                    </p>
                  )}

                  {/* Tags */}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 rounded bg-[#f5f2ed] text-[#6c6a64]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-[#6c6a64]/60 mt-auto">
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

      {/* Browse all link */}
      <div className="text-center">
        <Link
          href="/wiki"
          className="text-sm text-[#cc785c] hover:text-[#a9583e] transition-colors"
        >
          浏览全部 {entries.length} 个词条 →
        </Link>
      </div>
    </section>
  );
}
